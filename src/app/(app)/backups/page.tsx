import { Suspense } from 'react';
import Link from 'next/link';
import { auth } from '@/lib/auth/auth';
import { redirect } from 'next/navigation';
import { getBackupService } from '@/lib/backup/backup-service';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BackupConfigList } from '@/components/backup/backup-config-list';
import { AlertBanner } from '@/components/alerts/alert-banner';

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

async function BackupsList() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const backupService = getBackupService();
  const configs = await backupService.listConfigs(session.user.id);
  const stats = await backupService.getStats(session.user.id);

  return (
    <div className="space-y-6">
      {/* Alert Banner */}
      <AlertBanner />

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Configs</CardDescription>
            <CardTitle className="text-3xl">{stats.totalConfigs}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Backups</CardDescription>
            <CardTitle className="text-3xl">{stats.totalBackups}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Success Rate</CardDescription>
            <CardTitle className="text-3xl">{stats.successRate.toFixed(1)}%</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Data Backed Up</CardDescription>
            <CardTitle className="text-2xl">{formatBytes(stats.totalBytesTransferred)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Files</CardDescription>
            <CardTitle className="text-3xl">{stats.totalFilesProcessed.toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Recent Activity */}
      {stats.recentActivity && stats.recentActivity.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest backup executions</CardDescription>
              </div>
              <Link href="/backups/logs">
                <Button variant="outline" size="sm">View All</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.recentActivity.map((log: any) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <span className={`text-xs px-2 py-1 rounded font-medium ${getStatusColor(log.status)}`}>
                      {getStatusIcon(log.status)} {log.status}
                    </span>
                    <span className="font-medium">{log.config?.name || 'Unknown'}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{formatBytes(Number(log.bytesTransferred))}</span>
                    <span>{new Date(log.startTime).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Backup Configurations */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Backup Configurations</CardTitle>
              <CardDescription>Manage your backup jobs and schedules</CardDescription>
            </div>
            <div className="flex gap-2">
              <Link href="/backups/logs">
                <Button variant="outline">View All Logs</Button>
              </Link>
              <Link href="/backups/new">
                <Button>Create Backup</Button>
              </Link>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <BackupConfigList configs={configs} />
        </CardContent>
      </Card>
    </div>
  );
}

export default function BackupsPage() {
  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Backups</h1>
        <p className="text-muted-foreground">
          Configure and manage your backup schedules
        </p>
      </div>
      <Suspense fallback={<div>Loading...</div>}>
        <BackupsList />
      </Suspense>
    </div>
  );
}
