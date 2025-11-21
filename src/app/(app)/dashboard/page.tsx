'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface BackupStats {
  totalConfigs: number;
  activeConfigs: number;
  totalBackups: number;
  completedBackups: number;
  failedBackups: number;
  successRate: number;
  totalBytesTransferred: number;
  totalFilesProcessed: number;
  recentActivity: Array<{
    id: string;
    startTime: string;
    endTime: string | null;
    status: string;
    config: { name: string };
  }>;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

function formatLastBackup(recentActivity: BackupStats['recentActivity']): string {
  if (!recentActivity || recentActivity.length === 0) {
    return 'Never';
  }

  const lastBackup = recentActivity[0];
  const time = lastBackup.endTime || lastBackup.startTime;
  const date = new Date(time);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export default function DashboardPage() {
  const [stats, setStats] = useState<BackupStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/backups/stats');
        const data = await response.json();

        if (data.success) {
          setStats(data.stats);
        } else {
          setError(data.error || 'Failed to load statistics');
        }
      } catch (err) {
        setError('Failed to load dashboard statistics');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const totalBackups = stats?.totalConfigs || 0;
  const storageUsed = stats?.totalBytesTransferred || 0;
  const successRate = stats?.successRate || 0;
  const lastBackup = stats ? formatLastBackup(stats.recentActivity) : 'Never';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your backup system
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-md">
          {error}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Backups
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-2xl font-bold text-muted-foreground">...</div>
            ) : (
              <>
                <div className="text-2xl font-bold">{totalBackups}</div>
                <p className="text-xs text-muted-foreground">
                  {totalBackups === 0 ? 'No backups configured yet' : `${stats?.activeConfigs || 0} active`}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Storage Used
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-2xl font-bold text-muted-foreground">...</div>
            ) : (
              <>
                <div className="text-2xl font-bold">{formatBytes(storageUsed)}</div>
                <p className="text-xs text-muted-foreground">
                  {storageUsed === 0 ? 'No data backed up yet' : `${stats?.totalFilesProcessed || 0} files processed`}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Success Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-2xl font-bold text-muted-foreground">...</div>
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {stats?.totalBackups ? `${successRate.toFixed(1)}%` : '-'}
                </div>
                <p className="text-xs text-muted-foreground">
                  {stats?.totalBackups
                    ? `${stats.completedBackups}/${stats.totalBackups} successful`
                    : 'No backups run yet'
                  }
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Last Backup
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-2xl font-bold text-muted-foreground">...</div>
            ) : (
              <>
                <div className="text-2xl font-bold">{lastBackup}</div>
                <p className="text-xs text-muted-foreground">
                  {lastBackup === 'Never' ? 'Configure your first backup' : stats?.recentActivity[0]?.config?.name || 'Latest backup'}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Getting Started</CardTitle>
          <CardDescription>
            Follow these steps to set up your first backup
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start space-x-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
              1
            </div>
            <div>
              <h3 className="font-semibold">Configure S3 Settings</h3>
              <p className="text-sm text-muted-foreground">
                Set up your Amazon S3 or S3-compatible storage credentials
              </p>
            </div>
          </div>
          <div className="flex items-start space-x-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
              2
            </div>
            <div>
              <h3 className="font-semibold">Create Backup Configuration</h3>
              <p className="text-sm text-muted-foreground">
                Define what files and directories you want to back up
              </p>
            </div>
          </div>
          <div className="flex items-start space-x-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
              3
            </div>
            <div>
              <h3 className="font-semibold">Schedule Your Backups</h3>
              <p className="text-sm text-muted-foreground">
                Set up automatic backups using cron expressions
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
