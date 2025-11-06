import { auth } from '@/lib/auth/auth';
import { redirect } from 'next/navigation';
import { BackupConfigForm } from '@/components/backup/backup-config-form';

export default async function NewBackupPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Create Backup Configuration</h1>
        <p className="text-muted-foreground">
          Set up a new automated backup schedule
        </p>
      </div>
      <BackupConfigForm />
    </div>
  );
}
