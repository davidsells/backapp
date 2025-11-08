'use client';

import { useEffect, useState } from 'react';
import { useWebSocket } from '@/hooks/use-websocket';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Loader2, CheckCircle2, XCircle, Upload, Archive } from 'lucide-react';

interface BackupProgress {
  configId: string;
  configName: string;
  stage: 'preparing' | 'archiving' | 'uploading' | 'completing';
  filesProcessed: number;
  bytesProcessed: number;
  totalBytes?: number;
  currentFile?: string;
  status: 'running' | 'completed' | 'failed';
  error?: string;
}

export function BackupProgressMonitor({ userId }: { userId: string }) {
  const [activeBackups, setActiveBackups] = useState<Map<string, BackupProgress>>(new Map());

  const handleWebSocketMessage = (message: any) => {
    switch (message.type) {
      case 'backup_started':
        setActiveBackups((prev) => {
          const next = new Map(prev);
          next.set(message.data.configId, {
            configId: message.data.configId,
            configName: message.data.configName,
            stage: 'preparing',
            filesProcessed: 0,
            bytesProcessed: 0,
            status: 'running',
          });
          return next;
        });
        break;

      case 'backup_progress':
        setActiveBackups((prev) => {
          const next = new Map(prev);
          const existing = next.get(message.data.configId);
          if (existing) {
            next.set(message.data.configId, {
              ...existing,
              ...message.data.progress,
              configName: message.data.configName,
              status: 'running',
            });
          }
          return next;
        });
        break;

      case 'backup_completed':
        setActiveBackups((prev) => {
          const next = new Map(prev);
          const existing = next.get(message.data.configId);
          if (existing) {
            next.set(message.data.configId, {
              ...existing,
              configName: message.data.configName,
              status: 'completed',
              stage: 'completing',
            });
          }
          return next;
        });

        // Remove from active backups after 3 seconds
        setTimeout(() => {
          setActiveBackups((prev) => {
            const next = new Map(prev);
            next.delete(message.data.configId);
            return next;
          });
        }, 3000);
        break;

      case 'backup_failed':
        setActiveBackups((prev) => {
          const next = new Map(prev);
          const existing = next.get(message.data.configId);
          if (existing) {
            next.set(message.data.configId, {
              ...existing,
              configName: message.data.configName,
              status: 'failed',
              error: message.data.error,
            });
          }
          return next;
        });

        // Remove from active backups after 5 seconds
        setTimeout(() => {
          setActiveBackups((prev) => {
            const next = new Map(prev);
            next.delete(message.data.configId);
            return next;
          });
        }, 5000);
        break;
    }
  };

  const { status: wsStatus } = useWebSocket({
    userId,
    onMessage: handleWebSocketMessage,
  });

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const getStageIcon = (stage: string, status: string) => {
    if (status === 'completed') {
      return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    }
    if (status === 'failed') {
      return <XCircle className="h-4 w-4 text-red-600" />;
    }

    switch (stage) {
      case 'archiving':
        return <Archive className="h-4 w-4 text-blue-600 animate-pulse" />;
      case 'uploading':
        return <Upload className="h-4 w-4 text-blue-600 animate-pulse" />;
      default:
        return <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />;
    }
  };

  const getStageLabel = (stage: string, status: string) => {
    if (status === 'completed') return 'Completed';
    if (status === 'failed') return 'Failed';

    switch (stage) {
      case 'preparing':
        return 'Preparing';
      case 'archiving':
        return 'Creating archive';
      case 'uploading':
        return 'Uploading to S3';
      case 'completing':
        return 'Finalizing';
      default:
        return 'Processing';
    }
  };

  const calculateProgress = (backup: BackupProgress): number => {
    if (backup.status === 'completed') return 100;
    if (backup.stage === 'preparing') return 5;
    if (backup.stage === 'archiving') return 30;
    if (backup.stage === 'uploading') {
      if (backup.totalBytes && backup.totalBytes > 0) {
        // We don't track upload progress byte-by-byte, so show indeterminate
        return 70;
      }
      return 70;
    }
    if (backup.stage === 'completing') return 95;
    return 0;
  };

  if (activeBackups.size === 0) {
    return null;
  }

  return (
    <div className="space-y-4 mb-6">
      {Array.from(activeBackups.values()).map((backup) => (
        <Card key={backup.configId} className="border-blue-200 bg-blue-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              {getStageIcon(backup.stage, backup.status)}
              {backup.configName}
              <span className="text-xs text-muted-foreground ml-auto">
                {getStageLabel(backup.stage, backup.status)}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Progress value={calculateProgress(backup)} className="h-2" />

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div>
                {backup.filesProcessed > 0 && (
                  <span>{backup.filesProcessed} files</span>
                )}
                {backup.bytesProcessed > 0 && (
                  <span className="ml-2">{formatBytes(backup.bytesProcessed)}</span>
                )}
              </div>

              {backup.status === 'failed' && backup.error && (
                <span className="text-red-600">{backup.error}</span>
              )}

              {backup.currentFile && backup.status === 'running' && (
                <span className="truncate max-w-xs" title={backup.currentFile}>
                  {backup.currentFile}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      {wsStatus !== 'connected' && (
        <div className="text-xs text-muted-foreground text-center">
          WebSocket: {wsStatus}
        </div>
      )}
    </div>
  );
}
