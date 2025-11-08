'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Report {
  period: {
    start: string;
    end: string;
    type: string;
  };
  summary: {
    totalBackups: number;
    successfulBackups: number;
    failedBackups: number;
    successRate: number;
    totalDataTransferred: number;
    totalFilesProcessed: number;
    averageDuration: number;
  };
  backups: Array<{
    id: string;
    configName: string;
    startTime: string;
    status: string;
    filesProcessed: number;
    bytesTransferred: number;
    duration: number | null;
  }>;
  configs: Array<{
    id: string;
    name: string;
    backupCount: number;
    successCount: number;
    lastBackup: string | null;
  }>;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return 'N/A';
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  return `${minutes}m ${seconds % 60}s`;
}

export default function ReportsPage() {
  const [period, setPeriod] = useState<string>('weekly');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generateReport = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/reports?period=${period}`);
      const data = await res.json();

      if (data.success) {
        setReport(data.report);
      } else {
        setError(data.error || 'Failed to generate report');
      }
    } catch (err) {
      setError('Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const downloadReport = () => {
    if (!report) return;

    const dataStr = JSON.stringify(report, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = `backup-report-${period}-${new Date().toISOString().split('T')[0]}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Backup Reports</h1>
          <p className="text-muted-foreground">
            Generate and download backup activity reports
          </p>
        </div>
        <Link href="/backups">
          <Button variant="outline">← Back to Backups</Button>
        </Link>
      </div>

      <div className="space-y-6">
        {/* Report Generator */}
        <Card>
          <CardHeader>
            <CardTitle>Generate Report</CardTitle>
            <CardDescription>Select a time period to generate a backup activity report</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="daily">Last 24 Hours</option>
                <option value="weekly">Last 7 Days</option>
                <option value="monthly">Last 30 Days</option>
              </select>

              <Button onClick={generateReport} disabled={loading}>
                {loading ? 'Generating...' : 'Generate Report'}
              </Button>

              {report && (
                <Button onClick={downloadReport} variant="outline">
                  Download JSON
                </Button>
              )}
            </div>

            {error && (
              <div className="mt-4 p-3 bg-red-50 text-red-800 rounded-md text-sm">
                {error}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Report Display */}
        {report && (
          <>
            {/* Summary Statistics */}
            <Card>
              <CardHeader>
                <CardTitle>Summary</CardTitle>
                <CardDescription>
                  {new Date(report.period.start).toLocaleDateString()} - {new Date(report.period.end).toLocaleDateString()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Total Backups</p>
                    <p className="text-2xl font-bold">{report.summary.totalBackups}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Success Rate</p>
                    <p className="text-2xl font-bold text-green-600">{report.summary.successRate.toFixed(1)}%</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Data Transferred</p>
                    <p className="text-2xl font-bold">{formatBytes(report.summary.totalDataTransferred)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Avg Duration</p>
                    <p className="text-2xl font-bold">{formatDuration(report.summary.averageDuration)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Configurations */}
            <Card>
              <CardHeader>
                <CardTitle>Backup Configurations</CardTitle>
                <CardDescription>Performance by backup configuration</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {report.configs.map((config) => (
                    <div key={config.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{config.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {config.successCount} / {config.backupCount} successful
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          {((config.successCount / config.backupCount) * 100).toFixed(0)}% success
                        </p>
                        {config.lastBackup && (
                          <p className="text-xs text-muted-foreground">
                            Last: {new Date(config.lastBackup).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Backup History */}
            <Card>
              <CardHeader>
                <CardTitle>Backup History</CardTitle>
                <CardDescription>All backups in this period ({report.backups.length} total)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {report.backups.slice(0, 20).map((backup) => (
                    <div key={backup.id} className="flex items-center justify-between p-3 border rounded-lg text-sm">
                      <div className="flex-1">
                        <p className="font-medium">{backup.configName}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(backup.startTime).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-4 text-xs">
                        <span className={`px-2 py-1 rounded ${
                          backup.status === 'completed' ? 'bg-green-100 text-green-700' :
                          backup.status === 'failed' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {backup.status}
                        </span>
                        <span>{formatBytes(backup.bytesTransferred)}</span>
                        <span>{formatDuration(backup.duration)}</span>
                      </div>
                    </div>
                  ))}
                  {report.backups.length > 20 && (
                    <p className="text-center text-sm text-muted-foreground pt-2">
                      Showing 20 of {report.backups.length} backups. Download JSON for full report.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
