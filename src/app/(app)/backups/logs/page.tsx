import { Suspense } from 'react';
import { auth } from '@/lib/auth/auth';
import { redirect } from 'next/navigation';
import { getBackupService } from '@/lib/backup/backup-service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

async function BackupLogsList() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const backupService = getBackupService();
  const logs = await backupService.getRecentLogs(session.user.id, 50);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Backup Logs</CardTitle>
        <CardDescription>Recent backup execution history</CardDescription>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No backup logs yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {logs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{log.config?.name || 'Unknown'}</h3>
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        log.status === 'completed'
                          ? 'bg-green-100 text-green-700'
                          : log.status === 'failed'
                            ? 'bg-red-100 text-red-700'
                            : log.status === 'running'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {log.status}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <span>{new Date(log.startTime).toLocaleString()}</span>
                    {log.duration && (
                      <>
                        <span className="mx-2">•</span>
                        <span>{formatDuration(log.duration)}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="text-right space-y-1">
                  <div className="text-sm font-medium">
                    {log.filesProcessed} files
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {formatBytes(Number(log.bytesTransferred))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function BackupLogsPage() {
  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Backup Logs</h1>
        <p className="text-muted-foreground">
          View the history of all backup executions
        </p>
      </div>
      <Suspense fallback={<div>Loading...</div>}>
        <BackupLogsList />
      </Suspense>
    </div>
  );
}
