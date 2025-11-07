import { Suspense } from 'react';
import Link from 'next/link';
import { auth } from '@/lib/auth/auth';
import { redirect } from 'next/navigation';
import { getBackupService } from '@/lib/backup/backup-service';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BackupConfigList } from '@/components/backup/backup-config-list';

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
      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Configs</CardDescription>
            <CardTitle className="text-3xl">{stats.totalConfigs}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active Configs</CardDescription>
            <CardTitle className="text-3xl">{stats.activeConfigs}</CardTitle>
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
      </div>

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
                <Button variant="outline">View Logs</Button>
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
