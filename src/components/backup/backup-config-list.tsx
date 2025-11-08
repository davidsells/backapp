'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { BackupConfigWithAgent, ExecutionMode } from '@/lib/types/backup.types';

interface BackupConfigListProps {
  configs: BackupConfigWithAgent[];
}

export function BackupConfigList({ configs }: BackupConfigListProps) {
  const router = useRouter();
  const [runningBackups, setRunningBackups] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  const triggerBackup = async (configId: string, configName: string, executionMode: ExecutionMode) => {
    setError('');
    setSuccess('');
    setRunningBackups(prev => new Set(prev).add(configId));

    try {
      // Use the unified request endpoint for both execution modes
      const res = await fetch('/api/backups/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configId }),
      });

      const data = await res.json();

      if (data.success) {
        if (executionMode === 'agent') {
          setSuccess(`Backup "${configName}" requested. Agent will execute within 10 minutes.`);
        } else {
          setSuccess(`Backup "${configName}" started successfully!`);
        }
        router.refresh();
      } else {
        setError(data.error || 'Failed to request backup');
      }
    } catch (err) {
      setError('Failed to request backup');
    } finally {
      setRunningBackups(prev => {
        const next = new Set(prev);
        next.delete(configId);
        return next;
      });
    }
  };

  const getExecutionModeBadge = (mode: ExecutionMode) => {
    return mode === 'agent' ? (
      <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700 font-medium">
        Agent-Based
      </span>
    ) : (
      <span className="text-xs px-2 py-1 rounded bg-purple-100 text-purple-700 font-medium">
        Server-Side
      </span>
    );
  };

  const getAgentStatusIndicator = (status: string) => {
    switch (status) {
      case 'online':
        return '🟢';
      case 'offline':
        return '🔴';
      case 'error':
        return '⚠️';
      default:
        return '⚫';
    }
  };

  const getScheduleDescription = (schedule?: { cronExpression: string } | null) => {
    if (!schedule?.cronExpression) return 'Manual-only';

    const cron = schedule.cronExpression;
    if (cron === '0 2 * * *') return 'Daily at 2 AM';
    if (cron === '0 0 * * 0') return 'Weekly';
    if (cron === '0 0 1 * *') return 'Monthly';

    return cron;
  };

  const getTimeSince = (date: Date | null | undefined) => {
    if (!date) return null;
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'just now';
    if (diffMins === 1) return '1 minute ago';
    if (diffMins < 60) return `${diffMins} minutes ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours === 1) return '1 hour ago';
    if (diffHours < 24) return `${diffHours} hours ago`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return '1 day ago';
    return `${diffDays} days ago`;
  };

  const isPendingRequest = (config: BackupConfigWithAgent) => {
    if (!config.requestedAt) return false;
    const now = new Date();
    const requestTime = new Date(config.requestedAt);
    const ageMinutes = (now.getTime() - requestTime.getTime()) / 60000;
    // Consider it timed out after 20 minutes (2x the expected 10 min window)
    return ageMinutes < 20;
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
            className="flex items-center justify-between p-4 border rounded-lg hover:shadow-md transition-shadow"
          >
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
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
                {getExecutionModeBadge(config.executionMode)}
                {!config.schedule && (
                  <span className="text-xs px-2 py-1 rounded bg-purple-100 text-purple-700">
                    Manual-only
                  </span>
                )}
                {isPendingRequest(config) && (
                  <span className="text-xs px-2 py-1 rounded bg-orange-100 text-orange-700 animate-pulse">
                    ⏳ Requested {getTimeSince(config.requestedAt)}
                  </span>
                )}
                {isRunning && (
                  <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700">
                    Requesting...
                  </span>
                )}
              </div>

              {/* Configuration details */}
              <div className="text-sm text-muted-foreground">
                <span>{config.sources.length} source(s)</span>
                <span className="mx-2">•</span>

                {/* Agent-based info */}
                {config.executionMode === 'agent' && config.agent && (
                  <>
                    <span>
                      Agent: {config.agent.name} {getAgentStatusIndicator(config.agent.status)}
                    </span>
                    <span className="mx-2">•</span>
                  </>
                )}

                {/* Server-side info */}
                {config.executionMode === 'server' && (
                  <>
                    <span>{config.destination.bucket}</span>
                    <span className="mx-2">•</span>
                  </>
                )}

                <span>{getScheduleDescription(config.schedule)}</span>

                {/* Last run info */}
                {config.lastRunAt && (
                  <>
                    <span className="mx-2">•</span>
                    <span>Last run: {getTimeSince(config.lastRunAt)}</span>
                  </>
                )}
              </div>

              {/* Pending request timeout warning */}
              {config.requestedAt && !isPendingRequest(config) && (
                <div className="bg-red-50 border border-red-200 text-red-800 px-3 py-2 rounded text-sm">
                  ⏰ Backup request timed out (requested {getTimeSince(config.requestedAt)}).
                  Agent may not be running. Try clicking &quot;Run Now&quot; again.
                </div>
              )}

              {/* Agent-specific warnings */}
              {config.executionMode === 'agent' && config.agent && config.agent.status !== 'online' && (
                <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-3 py-2 rounded text-sm">
                  {config.agent.status === 'offline' && (
                    <>⚠️ Agent is offline. Scheduled backups will not run.</>
                  )}
                  {config.agent.status === 'error' && (
                    <>⚠️ Agent has errors. Please check agent status.</>
                  )}
                </div>
              )}

              {config.executionMode === 'agent' && !config.agent && (
                <div className="bg-red-50 border border-red-200 text-red-800 px-3 py-2 rounded text-sm">
                  ❌ Agent not found. Please update configuration.
                </div>
              )}
            </div>

            <div className="flex gap-2 ml-4">
              <Button
                onClick={() => triggerBackup(config.id, config.name, config.executionMode)}
                disabled={isRunning}
                size="sm"
                variant="default"
                title={
                  config.executionMode === 'agent'
                    ? 'Request backup (agent will execute within 10 minutes)'
                    : 'Run backup now'
                }
              >
                {isRunning ? 'Requesting...' : 'Run Now'}
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
