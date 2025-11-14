import * as fs from 'fs/promises';
import * as path from 'path';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { createGzip } from 'zlib';
import type { BackupSource } from '@/types/backup.types';

/**
 * File metadata for backup processing
 */
export interface FileMetadata {
  path: string;
  relativePath: string;
  size: number;
  mtime: Date;
  isDirectory: boolean;
}

/**
 * File processing result
 */
export interface ProcessResult {
  processed: boolean;
  skipped: boolean;
  reason?: string;
  size: number;
  compressedSize?: number;
}

/**
 * Options for file processing
 */
export interface ProcessOptions {
  compress?: boolean;
  compressionLevel?: number;
  outputPath?: string;
}

/**
 * Check if a file path matches any of the given patterns
 */
function matchesPattern(filePath: string, patterns: string[]): boolean {
  if (!patterns || patterns.length === 0) {
    return false;
  }

  return patterns.some(pattern => {
    // Simple glob pattern matching
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(filePath);
  });
}

/**
 * Check if a file should be included based on backup source configuration
 */
export function shouldIncludeFile(
  relativePath: string,
  source: BackupSource
): { include: boolean; reason?: string } {
  // Check exclude patterns first
  if (source.excludePatterns && matchesPattern(relativePath, source.excludePatterns)) {
    return { include: false, reason: 'Excluded by pattern' };
  }

  // If include patterns are specified, file must match at least one
  if (source.includePatterns && source.includePatterns.length > 0) {
    if (!matchesPattern(relativePath, source.includePatterns)) {
      return { include: false, reason: 'Not in include patterns' };
    }
  }

  return { include: true };
}

/**
 * Get metadata for a file or directory
 */
export async function getFileMetadata(
  filePath: string,
  basePath: string
): Promise<FileMetadata> {
  const stats = await fs.stat(filePath);
  const relativePath = path.relative(basePath, filePath);

  return {
    path: filePath,
    relativePath,
    size: stats.size,
    mtime: stats.mtime,
    isDirectory: stats.isDirectory(),
  };
}

/**
 * Recursively scan a directory for files
 */
export async function scanDirectory(
  dirPath: string,
  source: BackupSource
): Promise<FileMetadata[]> {
  const files: FileMetadata[] = [];
  const basePath = source.path;

  async function scan(currentPath: string) {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      const metadata = await getFileMetadata(fullPath, basePath);

      if (entry.isDirectory()) {
        // Check if directory should be included
        const { include } = shouldIncludeFile(metadata.relativePath, source);
        if (include) {
          await scan(fullPath);
        }
      } else {
        // Check if file should be included
        const { include } = shouldIncludeFile(metadata.relativePath, source);
        if (include) {
          files.push(metadata);
        }
      }
    }
  }

  await scan(dirPath);
  return files;
}

/**
 * Process a single file (compress if needed)
 */
export async function processFile(
  filePath: string,
  options: ProcessOptions = {}
): Promise<ProcessResult> {
  try {
    const stats = await fs.stat(filePath);
    const size = stats.size;

    if (!options.compress) {
      return {
        processed: true,
        skipped: false,
        size,
      };
    }

    // Compress file if requested
    if (options.outputPath) {
      const input = createReadStream(filePath);
      const output = createWriteStream(options.outputPath);
      const gzip = createGzip({ level: options.compressionLevel ?? 6 });

      await pipeline(input, gzip, output);

      const compressedStats = await fs.stat(options.outputPath);
      const compressedSize = compressedStats.size;

      return {
        processed: true,
        skipped: false,
        size,
        compressedSize,
      };
    }

    return {
      processed: true,
      skipped: false,
      size,
    };
  } catch (error) {
    console.error(`Error processing file ${filePath}:`, error);
    return {
      processed: false,
      skipped: true,
      reason: error instanceof Error ? error.message : 'Unknown error',
      size: 0,
    };
  }
}

/**
 * Calculate total size of files
 */
export function calculateTotalSize(files: FileMetadata[]): number {
  return files.reduce((total, file) => total + file.size, 0);
}

/**
 * Create a temporary directory for backup processing
 */
export async function createTempDirectory(prefix: string = 'backup-'): Promise<string> {
  const tmpDir = path.join('/tmp', `${prefix}${Date.now()}`);
  await fs.mkdir(tmpDir, { recursive: true });
  return tmpDir;
}

/**
 * Clean up temporary directory
 */
export async function cleanupTempDirectory(dirPath: string): Promise<void> {
  try {
    await fs.rm(dirPath, { recursive: true, force: true });
  } catch (error) {
    console.error(`Error cleaning up temp directory ${dirPath}:`, error);
  }
}

/**
 * Read file content as buffer
 */
export async function readFileAsBuffer(filePath: string): Promise<Buffer> {
  return fs.readFile(filePath);
}

/**
 * Check if path exists and is accessible
 */
export async function checkPathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
