import {
  S3Client,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import type {
  S3Config,
  S3Object,
  UploadOptions,
  StorageStats,
  S3Adapter as IS3Adapter,
} from '../types/s3.types';

export class S3Adapter implements IS3Adapter {
  private client: S3Client | null = null;
  private config: S3Config | null = null;

  async configure(config: S3Config): Promise<void> {
    this.config = config;

    this.client = new S3Client({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      ...(config.endpoint && { endpoint: config.endpoint }),
    });

    // Test connection
    try {
      await this.client.send(
        new HeadBucketCommand({ Bucket: config.bucket })
      );
    } catch (error) {
      throw new Error(
        `Failed to connect to S3 bucket: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async uploadFile(options: UploadOptions): Promise<string> {
    if (!this.client || !this.config) {
      throw new Error('S3 adapter not configured');
    }

    const fileStream = createReadStream(options.localPath);

    const upload = new Upload({
      client: this.client,
      params: {
        Bucket: this.config.bucket,
        Key: options.path,
        Body: fileStream,
        Metadata: options.metadata,
      },
    });

    // Track progress
    if (options.onProgress) {
      upload.on('httpUploadProgress', (progress) => {
        const percentage = progress.loaded && progress.total
          ? (progress.loaded / progress.total) * 100
          : 0;
        options.onProgress?.(percentage);
      });
    }

    await upload.done();

    return options.path;
  }

  async downloadFile(key: string, destination: string): Promise<void> {
    if (!this.client || !this.config) {
      throw new Error('S3 adapter not configured');
    }

    const command = new GetObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
    });

    const response = await this.client.send(command);

    if (!response.Body) {
      throw new Error('No data received from S3');
    }

    const writeStream = createWriteStream(destination);
    await pipeline(response.Body as NodeJS.ReadableStream, writeStream);
  }

  async listFiles(prefix: string): Promise<S3Object[]> {
    if (!this.client || !this.config) {
      throw new Error('S3 adapter not configured');
    }

    const objects: S3Object[] = [];
    let continuationToken: string | undefined;

    do {
      const command = new ListObjectsV2Command({
        Bucket: this.config.bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      });

      const response = await this.client.send(command);

      if (response.Contents) {
        for (const obj of response.Contents) {
          if (obj.Key) {
            objects.push({
              key: obj.Key,
              size: obj.Size || 0,
              lastModified: obj.LastModified || new Date(),
              etag: obj.ETag,
            });
          }
        }
      }

      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    return objects;
  }

  async deleteFile(key: string): Promise<void> {
    if (!this.client || !this.config) {
      throw new Error('S3 adapter not configured');
    }

    const command = new DeleteObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
    });

    await this.client.send(command);
  }

  async getStorageUsage(): Promise<StorageStats> {
    if (!this.config) {
      throw new Error('S3 adapter not configured');
    }

    const files = await this.listFiles('');

    const stats: StorageStats = {
      bucket: this.config.bucket,
      totalObjects: files.length,
      totalSize: files.reduce((sum, file) => sum + file.size, 0),
    };

    return stats;
  }

  /**
   * Test if a file exists in S3
   */
  async fileExists(key: string): Promise<boolean> {
    if (!this.client || !this.config) {
      throw new Error('S3 adapter not configured');
    }

    try {
      const command = new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
      });
      await this.client.send(command);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the configured bucket name
   */
  getBucketName(): string {
    if (!this.config) {
      throw new Error('S3 adapter not configured');
    }
    return this.config.bucket;
  }
}

// Singleton instance
let s3AdapterInstance: S3Adapter | null = null;

export function getS3Adapter(): S3Adapter {
  if (!s3AdapterInstance) {
    s3AdapterInstance = new S3Adapter();
  }
  return s3AdapterInstance;
}
