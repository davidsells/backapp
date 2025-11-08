'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

interface BackupStatus {
  id: string;
  configName: string;
  status: 'requested' | 'running' | 'completed' | 'failed' | 'timeout';
  startTime: Date;
  endTime?: Date;
  filesProcessed: number;
  bytesTransferred: number;
  duration?: number;
  errors?: any;
  elapsedSeconds: number;
  timedOut: boolean;
}

interface PendingBackup {
  logId: string;
  configName: string;
  requestedAt: Date;
}

const STORAGE_KEY = 'backapp_pending_backups';

export function BackupNotifications() {
  const [pendingBackups, setPendingBackups] = useState<Map<string, BackupStatus>>(new Map());

  // Load pending backups from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const pending: PendingBackup[] = JSON.parse(stored);
        // Start polling for each
        pending.forEach((p) => {
          pollBackupStatus(p.logId);
        });
      } catch (e) {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  // Save to localStorage whenever pendingBackups changes
  useEffect(() => {
    const pending: PendingBackup[] = Array.from(pendingBackups.values())
      .filter((b) => ['requested', 'running'].includes(b.status))
      .map((b) => ({
        logId: b.id,
        configName: b.configName,
        requestedAt: b.startTime,
      }));

    if (pending.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pending));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [pendingBackups]);

  const pollBackupStatus = async (logId: string) => {
    try {
      const res = await fetch(`/api/backups/status/${logId}`);
      if (!res.ok) {
        // Log not found or error - remove from pending
        setPendingBackups((prev) => {
          const next = new Map(prev);
          next.delete(logId);
          return next;
        });
        return;
      }

      const data = await res.json();
      if (data.success && data.log) {
        setPendingBackups((prev) => {
          const next = new Map(prev);
          next.set(logId, data.log);
          return next;
        });

        // Continue polling if still in progress
        if (['requested', 'running'].includes(data.log.status)) {
          setTimeout(() => pollBackupStatus(logId), 5000); // Poll every 5 seconds
        }
      }
    } catch (error) {
      console.error('Failed to poll backup status:', error);
    }
  };

  // Public method to add a new backup to track
  const trackBackup = (logId: string, configName: string) => {
    setPendingBackups((prev) => {
      const next = new Map(prev);
      next.set(logId, {
        id: logId,
        configName,
        status: 'requested',
        startTime: new Date(),
        filesProcessed: 0,
        bytesTransferred: 0,
        elapsedSeconds: 0,
        timedOut: false,
      });
      return next;
    });

    // Start polling
    pollBackupStatus(logId);
  };

  // Expose trackBackup method globally
  useEffect(() => {
    (window as any).trackBackupRequest = trackBackup;
    return () => {
      delete (window as any).trackBackupRequest;
    };
  }, []);

  const dismissBackup = (logId: string) => {
    setPendingBackups((prev) => {
      const next = new Map(prev);
      next.delete(logId);
      return next;
    });
  };

  const getStatusDisplay = (backup: BackupStatus) => {
    switch (backup.status) {
      case 'requested':
        return {
          color: 'bg-orange-50 border-orange-200',
          textColor: 'text-orange-800',
          icon: '⏳',
          message: `Requested ${backup.elapsedSeconds}s ago. Waiting for agent...`,
        };
      case 'running':
        return {
          color: 'bg-blue-50 border-blue-200',
          textColor: 'text-blue-800',
          icon: '⚙️',
          message: `Running for ${backup.elapsedSeconds}s...`,
        };
      case 'completed':
        const sizeMB = (backup.bytesTransferred / 1024 / 1024).toFixed(2);
        return {
          color: 'bg-green-50 border-green-200',
          textColor: 'text-green-800',
          icon: '✅',
          message: `Completed! ${sizeMB} MB backed up in ${backup.duration || backup.elapsedSeconds}s`,
        };
      case 'failed':
        return {
          color: 'bg-red-50 border-red-200',
          textColor: 'text-red-800',
          icon: '❌',
          message: `Failed: ${backup.errors?.[0] || 'Unknown error'}`,
        };
      case 'timeout':
        return {
          color: 'bg-yellow-50 border-yellow-200',
          textColor: 'text-yellow-800',
          icon: '⏰',
          message: `Timed out after ${Math.floor(backup.elapsedSeconds / 60)} minutes. Agent may not be running.`,
        };
      default:
        return {
          color: 'bg-gray-50 border-gray-200',
          textColor: 'text-gray-800',
          icon: '•',
          message: 'Unknown status',
        };
    }
  };

  const backupsArray = Array.from(pendingBackups.values());

  if (backupsArray.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-md">
      {backupsArray.map((backup) => {
        const display = getStatusDisplay(backup);
        return (
          <div
            key={backup.id}
            className={`p-4 border rounded-lg shadow-lg ${display.color} ${display.textColor} animate-slideIn`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{display.icon}</span>
                  <span className="font-semibold">{backup.configName}</span>
                </div>
                <p className="text-sm">{display.message}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => dismissBackup(backup.id)}
                className="ml-2 hover:bg-white/50"
              >
                ✕
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
