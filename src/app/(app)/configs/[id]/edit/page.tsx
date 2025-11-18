import { Suspense } from 'react';
import Link from 'next/link';
import { auth } from '@/lib/auth/auth';
import { redirect, notFound } from 'next/navigation';
import { getBackupService } from '@/lib/backup/backup-service';
import { Button } from '@/components/ui/button';
import { BackupConfigForm } from '@/components/backup/backup-config-form';

async function EditConfigForm({ configId }: { configId: string }) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const backupService = getBackupService();
  const config = await backupService.getConfig(configId, session.user.id);

  if (!config) {
    notFound();
  }

  // Transform the config data to match the form's expected format
  const initialData = {
    name: config.name,
    enabled: config.enabled,
    executionMode: config.executionMode,
    agentId: config.agentId || '',
    sources: config.sources.map(source => ({
      ...source,
      excludePatterns: source.excludePatterns || [],
      includePatterns: source.includePatterns || [],
    })),
    destination: {
      bucket: config.destination.bucket,
      region: config.destination.region,
      prefix: config.destination.prefix || 'backups',
      endpoint: config.destination.endpoint || '',
    },
    schedule: config.schedule || undefined,
    options: config.options,
  };

  return <BackupConfigForm initialData={initialData as any} configId={configId} />;
}

export default function EditConfigPage({ params }: { params: { id: string } }) {
  return (
    <div className="container mx-auto py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Edit Configuration</h1>
          <p className="text-muted-foreground">
            Update your backup configuration settings
          </p>
        </div>
        <Link href={`/configs/${params.id}`}>
          <Button variant="outline">← Back to Configuration</Button>
        </Link>
      </div>
      <Suspense fallback={<div>Loading...</div>}>
        <EditConfigForm configId={params.id} />
      </Suspense>
    </div>
  );
}
