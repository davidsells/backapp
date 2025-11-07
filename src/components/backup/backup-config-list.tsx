'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface BackupConfig {
  id: string;
  name: string;
  enabled: boolean;
  sources: Array<{ path: string }>;
  destination: { bucket: string };
  schedule?: { cronExpression: string } | null;
}

interface BackupConfigListProps {
  configs: BackupConfig[];
}

export function BackupConfigList({ configs }: BackupConfigListProps) {
  const router = useRouter();
  const [runningBackups, setRunningBackups] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  const triggerBackup = async (configId: string, configName: string) => {
    setError('');
    setSuccess('');
    setRunningBackups(prev => new Set(prev).add(configId));

    try {
      const res = await fetch('/api/backups/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configId }),
      });

      const data = await res.json();

      if (data.success) {
        setSuccess(`Backup "${configName}" started successfully!`);
        // Refresh the page to show updated stats/logs
        router.refresh();
      } else {
        setError(data.error || 'Failed to start backup');
      }
    } catch (err) {
      setError('Failed to start backup');
    } finally {
      setRunningBackups(prev => {
        const next = new Set(prev);
        next.delete(configId);
        return next;
      });
    }
  };

  if (configs.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">No backup configurations yet</p>
        <Link href="/backups/new">
          <Button>Create Your First Backup</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-md text-green-700">
          {success}
        </div>
      )}

      {configs.map((config) => {
        const isRunning = runningBackups.has(config.id);

        return (
          <div
            key={config.id}
            className="flex items-center justify-between p-4 border rounded-lg"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">{config.name}</h3>
                <span
                  className={`text-xs px-2 py-1 rounded ${
                    config.enabled
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {config.enabled ? 'Enabled' : 'Disabled'}
                </span>
                {!config.schedule && (
                  <span className="text-xs px-2 py-1 rounded bg-purple-100 text-purple-700">
                    Manual-only
                  </span>
                )}
                {isRunning && (
                  <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700">
                    Running...
                  </span>
                )}
              </div>
              <div className="text-sm text-muted-foreground">
                <span>{config.sources.length} source(s)</span>
                <span className="mx-2">•</span>
                <span>{config.destination.bucket}</span>
                <span className="mx-2">•</span>
                <span>{config.schedule ? config.schedule.cronExpression : 'Manual trigger only'}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => triggerBackup(config.id, config.name)}
                disabled={isRunning}
                size="sm"
                variant="default"
              >
                {isRunning ? 'Running...' : 'Run Now'}
              </Button>
              <Link href={`/backups/${config.id}`}>
                <Button variant="outline" size="sm">
                  View
                </Button>
              </Link>
              <Link href={`/backups/${config.id}/edit`}>
                <Button variant="outline" size="sm">
                  Edit
                </Button>
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}
