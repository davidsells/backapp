'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface OrphanedAgentWarningProps {
  configId: string;
  configName: string;
  orphanedAgentId?: string;
  onFixed?: () => void;
}

export function OrphanedAgentWarning({
  configId,
  configName,
  orphanedAgentId,
  onFixed,
}: OrphanedAgentWarningProps) {
  const [fixing, setFixing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFix = async () => {
    setFixing(true);
    setError(null);

    try {
      const response = await fetch(`/api/backups/configs/${configId}/fix-agent`, {
        method: 'POST',
      });

      const data = await response.json();

      if (data.success) {
        // Notify parent component
        onFixed?.();
        // Reload the page to show updated config
        window.location.reload();
      } else {
        setError(data.message || 'Failed to fix configuration');
      }
    } catch (err) {
      setError('Failed to fix configuration. Please try again.');
      console.error('Failed to fix orphaned agent reference:', err);
    } finally {
      setFixing(false);
    }
  };

  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <span className="text-2xl">❌</span>
        <div className="flex-1">
          <h3 className="font-semibold text-red-900 mb-1">Agent Not Found</h3>
          <p className="text-sm text-red-800 mb-3">
            This backup configuration is set to use an agent-based execution mode, but the
            referenced agent
            {orphanedAgentId && (
              <span className="font-mono text-xs"> (ID: {orphanedAgentId})</span>
            )}
            {' '}does not exist. It may have been deleted.
          </p>
          <p className="text-sm text-red-800 mb-3">
            Click the button below to automatically convert this configuration to server-side
            execution mode, or edit the configuration to select a different agent.
          </p>
          {error && (
            <p className="text-sm text-red-900 bg-red-100 border border-red-300 rounded px-3 py-2 mb-3">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              onClick={handleFix}
              disabled={fixing}
              size="sm"
              variant="destructive"
            >
              {fixing ? 'Fixing...' : 'Convert to Server-Side Mode'}
            </Button>
            <Button
              onClick={() => (window.location.href = `/configs/${configId}/edit`)}
              size="sm"
              variant="outline"
            >
              Edit Configuration
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
