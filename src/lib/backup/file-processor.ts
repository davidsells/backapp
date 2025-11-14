import type { BackupSource } from '../types/backup.types';
import * as fs from 'fs';
import * as path from 'path';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export class FileProcessor {
  /**
   * Validate a backup source path
   */
  async validateSource(source: BackupSource): Promise<ValidationResult> {
    if (!source.path || source.path.trim().length === 0) {
      return {
        valid: false,
        error: 'Source path is required',
      };
    }

    // For agent-based backups, we can't validate the path on the server
    // The validation will happen on the agent side
    // For server-based backups, validate the path exists
    try {
      // Basic path validation - check it's not obviously invalid
      const normalizedPath = path.normalize(source.path);

      // Check for invalid characters (basic check)
      if (normalizedPath.includes('\0')) {
        return {
          valid: false,
          error: 'Invalid path: contains null characters',
        };
      }

      // For server-side validation, we could check if path exists
      // But since this might be agent-based, we'll do basic validation only
      return {
        valid: true,
      };
    } catch (error) {
      return {
        valid: false,
        error: `Invalid path: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Scan a directory and return file list with metadata
   */
  async scanDirectory(sourcePath: string, excludePatterns?: string[], includePatterns?: string[]): Promise<string[]> {
    const files: string[] = [];

    const scanRecursive = async (dirPath: string) => {
      try {
        const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);
          const relativePath = path.relative(sourcePath, fullPath);

          // Check exclude patterns
          if (excludePatterns && excludePatterns.some(pattern => this.matchPattern(relativePath, pattern))) {
            continue;
          }

          // Check include patterns (if specified)
          if (includePatterns && includePatterns.length > 0) {
            if (!includePatterns.some(pattern => this.matchPattern(relativePath, pattern))) {
              continue;
            }
          }

          if (entry.isDirectory()) {
            await scanRecursive(fullPath);
          } else {
            files.push(fullPath);
          }
        }
      } catch (error) {
        console.error(`Error scanning directory ${dirPath}:`, error);
      }
    };

    await scanRecursive(sourcePath);
    return files;
  }

  /**
   * Simple pattern matching (supports basic wildcards)
   */
  private matchPattern(filePath: string, pattern: string): boolean {
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(filePath);
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(filePath: string) {
    try {
      const stats = await fs.promises.stat(filePath);
      return {
        size: stats.size,
        modified: stats.mtime,
        isDirectory: stats.isDirectory(),
        isFile: stats.isFile(),
      };
    } catch (error) {
      throw new Error(`Failed to get metadata for ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
