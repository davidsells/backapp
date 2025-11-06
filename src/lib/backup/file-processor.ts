import { createReadStream, createWriteStream } from 'fs';
import { readdir, stat } from 'fs/promises';
import { join, relative } from 'path';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';
import archiver from 'archiver';
import CryptoJS from 'crypto-js';
import type { BackupSource, BackupOptions } from '../types/backup.types';

export interface FileInfo {
  path: string;
  relativePath: string;
  size: number;
  modified: Date;
}

export interface ProcessingResult {
  archivePath: string;
  filesProcessed: number;
  totalBytes: number;
  duration: number;
}

export class FileProcessor {
  /**
   * Scan directory and collect all files matching patterns
   */
  async scanDirectory(source: BackupSource): Promise<FileInfo[]> {
    const files: FileInfo[] = [];
    const basePath = source.path;

    async function scan(dir: string): Promise<void> {
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        const relativePath = relative(basePath, fullPath);

        // Check exclude patterns
        if (source.excludePatterns?.some((pattern) =>
          FileProcessor.matchPattern(relativePath, pattern)
        )) {
          continue;
        }

        // Check include patterns (if specified)
        if (
          source.includePatterns &&
          source.includePatterns.length > 0 &&
          !source.includePatterns.some((pattern) =>
            FileProcessor.matchPattern(relativePath, pattern)
          )
        ) {
          continue;
        }

        if (entry.isDirectory()) {
          await scan(fullPath);
        } else if (entry.isFile()) {
          const stats = await stat(fullPath);
          files.push({
            path: fullPath,
            relativePath,
            size: stats.size,
            modified: stats.mtime,
          });
        }
      }
    }

    await scan(basePath);
    return files;
  }

  /**
   * Create archive from files
   */
  async createArchive(
    files: FileInfo[],
    outputPath: string,
    options: BackupOptions,
    onProgress?: (processed: number, total: number) => void
  ): Promise<ProcessingResult> {
    const startTime = Date.now();
    let filesProcessed = 0;
    let totalBytes = 0;

    return new Promise((resolve, reject) => {
      const output = createWriteStream(outputPath);
      const archive = archiver('tar', {
        gzip: options.compression,
        gzipOptions: {
          level: options.compressionLevel || 6,
        },
      });

      output.on('close', () => {
        resolve({
          archivePath: outputPath,
          filesProcessed,
          totalBytes: archive.pointer(),
          duration: Date.now() - startTime,
        });
      });

      archive.on('error', (err) => {
        reject(err);
      });

      archive.on('entry', () => {
        filesProcessed++;
        if (onProgress) {
          onProgress(filesProcessed, files.length);
        }
      });

      archive.pipe(output);

      // Add files to archive
      for (const file of files) {
        archive.file(file.path, { name: file.relativePath });
        totalBytes += file.size;
      }

      archive.finalize();
    });
  }

  /**
   * Encrypt file using AES-256
   */
  async encryptFile(
    inputPath: string,
    outputPath: string,
    encryptionKey: string
  ): Promise<void> {
    const fileBuffer = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      const stream = createReadStream(inputPath);

      stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });

    const encrypted = CryptoJS.AES.encrypt(
      fileBuffer.toString('base64'),
      encryptionKey
    ).toString();

    const writeStream = createWriteStream(outputPath);
    writeStream.write(encrypted);
    writeStream.end();

    await new Promise<void>((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });
  }

  /**
   * Decrypt file using AES-256
   */
  async decryptFile(
    inputPath: string,
    outputPath: string,
    encryptionKey: string
  ): Promise<void> {
    const encrypted = await new Promise<string>((resolve, reject) => {
      let data = '';
      const stream = createReadStream(inputPath, 'utf8');

      stream.on('data', (chunk) => (data += chunk));
      stream.on('end', () => resolve(data));
      stream.on('error', reject);
    });

    const decrypted = CryptoJS.AES.decrypt(encrypted, encryptionKey);
    const decryptedData = Buffer.from(decrypted.toString(CryptoJS.enc.Utf8), 'base64');

    const writeStream = createWriteStream(outputPath);
    writeStream.write(decryptedData);
    writeStream.end();

    await new Promise<void>((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });
  }

  /**
   * Compress file using gzip
   */
  async compressFile(inputPath: string, outputPath: string): Promise<void> {
    const gzip = createGzip({ level: 9 });
    const source = createReadStream(inputPath);
    const destination = createWriteStream(outputPath);

    await pipeline(source, gzip, destination);
  }

  /**
   * Get file/directory size in bytes
   */
  async getSize(path: string): Promise<number> {
    const stats = await stat(path);

    if (stats.isFile()) {
      return stats.size;
    }

    if (stats.isDirectory()) {
      const entries = await readdir(path, { withFileTypes: true });
      let total = 0;

      for (const entry of entries) {
        const fullPath = join(path, entry.name);
        total += await this.getSize(fullPath);
      }

      return total;
    }

    return 0;
  }

  /**
   * Simple glob pattern matching
   */
  private static matchPattern(path: string, pattern: string): boolean {
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(path);
  }

  /**
   * Validate source path exists and is readable
   */
  async validateSource(source: BackupSource): Promise<{ valid: boolean; error?: string }> {
    try {
      const stats = await stat(source.path);

      if (!stats.isDirectory()) {
        return { valid: false, error: 'Source path must be a directory' };
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: `Cannot access source path: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}
