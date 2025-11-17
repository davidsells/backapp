import { Suspense } from 'react';
import Link from 'next/link';
import { auth } from '@/lib/auth/auth';
import { redirect } from 'next/navigation';
import { getBackupService } from '@/lib/backup/backup-service';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertBanner } from '@/components/alerts/alert-banner';
import { BackupProgressMonitor } from '@/components/backups/backup-progress-monitor';

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
  const stats = await backupService.getStats(session.user.id);

  return (
    <div className="space-y-6">
      {/* Alert Banner */}
      <AlertBanner />

      {/* Live Backup Progress */}
      <BackupProgressMonitor userId={session.user.id} />

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

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Manage your backup system</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Link href="/configs" className="block">
              <div className="p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                <h3 className="font-semibold mb-2">Manage Configurations</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Create and edit backup job configurations
                </p>
                <Button variant="outline" size="sm">View Configurations</Button>
              </div>
            </Link>
            <Link href="/backups/status" className="block">
              <div className="p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                <h3 className="font-semibold mb-2">Backup Status</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Monitor requests and verify S3 backups
                </p>
                <Button variant="outline" size="sm">View Status</Button>
              </div>
            </Link>
            <Link href="/reports" className="block">
              <div className="p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                <h3 className="font-semibold mb-2">View Reports</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Generate detailed backup analytics and reports
                </p>
                <Button variant="outline" size="sm">View Reports</Button>
              </div>
            </Link>
            <Link href="/backups/logs" className="block">
              <div className="p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                <h3 className="font-semibold mb-2">View All Logs</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Browse complete backup execution history
                </p>
                <Button variant="outline" size="sm">View Logs</Button>
              </div>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function BackupsPage() {
  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Backup Execution</h1>
        <p className="text-muted-foreground">
          Monitor backup execution status, history, and performance
        </p>
      </div>
      <Suspense fallback={<div>Loading...</div>}>
        <BackupsList />
      </Suspense>
    </div>
  );
}
