import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface GeneratePresignedUrlOptions {
  userId: string;
  agentId: string;
  configId: string;
  filename: string;
  expiresIn?: number; // seconds, default 3600 (1 hour)
}

export interface PresignedUrlResult {
  url: string;
  s3Path: string;
  expiresAt: Date;
  method: 'PUT';
}

export class S3PresignedUrlService {
  private s3Client: S3Client;
  private bucket: string;

  constructor() {
    this.s3Client = new S3Client({
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
      region: process.env.AWS_REGION || 'us-east-1',
      ...(process.env.AWS_S3_ENDPOINT && { endpoint: process.env.AWS_S3_ENDPOINT }),
    });

    this.bucket = process.env.AWS_S3_BUCKET || '';

    if (!this.bucket) {
      console.warn('[S3PresignedUrlService] AWS_S3_BUCKET environment variable is not set');
    }
  }

  /**
   * Generate pre-signed URL for agent to upload backup
   */
  async generateUploadUrl(options: GeneratePresignedUrlOptions): Promise<PresignedUrlResult> {
    // Construct S3 path using hierarchy: users/{userId}/agents/{agentId}/configs/{configId}/{filename}
    const s3Path = `users/${options.userId}/agents/${options.agentId}/configs/${options.configId}/${options.filename}`;

    // Create PUT command for S3
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: s3Path,
      // Optional: Add metadata
      Metadata: {
        'uploaded-by': 'agent',
        'agent-id': options.agentId,
        'config-id': options.configId,
      },
    });

    // Generate pre-signed URL
    const expiresIn = options.expiresIn || 3600; // Default 1 hour
    const url = await getSignedUrl(this.s3Client, command, { expiresIn });

    // Calculate expiration time
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    return {
      url,
      s3Path,
      expiresAt,
      method: 'PUT',
    };
  }

  /**
   * Validate S3 configuration
   */
  isConfigured(): boolean {
    return !!(
      process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY &&
      process.env.AWS_S3_BUCKET
    );
  }

  /**
   * Get bucket name
   */
  getBucket(): string {
    return this.bucket;
  }

  /**
   * Get region
   */
  getRegion(): string {
    return process.env.AWS_REGION || 'us-east-1';
  }
}

// Singleton instance
let presignedUrlServiceInstance: S3PresignedUrlService | null = null;

export function getS3PresignedUrlService(): S3PresignedUrlService {
  if (!presignedUrlServiceInstance) {
    presignedUrlServiceInstance = new S3PresignedUrlService();
  }
  return presignedUrlServiceInstance;
}
