'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface BackupSource {
  path: string;
  excludePatterns: string[];
  includePatterns: string[];
}

interface Agent {
  id: string;
  name: string;
  status: string;
  platform: string | null;
}

interface FormData {
  name: string;
  enabled: boolean;
  executionMode: 'agent' | 'server';
  agentId: string;
  sources: BackupSource[];
  destination: {
    bucket: string;
    region: string;
    prefix: string;
    endpoint: string;
  };
  schedule?: {
    cronExpression: string;
    timezone: string;
  };
  options: {
    type: 'full' | 'incremental';
    compression: boolean;
    compressionLevel: number;
    encryption: boolean;
    retentionDays: number;
  };
}

export function BackupConfigForm({ initialData }: { initialData?: Partial<FormData> }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [useSchedule, setUseSchedule] = useState(!!initialData?.schedule);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(true);

  const [formData, setFormData] = useState<FormData>({
    name: initialData?.name || '',
    enabled: initialData?.enabled ?? true,
    executionMode: initialData?.executionMode || 'agent',
    agentId: initialData?.agentId || '',
    sources: initialData?.sources || [{ path: '', excludePatterns: [], includePatterns: [] }],
    destination: {
      bucket: initialData?.destination?.bucket || '',
      region: initialData?.destination?.region || 'us-east-1',
      prefix: initialData?.destination?.prefix || 'backups',
      endpoint: initialData?.destination?.endpoint || '',
    },
    schedule: initialData?.schedule || {
      cronExpression: '0 2 * * *',
      timezone: 'UTC',
    },
    options: {
      type: initialData?.options?.type || 'full',
      compression: initialData?.options?.compression ?? true,
      compressionLevel: initialData?.options?.compressionLevel || 6,
      encryption: initialData?.options?.encryption ?? false,
      retentionDays: initialData?.options?.retentionDays || 30,
    },
  });

  // Fetch agents on mount
  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const res = await fetch('/api/agents');
        if (res.ok) {
          const data = await res.json();
          setAgents(data.agents || []);
        }
      } catch (err) {
        console.error('Failed to fetch agents:', err);
      } finally {
        setLoadingAgents(false);
      }
    };

    fetchAgents();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Validate agent selection for agent-based mode
      if (formData.executionMode === 'agent' && !formData.agentId) {
        throw new Error('Please select an agent for agent-based backups');
      }

      // Prepare submission data based on execution mode
      const submitData: Record<string, unknown> = {
        name: formData.name,
        enabled: formData.enabled,
        executionMode: formData.executionMode,
        sources: formData.sources,
        schedule: useSchedule ? formData.schedule : undefined,
        options: formData.options,
      };

      // Add mode-specific fields
      if (formData.executionMode === 'agent') {
        submitData.agentId = formData.agentId;
        // For agent-based, destination is handled by the server using app defaults
      } else {
        submitData.destination = formData.destination;
      }

      const response = await fetch('/api/backups/configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create backup configuration');
      }

      router.push('/backups');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const addSource = () => {
    setFormData({
      ...formData,
      sources: [...formData.sources, { path: '', excludePatterns: [], includePatterns: [] }],
    });
  };

  const removeSource = (index: number) => {
    setFormData({
      ...formData,
      sources: formData.sources.filter((_, i) => i !== index),
    });
  };

  const updateSource = (index: number, field: keyof BackupSource, value: string) => {
    const newSources = [...formData.sources];
    const source = newSources[index];
    if (source && field === 'path') {
      source[field] = value;
    }
    setFormData({ ...formData, sources: newSources });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-700">
          {error}
        </div>
      )}

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
          <CardDescription>Configure the basic settings for your backup</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Configuration Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              placeholder="e.g., Daily Database Backup"
            />
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="enabled"
              checked={formData.enabled}
              onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
              className="w-4 h-4"
            />
            <Label htmlFor="enabled">Enable this backup configuration</Label>
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="useSchedule"
              checked={useSchedule}
              onChange={(e) => setUseSchedule(e.target.checked)}
              className="w-4 h-4"
            />
            <Label htmlFor="useSchedule">Schedule automated backups (uncheck for manual-only)</Label>
          </div>
        </CardContent>
      </Card>

      {/* Execution Mode */}
      <Card>
        <CardHeader>
          <CardTitle>Execution Mode</CardTitle>
          <CardDescription>Choose where backups will be executed</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-start space-x-3">
              <input
                type="radio"
                id="mode-agent"
                name="executionMode"
                value="agent"
                checked={formData.executionMode === 'agent'}
                onChange={() => setFormData({ ...formData, executionMode: 'agent' })}
                className="mt-1 w-4 h-4"
              />
              <div className="flex-1">
                <Label htmlFor="mode-agent" className="font-semibold">
                  Agent-Based (Recommended)
                </Label>
                <p className="text-sm text-muted-foreground">
                  Backup agent runs on your device, uploads directly to S3. Best for backing up files on your local machine or remote devices.
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <input
                type="radio"
                id="mode-server"
                name="executionMode"
                value="server"
                checked={formData.executionMode === 'server'}
                onChange={() => setFormData({ ...formData, executionMode: 'server' })}
                className="mt-1 w-4 h-4"
              />
              <div className="flex-1">
                <Label htmlFor="mode-server" className="font-semibold">
                  Server-Side
                </Label>
                <p className="text-sm text-muted-foreground">
                  Backup runs on the server. Only works if server has direct access to source paths (e.g., mounted volumes).
                </p>
              </div>
            </div>
          </div>

          {/* Agent Selection - Only show for agent-based mode */}
          {formData.executionMode === 'agent' && (
            <div className="space-y-2 pt-4 border-t">
              <Label htmlFor="agent">Select Agent</Label>
              {loadingAgents ? (
                <p className="text-sm text-muted-foreground">Loading agents...</p>
              ) : agents.length === 0 ? (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-sm">
                  No agents registered yet.{' '}
                  <a href="/agents" className="text-blue-600 hover:underline">
                    Register an agent first
                  </a>
                  {' '}to use agent-based backups.
                </div>
              ) : (
                <select
                  id="agent"
                  value={formData.agentId}
                  onChange={(e) => setFormData({ ...formData, agentId: e.target.value })}
                  required
                  className="w-full p-2 border rounded-md"
                >
                  <option value="">Select an agent...</option>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name} ({agent.status})
                      {agent.platform ? ` - ${agent.platform}` : ''}
                    </option>
                  ))}
                </select>
              )}
              <p className="text-sm text-muted-foreground">
                The selected agent will execute this backup and upload files to S3.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sources */}
      <Card>
        <CardHeader>
          <CardTitle>Backup Sources</CardTitle>
          <CardDescription>Specify the directories to backup</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {formData.sources.map((source, index) => (
            <div key={index} className="p-4 border rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <Label>Source {index + 1}</Label>
                {formData.sources.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeSource(index)}
                  >
                    Remove
                  </Button>
                )}
              </div>
              <Input
                value={source.path}
                onChange={(e) => updateSource(index, 'path', e.target.value)}
                placeholder="/path/to/backup"
                required
              />
            </div>
          ))}
          <Button type="button" variant="outline" onClick={addSource}>
            Add Source
          </Button>
        </CardContent>
      </Card>

      {/* Destination - Only show for server-side mode */}
      {formData.executionMode === 'server' && (
        <Card>
          <CardHeader>
            <CardTitle>S3 Destination</CardTitle>
            <CardDescription>Configure where backups will be stored</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="bucket">S3 Bucket</Label>
                <Input
                  id="bucket"
                  value={formData.destination.bucket}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      destination: { ...formData.destination, bucket: e.target.value },
                    })
                  }
                  required={formData.executionMode === 'server'}
                  placeholder="my-backup-bucket"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="region">Region</Label>
                <Input
                  id="region"
                  value={formData.destination.region}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      destination: { ...formData.destination, region: e.target.value },
                    })
                  }
                  required={formData.executionMode === 'server'}
                  placeholder="us-east-1"
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="prefix">Prefix (Optional)</Label>
                <Input
                  id="prefix"
                  value={formData.destination.prefix}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      destination: { ...formData.destination, prefix: e.target.value },
                    })
                  }
                  placeholder="backups"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endpoint">Custom Endpoint (Optional)</Label>
                <Input
                  id="endpoint"
                  value={formData.destination.endpoint}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      destination: { ...formData.destination, endpoint: e.target.value },
                    })
                  }
                  placeholder="https://s3.example.com"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Agent-Based Info Message */}
      {formData.executionMode === 'agent' && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <p className="text-sm text-blue-900">
              <strong>Note:</strong> For agent-based backups, S3 configuration is managed by the application.
              The agent will upload backups to: <code className="bg-blue-100 px-1 py-0.5 rounded">users/[userId]/agents/[agentId]/configs/[configId]/</code>
            </p>
          </CardContent>
        </Card>
      )}

      {/* Schedule - Only show if useSchedule is enabled */}
      {useSchedule && (
        <Card>
          <CardHeader>
            <CardTitle>Schedule</CardTitle>
            <CardDescription>Configure when backups should run</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cronExpression">Cron Expression</Label>
                <Input
                  id="cronExpression"
                  value={formData.schedule?.cronExpression || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      schedule: {
                        cronExpression: e.target.value,
                        timezone: formData.schedule?.timezone || 'UTC'
                      },
                    })
                  }
                  required
                  placeholder="0 2 * * * (Daily at 2 AM)"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Input
                  id="timezone"
                  value={formData.schedule?.timezone || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      schedule: {
                        cronExpression: formData.schedule?.cronExpression || '0 2 * * *',
                        timezone: e.target.value
                      },
                    })
                  }
                  required
                  placeholder="UTC"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Options */}
      <Card>
        <CardHeader>
          <CardTitle>Backup Options</CardTitle>
          <CardDescription>Configure backup behavior</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="type">Backup Type</Label>
              <select
                id="type"
                value={formData.options.type}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    options: { ...formData.options, type: e.target.value as 'full' | 'incremental' },
                  })
                }
                className="w-full p-2 border rounded-md"
              >
                <option value="full">Full</option>
                <option value="incremental">Incremental</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="retentionDays">Retention Days</Label>
              <Input
                id="retentionDays"
                type="number"
                value={formData.options.retentionDays}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    options: { ...formData.options, retentionDays: parseInt(e.target.value) },
                  })
                }
                min="1"
                required
              />
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="compression"
                checked={formData.options.compression}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    options: { ...formData.options, compression: e.target.checked },
                  })
                }
                className="w-4 h-4"
              />
              <Label htmlFor="compression">Enable Compression</Label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="encryption"
                checked={formData.options.encryption}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    options: { ...formData.options, encryption: e.target.checked },
                  })
                }
                className="w-4 h-4"
              />
              <Label htmlFor="encryption">Enable Encryption</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex gap-4">
        <Button type="submit" disabled={loading}>
          {loading ? 'Creating...' : 'Create Backup Configuration'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
