import { Suspense } from 'react';
import Link from 'next/link';
import { auth } from '@/lib/auth/auth';
import { redirect } from 'next/navigation';
import { getBackupService } from '@/lib/backup/backup-service';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BackupConfigList } from '@/components/backup/backup-config-list';

async function ConfigsList() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const backupService = getBackupService();
  const configs = await backupService.listConfigs(session.user.id);

  return (
    <div className="space-y-6">
      {/* Configuration Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Configurations</CardDescription>
            <CardTitle className="text-3xl">{configs.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active Configurations</CardDescription>
            <CardTitle className="text-3xl">
              {configs.filter(c => c.enabled).length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Inactive Configurations</CardDescription>
            <CardTitle className="text-3xl">
              {configs.filter(c => !c.enabled).length}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Backup Configurations */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Backup Configurations</CardTitle>
              <CardDescription>Manage your backup job configurations and schedules</CardDescription>
            </div>
            <Link href="/backups/new">
              <Button>Create Configuration</Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {configs.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">No backup configurations yet</p>
              <Link href="/backups/new">
                <Button>Create Your First Configuration</Button>
              </Link>
            </div>
          ) : (
            <BackupConfigList configs={configs} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ConfigsPage() {
  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Backup Configurations</h1>
        <p className="text-muted-foreground">
          Create and manage backup job configurations and schedules
        </p>
      </div>
      <Suspense fallback={<div>Loading...</div>}>
        <ConfigsList />
      </Suspense>
    </div>
  );
}
