import { auth } from '@/lib/auth/auth';
import { redirect } from 'next/navigation';
import { BackupStatusDashboard } from '@/components/backup/backup-status-dashboard';

export default async function BackupStatusPage() {
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Backup Status & Validation</h1>
        <p className="text-muted-foreground">
          Monitor pending requests, verify S3 backups, and manage stale requests
        </p>
      </div>

      <BackupStatusDashboard />
    </div>
  );
}
