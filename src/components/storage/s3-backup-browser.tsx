'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface BackupFile {
  key: string;
  size: number;
  lastModified: string;
  timestamp: string;
  configId: string;
  etag?: string;
}

interface S3BackupBrowserProps {
  userId: string;
  agentId?: string;
  configId?: string;
  title?: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

function formatFilename(key: string): string {
  const parts = key.split('/');
  return parts[parts.length - 1] || key;
}

export function S3BackupBrowser({ userId, agentId, configId, title = 'S3 Backup Files' }: S3BackupBrowserProps) {
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState<Set<string>>(new Set());

  const loadBackups = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (agentId) params.append('agentId', agentId);
      if (configId) params.append('configId', configId);

      const response = await fetch(`/api/s3/backups?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setBackups(data.backups);
      } else {
        setError(data.error || 'Failed to load backups');
      }
    } catch (err) {
      setError('Failed to load backups from S3');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBackups();
  }, [userId, agentId, configId]);

  const handleDelete = async (s3Key: string) => {
    if (!confirm('Are you sure you want to delete this backup? This action cannot be undone.')) {
      return;
    }

    setDeleting(prev => new Set(prev).add(s3Key));
    setError(null);

    try {
      const response = await fetch('/api/s3/backups', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ s3Key }),
      });

      const data = await response.json();

      if (data.success) {
        // Remove from list
        setBackups(prev => prev.filter(b => b.key !== s3Key));
      } else {
        setError(data.error || 'Failed to delete backup');
      }
    } catch (err) {
      setError('Failed to delete backup');
      console.error(err);
    } finally {
      setDeleting(prev => {
        const next = new Set(prev);
        next.delete(s3Key);
        return next;
      });
    }
  };

  const handleDownload = async (s3Key: string, _filename: string) => {
    setDownloading(prev => new Set(prev).add(s3Key));
    setError(null);

    try {
      const response = await fetch('/api/s3/backups/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ s3Key }),
      });

      const data = await response.json();

      if (data.success && data.downloadUrl) {
        // Open download URL in new window
        window.open(data.downloadUrl, '_blank');
      } else {
        setError(data.error || 'Failed to generate download link');
      }
    } catch (err) {
      setError('Failed to generate download link');
      console.error(err);
    } finally {
      setDownloading(prev => {
        const next = new Set(prev);
        next.delete(s3Key);
        return next;
      });
    }
  };

  const totalSize = backups.reduce((sum, b) => sum + b.size, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>
              {backups.length} file(s) • {formatBytes(totalSize)} total
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={loadBackups} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-800 rounded-md text-sm">
            {error}
          </div>
        )}

        {loading && backups.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Loading backups from S3...
          </div>
        ) : backups.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No backup files found in S3
          </div>
        ) : (
          <div className="space-y-2">
            {backups.map((backup) => {
              const isDeleting = deleting.has(backup.key);
              const isDownloading = downloading.has(backup.key);
              const filename = formatFilename(backup.key);

              return (
                <div
                  key={backup.key}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate" title={filename}>
                      {filename}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{formatBytes(backup.size)}</span>
                      <span>•</span>
                      <span>{new Date(backup.timestamp).toLocaleString()}</span>
                      {backup.configId && backup.configId !== 'unknown' && (
                        <>
                          <span>•</span>
                          <span className="font-mono text-xs">Config: {backup.configId.substring(0, 8)}...</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(backup.key, filename)}
                      disabled={isDownloading || isDeleting}
                    >
                      {isDownloading ? 'Generating...' : 'Download'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(backup.key)}
                      disabled={isDeleting || isDownloading}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      {isDeleting ? 'Deleting...' : 'Delete'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
