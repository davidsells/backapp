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
  const [showAgentInstructions, setShowAgentInstructions] = useState<string | null>(null);

  const triggerBackup = async (configId: string, configName: string, executionMode: ExecutionMode) => {
    setError('');
    setSuccess('');

    // For agent-based backups, show instructions instead of executing
    if (executionMode === 'agent') {
      setShowAgentInstructions(configName);
      return;
    }

    // Server-side backup execution
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

      {showAgentInstructions && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
          <div className="flex justify-between items-start mb-2">
            <h4 className="font-semibold text-blue-900">How to Run Agent-Based Backup</h4>
            <button
              onClick={() => setShowAgentInstructions(null)}
              className="text-blue-600 hover:text-blue-800"
            >
              ✕
            </button>
          </div>
          <p className="text-blue-800 text-sm mb-3">
            To run backup &quot;{showAgentInstructions}&quot;, execute this command on the agent machine:
          </p>
          <div className="bg-blue-900 text-blue-50 p-3 rounded font-mono text-sm mb-2">
            cd /path/to/agent && npm run manual
          </div>
          <p className="text-blue-700 text-xs">
            💡 Tip: For scheduled backups, set up a cron job to run <code className="bg-blue-100 px-1 rounded">npm start</code> at regular intervals.
          </p>
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
                {isRunning && (
                  <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700">
                    Running...
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
              </div>

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
                disabled={isRunning || (config.executionMode === 'agent' && config.agent?.status !== 'online')}
                size="sm"
                variant="default"
                title={
                  config.executionMode === 'agent' && config.agent?.status !== 'online'
                    ? 'Agent must be online to run backup'
                    : config.executionMode === 'agent'
                    ? 'Show instructions to run backup on agent'
                    : 'Run backup now'
                }
              >
                {isRunning ? 'Running...' : config.executionMode === 'agent' ? 'How to Run' : 'Run Now'}
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
