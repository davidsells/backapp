'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface PendingRequest {
  id: string;
  configId: string;
  configName: string;
  startTime: string;
  minutesWaiting: number;
  agentStatus: string | null;
  agentLastSeen: string | null;
}

interface MissingBackup {
  id: string;
  configId: string;
  configName: string;
  s3Path: string | null;
  startTime: string;
  status: string;
}

export function BackupStatusDashboard() {
  const [requestedCount, setRequestedCount] = useState(0);
  const [runningCount, setRunningCount] = useState(0);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);

  const [reconciliationData, setReconciliationData] = useState<{
    totalCompleted: number;
    verified: number;
    missing: number;
    missingLogs: MissingBackup[];
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeoutMinutes, setTimeoutMinutes] = useState(30);

  const loadRequestStatus = async () => {
    try {
      const response = await fetch('/api/backups/requests');
      const data = await response.json();

      if (data.success) {
        setRequestedCount(data.status.requested);
        setRunningCount(data.status.running);
        setPendingRequests(data.status.pendingRequests);
      }
    } catch (err) {
      console.error('Failed to load request status:', err);
    }
  };

  const loadReconciliation = async () => {
    try {
      const response = await fetch('/api/backups/reconcile');
      const data = await response.json();

      if (data.success) {
        setReconciliationData(data.reconciliation);
      }
    } catch (err) {
      console.error('Failed to load reconciliation data:', err);
    }
  };

  useEffect(() => {
    loadRequestStatus();
    loadReconciliation();

    // Refresh every 30 seconds
    const interval = setInterval(() => {
      loadRequestStatus();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const handleTimeoutStaleRequests = async () => {
    if (!confirm(`Timeout all backup requests older than ${timeoutMinutes} minutes?`)) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/backups/requests?timeoutMinutes=${timeoutMinutes}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        alert(`${data.result.timedOut} stale request(s) timed out`);
        await loadRequestStatus();
      } else {
        setError(data.error || 'Failed to timeout requests');
      }
    } catch (err) {
      setError('Failed to timeout stale requests');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFixUnverifiedBackups = async () => {
    if (!reconciliationData || reconciliationData.missingLogs.length === 0) {
      return;
    }

    if (!confirm(`Mark ${reconciliationData.missingLogs.length} unverified backup(s) as failed?`)) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/backups/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logIds: reconciliationData.missingLogs.map(log => log.id),
        }),
      });

      const data = await response.json();

      if (data.success) {
        alert(`${data.updated} backup(s) marked as failed`);
        await loadReconciliation();
      } else {
        setError(data.error || 'Failed to fix backups');
      }
    } catch (err) {
      setError('Failed to fix unverified backups');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Error Display */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-md">
          {error}
        </div>
      )}

      {/* Request Status */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Requested Backups</CardDescription>
            <CardTitle className="text-3xl">{requestedCount}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Waiting for agent to pick up
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Running Backups</CardDescription>
            <CardTitle className="text-3xl">{runningCount}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Currently in progress
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Pending Requests */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Pending Backup Requests</CardTitle>
              <CardDescription>
                Backups waiting for agent execution
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Timeout after:</label>
              <input
                type="number"
                value={timeoutMinutes}
                onChange={(e) => setTimeoutMinutes(parseInt(e.target.value) || 30)}
                className="w-20 p-2 border rounded"
                min="1"
                max="1440"
              />
              <span className="text-sm">min</span>
              <Button
                onClick={handleTimeoutStaleRequests}
                disabled={loading || pendingRequests.length === 0}
                variant="outline"
                size="sm"
              >
                Timeout Stale
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {pendingRequests.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              No pending backup requests
            </p>
          ) : (
            <div className="space-y-2">
              {pendingRequests.map((request) => (
                <div
                  key={request.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">{request.configName}</p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                      <span>Waiting {request.minutesWaiting} min</span>
                      <span>•</span>
                      <span>Agent: {request.agentStatus || 'unknown'}</span>
                      {request.agentLastSeen && (
                        <>
                          <span>•</span>
                          <span>
                            Last seen: {new Date(request.agentLastSeen).toLocaleString()}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {request.minutesWaiting > 30 && (
                      <span className="text-xs px-2 py-1 rounded bg-yellow-100 text-yellow-700">
                        Stale
                      </span>
                    )}
                    {request.agentStatus === 'offline' && (
                      <span className="text-xs px-2 py-1 rounded bg-red-100 text-red-700">
                        Agent Offline
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reconciliation */}
      {reconciliationData && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>S3 Backup Verification</CardTitle>
                <CardDescription>
                  Reconciliation of database logs with S3 storage
                </CardDescription>
              </div>
              <Button onClick={loadReconciliation} variant="outline" size="sm">
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3 mb-6">
              <div className="p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground">Total Completed</p>
                <p className="text-2xl font-bold">{reconciliationData.totalCompleted}</p>
              </div>
              <div className="p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground">Verified in S3</p>
                <p className="text-2xl font-bold text-green-600">{reconciliationData.verified}</p>
              </div>
              <div className="p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground">Missing in S3</p>
                <p className="text-2xl font-bold text-red-600">{reconciliationData.missing}</p>
              </div>
            </div>

            {reconciliationData.missing > 0 && (
              <>
                <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-md">
                  <p className="font-semibold">Warning: Unverified Backups Found</p>
                  <p className="text-sm mt-1">
                    {reconciliationData.missing} backup(s) are marked as completed in the database
                    but the files were not found in S3. This may indicate upload failures.
                  </p>
                </div>

                <div className="space-y-2 mb-4">
                  {reconciliationData.missingLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between p-3 border rounded-lg bg-red-50"
                    >
                      <div>
                        <p className="font-medium text-sm">{log.configName}</p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                          <span>{new Date(log.startTime).toLocaleString()}</span>
                          {log.s3Path && (
                            <>
                              <span>•</span>
                              <span className="font-mono">{log.s3Path}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <span className="text-xs px-2 py-1 rounded bg-red-100 text-red-700">
                        File Not Found
                      </span>
                    </div>
                  ))}
                </div>

                <Button
                  onClick={handleFixUnverifiedBackups}
                  disabled={loading}
                  variant="destructive"
                >
                  Mark Unverified Backups as Failed
                </Button>
              </>
            )}

            {reconciliationData.missing === 0 && reconciliationData.totalCompleted > 0 && (
              <div className="text-center py-8">
                <p className="text-green-600 font-semibold">✓ All completed backups verified in S3</p>
                <p className="text-sm text-muted-foreground mt-1">
                  All {reconciliationData.verified} backup file(s) found in storage
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
