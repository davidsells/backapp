import { Suspense } from 'react';
import Link from 'next/link';
import { auth } from '@/lib/auth/auth';
import { redirect } from 'next/navigation';
import { getBackupService } from '@/lib/backup/backup-service';
import { Button } from '@/components/ui/button';
import { BackupLogsView } from '@/components/backup/backup-logs-view';

async function BackupLogsList() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const backupService = getBackupService();
  const logs = await backupService.getRecentLogs(session.user.id, 100);

  return <BackupLogsView logs={logs} />;
}

export default function BackupLogsPage() {
  return (
    <div className="container mx-auto py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Backup Logs</h1>
          <p className="text-muted-foreground">
            View detailed history of all backup executions
          </p>
        </div>
        <Link href="/backups">
          <Button variant="outline">← Back to Backups</Button>
        </Link>
      </div>
      <Suspense fallback={<div>Loading backup logs...</div>}>
        <BackupLogsList />
      </Suspense>
    </div>
  );
}
