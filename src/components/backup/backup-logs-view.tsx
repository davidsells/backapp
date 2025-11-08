'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface BackupLog {
  id: string;
  configId: string;
  startTime: Date;
  endTime: Date | null;
  status: string;
  filesProcessed: number;
  filesSkipped: number;
  totalBytes: bigint;
  bytesTransferred: bigint;
  s3Path: string | null;
  errors: any;
  duration: number | null;
  config: {
    name: string;
  };
}

interface BackupLogsViewProps {
  logs: BackupLog[];
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

function formatDuration(ms: number | null): string {
  if (!ms) return 'N/A';
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'completed':
      return 'bg-green-100 text-green-700 border-green-200';
    case 'failed':
      return 'bg-red-100 text-red-700 border-red-200';
    case 'running':
      return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'requested':
      return 'bg-orange-100 text-orange-700 border-orange-200';
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200';
  }
}

function getStatusIcon(status: string): string {
  switch (status) {
    case 'completed':
      return '✓';
    case 'failed':
      return '✕';
    case 'running':
      return '⟳';
    case 'requested':
      return '⏳';
    default:
      return '•';
  }
}

export function BackupLogsView({ logs }: BackupLogsViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Calculate statistics
  const stats = useMemo(() => {
    const total = logs.length;
    const completed = logs.filter((l) => l.status === 'completed').length;
    const failed = logs.filter((l) => l.status === 'failed').length;
    const running = logs.filter((l) => l.status === 'running').length;
    const requested = logs.filter((l) => l.status === 'requested').length;

    const totalBytes = logs.reduce((sum, log) => sum + Number(log.bytesTransferred), 0);
    const totalFiles = logs.reduce((sum, log) => sum + log.filesProcessed, 0);

    return {
      total,
      completed,
      failed,
      running,
      requested,
      successRate: total > 0 ? ((completed / total) * 100).toFixed(1) : '0',
      totalBytes,
      totalFiles,
    };
  }, [logs]);

  // Filter and search logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Status filter
      if (statusFilter !== 'all' && log.status !== statusFilter) {
        return false;
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const configName = log.config?.name?.toLowerCase() || '';
        return configName.includes(query);
      }

      return true;
    });
  }, [logs, statusFilter, searchQuery]);

  const toggleExpanded = (logId: string) => {
    setExpandedLogId(expandedLogId === logId ? null : logId);
  };

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Backups</CardDescription>
            <CardTitle className="text-2xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Completed</CardDescription>
            <CardTitle className="text-2xl text-green-600">{stats.completed}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Failed</CardDescription>
            <CardTitle className="text-2xl text-red-600">{stats.failed}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Success Rate</CardDescription>
            <CardTitle className="text-2xl">{stats.successRate}%</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Data</CardDescription>
            <CardTitle className="text-2xl">{formatBytes(stats.totalBytes)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle>Backup History</CardTitle>
          <CardDescription>View and filter backup execution logs</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <Input
              placeholder="Search by backup name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="sm:max-w-xs"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="sm:max-w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="running">Running</SelectItem>
                <SelectItem value="requested">Requested</SelectItem>
              </SelectContent>
            </Select>
            {(searchQuery || statusFilter !== 'all') && (
              <Button
                variant="ghost"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                }}
              >
                Clear Filters
              </Button>
            )}
          </div>

          {/* Logs List */}
          {filteredLogs.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                {logs.length === 0
                  ? 'No backup logs yet'
                  : 'No logs match your filters'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredLogs.map((log) => {
                const isExpanded = expandedLogId === log.id;
                const statusColor = getStatusColor(log.status);
                const statusIcon = getStatusIcon(log.status);

                return (
                  <div
                    key={log.id}
                    className="border rounded-lg overflow-hidden transition-all"
                  >
                    {/* Main row */}
                    <div
                      className="flex items-center justify-between p-4 hover:bg-muted/50 cursor-pointer"
                      onClick={() => toggleExpanded(log.id)}
                    >
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-3">
                          <span
                            className={`text-xs px-2 py-1 rounded border font-medium flex items-center gap-1 ${statusColor}`}
                          >
                            <span>{statusIcon}</span>
                            <span>{log.status}</span>
                          </span>
                          <h3 className="font-semibold">{log.config?.name || 'Unknown'}</h3>
                        </div>
                        <div className="text-sm text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                          <span>{new Date(log.startTime).toLocaleString()}</span>
                          {log.duration && (
                            <span>Duration: {formatDuration(log.duration)}</span>
                          )}
                          {log.status === 'running' && (
                            <span className="text-blue-600">In progress...</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right space-y-1 hidden sm:block">
                          <div className="text-sm font-medium">
                            {log.filesProcessed.toLocaleString()} files
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {formatBytes(Number(log.bytesTransferred))}
                          </div>
                        </div>
                        <div className="text-muted-foreground">
                          {isExpanded ? '▼' : '▶'}
                        </div>
                      </div>
                    </div>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-2 bg-muted/30 border-t">
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          <div>
                            <div className="text-xs text-muted-foreground mb-1">Start Time</div>
                            <div className="text-sm font-medium">
                              {new Date(log.startTime).toLocaleString()}
                            </div>
                          </div>
                          {log.endTime && (
                            <div>
                              <div className="text-xs text-muted-foreground mb-1">End Time</div>
                              <div className="text-sm font-medium">
                                {new Date(log.endTime).toLocaleString()}
                              </div>
                            </div>
                          )}
                          <div>
                            <div className="text-xs text-muted-foreground mb-1">Duration</div>
                            <div className="text-sm font-medium">
                              {formatDuration(log.duration)}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground mb-1">Files Processed</div>
                            <div className="text-sm font-medium">
                              {log.filesProcessed.toLocaleString()}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground mb-1">Files Skipped</div>
                            <div className="text-sm font-medium">
                              {log.filesSkipped.toLocaleString()}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground mb-1">Bytes Transferred</div>
                            <div className="text-sm font-medium">
                              {formatBytes(Number(log.bytesTransferred))}
                            </div>
                          </div>
                          {log.s3Path && (
                            <div className="sm:col-span-2 lg:col-span-3">
                              <div className="text-xs text-muted-foreground mb-1">S3 Path</div>
                              <div className="text-sm font-mono bg-background px-2 py-1 rounded border break-all">
                                {log.s3Path}
                              </div>
                            </div>
                          )}
                          {log.errors && (
                            <div className="sm:col-span-2 lg:col-span-3">
                              <div className="text-xs text-muted-foreground mb-1">Errors</div>
                              <div className="text-sm bg-red-50 text-red-900 px-3 py-2 rounded border border-red-200">
                                <pre className="whitespace-pre-wrap break-words">
                                  {typeof log.errors === 'string'
                                    ? log.errors
                                    : JSON.stringify(log.errors, null, 2)}
                                </pre>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Results count */}
          {filteredLogs.length > 0 && (
            <div className="mt-4 text-sm text-muted-foreground text-center">
              Showing {filteredLogs.length} of {logs.length} logs
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
