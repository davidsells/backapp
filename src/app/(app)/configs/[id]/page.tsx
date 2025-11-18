import { Suspense } from 'react';
import Link from 'next/link';
import { auth } from '@/lib/auth/auth';
import { redirect, notFound } from 'next/navigation';
import { getBackupService } from '@/lib/backup/backup-service';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { S3BackupBrowser } from '@/components/storage/s3-backup-browser';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'completed':
      return 'bg-green-100 text-green-700';
    case 'failed':
      return 'bg-red-100 text-red-700';
    case 'running':
      return 'bg-blue-100 text-blue-700';
    case 'requested':
      return 'bg-orange-100 text-orange-700';
    default:
      return 'bg-gray-100 text-gray-700';
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

async function ConfigDetails({ configId }: { configId: string }) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const backupService = getBackupService();

  // Fetch configuration
  const config = await backupService.getConfig(configId, session.user.id);
  if (!config) {
    notFound();
  }

  // Fetch recent backup logs for this config
  const logs = await backupService.getConfigLogs(configId, session.user.id, 10);

  return (
    <div className="space-y-6">
      {/* Configuration Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{config.name}</CardTitle>
              <CardDescription>
                Configuration Details
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Link href={`/configs/${config.id}/edit`}>
                <Button>Edit Configuration</Button>
              </Link>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Status</p>
              <p className="text-lg">
                <span
                  className={`text-xs px-2 py-1 rounded ${
                    config.enabled
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {config.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Execution Mode</p>
              <p className="text-lg">
                <span className={`text-xs px-2 py-1 rounded ${
                  config.executionMode === 'agent'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-purple-100 text-purple-700'
                }`}>
                  {config.executionMode === 'agent' ? 'Agent-Based' : 'Server-Side'}
                </span>
              </p>
            </div>
            {config.executionMode === 'agent' && config.agentId && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Agent ID</p>
                <p className="text-lg font-mono text-sm">{config.agentId}</p>
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-muted-foreground">Created</p>
              <p className="text-lg">{new Date(config.createdAt).toLocaleString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Source Paths */}
      <Card>
        <CardHeader>
          <CardTitle>Source Paths</CardTitle>
          <CardDescription>Directories and files to backup</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {config.sources.map((source: any, idx: number) => (
              <div key={idx} className="border rounded-lg p-4">
                <p className="font-medium mb-2">{source.path}</p>
                {source.includePatterns && source.includePatterns.length > 0 && (
                  <div className="text-sm text-muted-foreground mb-1">
                    <span className="font-medium">Include:</span> {source.includePatterns.join(', ')}
                  </div>
                )}
                {source.excludePatterns && source.excludePatterns.length > 0 && (
                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium">Exclude:</span> {source.excludePatterns.join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Destination */}
      <Card>
        <CardHeader>
          <CardTitle>Destination</CardTitle>
          <CardDescription>S3 storage configuration</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Bucket</p>
              <p className="text-lg font-mono">{config.destination.bucket}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Region</p>
              <p className="text-lg">{config.destination.region}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Prefix</p>
              <p className="text-lg font-mono">{config.destination.prefix}</p>
            </div>
            {config.destination.endpoint && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Endpoint</p>
                <p className="text-lg font-mono">{config.destination.endpoint}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Schedule */}
      {config.schedule && (
        <Card>
          <CardHeader>
            <CardTitle>Schedule</CardTitle>
            <CardDescription>Automated backup schedule</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Cron Expression</p>
                <p className="text-lg font-mono">{config.schedule.cronExpression}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Timezone</p>
                <p className="text-lg">{config.schedule.timezone}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Options */}
      <Card>
        <CardHeader>
          <CardTitle>Backup Options</CardTitle>
          <CardDescription>Compression, encryption, and retention settings</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Type</p>
              <p className="text-lg capitalize">{config.options.type}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Compression</p>
              <p className="text-lg">
                {config.options.compression ? `Yes (Level ${config.options.compressionLevel})` : 'No'}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Encryption</p>
              <p className="text-lg">{config.options.encryption ? 'Yes' : 'No'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Retention</p>
              <p className="text-lg">{config.options.retentionDays} days</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Backups */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent Backup Executions</CardTitle>
              <CardDescription>Last 10 backup executions for this configuration</CardDescription>
            </div>
            <Link href="/backups/logs">
              <Button variant="outline" size="sm">View All Logs</Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No backup history yet</p>
          ) : (
            <div className="space-y-2">
              {logs.map((log: any) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <span className={`text-xs px-2 py-1 rounded font-medium ${getStatusColor(log.status)}`}>
                      {getStatusIcon(log.status)} {log.status}
                    </span>
                    <span className="text-sm">{new Date(log.startTime).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{log.filesProcessed || 0} files</span>
                    <span>{formatBytes(Number(log.bytesTransferred || 0))}</span>
                    {log.duration && <span>{Math.round(log.duration / 60)}m</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* S3 Backup Files */}
      {config.executionMode === 'agent' && config.agentId && (
        <S3BackupBrowser
          userId={session.user.id}
          agentId={config.agentId}
          configId={config.id}
          title="S3 Backup Files for this Configuration"
        />
      )}
    </div>
  );
}

export default function ConfigPage({ params }: { params: { id: string } }) {
  return (
    <div className="container mx-auto py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Configuration Details</h1>
          <p className="text-muted-foreground">
            View configuration settings and backup history
          </p>
        </div>
        <Link href="/configs">
          <Button variant="outline">← Back to Configurations</Button>
        </Link>
      </div>
      <Suspense fallback={<div>Loading...</div>}>
        <ConfigDetails configId={params.id} />
      </Suspense>
    </div>
  );
}
