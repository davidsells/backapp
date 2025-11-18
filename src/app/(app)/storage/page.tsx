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

interface Agent {
  id: string;
  name: string;
  status: string;
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

function extractAgentId(key: string): string {
  const match = key.match(/\/agents\/([^/]+)\//);
  return (match && match[1]) ? match[1] : 'unknown';
}

export default function StoragePage() {
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState<Set<string>>(new Set());
  const [filterAgent, setFilterAgent] = useState<string>('all');

  const loadAgents = async () => {
    try {
      const response = await fetch('/api/agents');
      const data = await response.json();
      if (data.agents) {
        setAgents(data.agents);
      }
    } catch (err) {
      console.error('Failed to load agents:', err);
    }
  };

  const loadBackups = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filterAgent !== 'all') {
        params.append('agentId', filterAgent);
      }

      const response = await fetch(`/api/s3/backups?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setBackups(data.backups);
      } else {
        setError(data.error || 'Failed to load backups');
      }
    } catch (err) {
      setError('Failed to load backups from S3. Make sure AWS credentials are configured.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAgents();
  }, []);

  useEffect(() => {
    loadBackups();
  }, [filterAgent]);

  const handleDelete = async (s3Key: string) => {
    if (!confirm('Are you sure you want to delete this backup from S3? This action cannot be undone.')) {
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

  const handleDownload = async (s3Key: string) => {
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
  const groupedByAgent = backups.reduce((acc, backup) => {
    const agentId = extractAgentId(backup.key);
    if (!acc[agentId]) {
      acc[agentId] = [];
    }
    acc[agentId].push(backup);
    return acc;
  }, {} as Record<string, BackupFile[]>);

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">S3 Storage Management</h1>
        <p className="text-muted-foreground">
          View, download, and delete backup files stored in S3
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Files</CardDescription>
            <CardTitle className="text-3xl">{backups.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Storage Used</CardDescription>
            <CardTitle className="text-3xl">{formatBytes(totalSize)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Agents with Backups</CardDescription>
            <CardTitle className="text-3xl">{Object.keys(groupedByAgent).length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Filter and Actions */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filter Backups</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Filter by Agent</label>
              <select
                value={filterAgent}
                onChange={(e) => setFilterAgent(e.target.value)}
                className="w-full p-2 border border-input rounded-md bg-background"
              >
                <option value="all">All Agents</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name} ({agent.status})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <Button onClick={loadBackups} disabled={loading} variant="outline">
                {loading ? 'Refreshing...' : 'Refresh'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-800 rounded-md">
          {error}
        </div>
      )}

      {/* Backup Files List */}
      <Card>
        <CardHeader>
          <CardTitle>Backup Files in S3</CardTitle>
          <CardDescription>
            {loading ? 'Loading...' : `${backups.length} file(s) • ${formatBytes(totalSize)} total`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">
              Loading backups from S3...
            </div>
          ) : backups.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">No backup files found in S3</p>
              <p className="text-sm text-muted-foreground">
                Backups will appear here after agents complete backup executions
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {backups.map((backup) => {
                const isDeleting = deleting.has(backup.key);
                const isDownloading = downloading.has(backup.key);
                const filename = formatFilename(backup.key);
                const agentId = extractAgentId(backup.key);
                const agent = agents.find(a => a.id === agentId);

                return (
                  <div
                    key={backup.key}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium truncate" title={filename}>
                          {filename}
                        </p>
                        {agent && (
                          <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700">
                            {agent.name}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="font-semibold">{formatBytes(backup.size)}</span>
                        <span>•</span>
                        <span>{new Date(backup.timestamp).toLocaleString()}</span>
                        {backup.configId && backup.configId !== 'unknown' && (
                          <>
                            <span>•</span>
                            <span className="font-mono">Config: {backup.configId.substring(0, 8)}...</span>
                          </>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 font-mono truncate" title={backup.key}>
                        S3: {backup.key}
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(backup.key)}
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
    </div>
  );
}
