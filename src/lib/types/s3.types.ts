export interface S3Config {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  bucket: string;
  endpoint?: string;
}

export interface S3Object {
  key: string;
  size: number;
  lastModified: Date;
  etag?: string;
}

export interface UploadOptions {
  path: string;
  localPath: string;
  metadata?: Record<string, string>;
  onProgress?: (progress: number) => void;
}

export interface StorageStats {
  totalObjects: number;
  totalSize: number;
  bucket: string;
}

export interface S3Adapter {
  configure(config: S3Config): Promise<void>;
  uploadFile(options: UploadOptions): Promise<string>;
  downloadFile(key: string, destination: string): Promise<void>;
  listFiles(prefix: string): Promise<S3Object[]>;
  deleteFile(key: string): Promise<void>;
  getStorageUsage(): Promise<StorageStats>;
}
