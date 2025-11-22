'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ExecutionMode, Agent } from '@/lib/types/backup.types';
import { CostAssessmentModal } from './cost-assessment-modal';

interface BackupSource {
  path: string;
  excludePatterns: string[];
  includePatterns: string[];
}

interface FormData {
  name: string;
  enabled: boolean;
  executionMode: ExecutionMode;
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
    method: 'archive' | 'rsync' | 'rclone';
    type: 'full' | 'incremental';
    compression: boolean;
    compressionLevel: number;
    encryption: boolean;
    retentionDays: number;
    rsync?: {
      localReplica: string;
      delete: boolean;
      uploadToS3: boolean;
      storageClass?: string;
    };
    rclone?: {
      remoteType: 's3' | 'wasabi' | 'b2' | 'gcs' | 'azure';
      delete: boolean;
      storageClass?: string;
      bandwidth?: number;
      checksumVerification?: boolean;
      twoPhase?: boolean;
      localBackupPath?: string;
      uploadToRemote?: boolean;
      keepLocalCopies?: number;
    };
  };
}

export function BackupConfigForm({ initialData, configId }: { initialData?: Partial<FormData>; configId?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [useSchedule, setUseSchedule] = useState(!!initialData?.schedule);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [showCostAssessment, setShowCostAssessment] = useState(false);
  const isEditing = !!configId;

  const [formData, setFormData] = useState<FormData>({
    name: initialData?.name || '',
    enabled: initialData?.enabled ?? true,
    executionMode: (initialData?.executionMode as ExecutionMode) || 'agent',
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
      method: initialData?.options?.method || 'archive',
      type: initialData?.options?.type || 'full',
      compression: initialData?.options?.compression ?? true,
      compressionLevel: initialData?.options?.compressionLevel || 6,
      encryption: initialData?.options?.encryption ?? false,
      retentionDays: initialData?.options?.retentionDays || 30,
      rsync: initialData?.options?.rsync || {
        localReplica: '/tmp/backup-staging',
        delete: true,
        uploadToS3: true,
        storageClass: 'STANDARD_IA',
      },
      rclone: initialData?.options?.rclone || {
        remoteType: 's3',
        delete: true,
        storageClass: 'STANDARD_IA',
        bandwidth: 0,
        checksumVerification: true,
        twoPhase: false,
        localBackupPath: '',
        uploadToRemote: true,
        keepLocalCopies: 7,
      },
    },
  });

  // Fetch available agents
  useEffect(() => {
    async function fetchAgents() {
      try {
        const response = await fetch('/api/agents');
        if (response.ok) {
          const data = await response.json();
          setAgents(data.agents || []);
        }
      } catch (err) {
        console.error('Failed to fetch agents:', err);
      } finally {
        setLoadingAgents(false);
      }
    }
    fetchAgents();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Validation
      if (formData.executionMode === 'agent' && !formData.agentId) {
        setError('Please select an agent for agent-based backups');
        setLoading(false);
        return;
      }

      if (formData.executionMode === 'server') {
        if (!formData.destination.bucket || !formData.destination.region) {
          setError('Please provide S3 bucket and region for server-side backups');
          setLoading(false);
          return;
        }
      }

      // Prepare submit data
      const submitData: any = {
        name: formData.name,
        enabled: formData.enabled,
        executionMode: formData.executionMode,
        agentId: formData.executionMode === 'agent' ? formData.agentId : null,
        sources: formData.sources,
        // Only include destination for server-side backups
        ...(formData.executionMode === 'server' && { destination: formData.destination }),
        schedule: useSchedule ? formData.schedule : undefined,
        options: formData.options,
      };

      const url = isEditing ? `/api/backups/configs/${configId}` : '/api/backups/configs';
      const method = isEditing ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Failed to ${isEditing ? 'update' : 'create'} backup configuration`);
      }

      router.push(isEditing ? `/configs/${configId}` : '/configs');
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

  const handleExecutionModeChange = (mode: ExecutionMode) => {
    setFormData({
      ...formData,
      executionMode: mode,
      agentId: mode === 'server' ? '' : formData.agentId,
    });
  };

  return (
    <>
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
          <CardDescription>Choose how backups will be executed</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Agent-Based Option */}
            <label
              className={`relative flex flex-col p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                formData.executionMode === 'agent'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <div className="flex items-start">
                <input
                  type="radio"
                  name="executionMode"
                  value="agent"
                  checked={formData.executionMode === 'agent'}
                  onChange={(e) => handleExecutionModeChange(e.target.value as ExecutionMode)}
                  className="mt-1 mr-3"
                />
                <div>
                  <div className="font-semibold text-gray-900">Agent-Based (Recommended)</div>
                  <div className="text-sm text-gray-600 mt-1">
                    Backups run on a remote agent (device). The agent handles file scanning and uploads to S3 automatically.
                  </div>
                </div>
              </div>
            </label>

            {/* Server-Side Option */}
            <label
              className={`relative flex flex-col p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                formData.executionMode === 'server'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <div className="flex items-start">
                <input
                  type="radio"
                  name="executionMode"
                  value="server"
                  checked={formData.executionMode === 'server'}
                  onChange={(e) => handleExecutionModeChange(e.target.value as ExecutionMode)}
                  className="mt-1 mr-3"
                />
                <div>
                  <div className="font-semibold text-gray-900">Server-Side</div>
                  <div className="text-sm text-gray-600 mt-1">
                    Backups run on the server. Server must have direct access to source paths.
                  </div>
                </div>
              </div>
            </label>
          </div>

          {/* Agent Selection (only show for agent-based) */}
          {formData.executionMode === 'agent' && (
            <div className="space-y-2 pt-4 border-t">
              <Label htmlFor="agentId">Select Agent *</Label>
              {loadingAgents ? (
                <div className="text-sm text-gray-500">Loading agents...</div>
              ) : agents.length === 0 ? (
                <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded">
                  No agents available. Please set up an agent first.
                  <a href="/agents" className="underline ml-2 font-semibold">
                    Set up Agent →
                  </a>
                </div>
              ) : (
                <select
                  id="agentId"
                  value={formData.agentId}
                  onChange={(e) => setFormData({ ...formData, agentId: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  required={formData.executionMode === 'agent'}
                >
                  <option value="">Select an agent...</option>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name} ({agent.status}) {agent.platform && `- ${agent.platform}`}
                    </option>
                  ))}
                </select>
              )}
              <p className="text-sm text-gray-500">
                The selected agent will execute backups and upload to S3 using application defaults.
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

      {/* Destination - Only show for server-side */}
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
          {/* Backup Method Selection */}
          <div className="space-y-2">
            <Label htmlFor="method">Backup Method</Label>
            <select
              id="method"
              value={formData.options.method}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  options: { ...formData.options, method: e.target.value as 'archive' | 'rsync' | 'rclone' },
                })
              }
              className="w-full p-2 border rounded-md"
            >
              <option value="archive">Archive (tar.gz)</option>
              <option value="rclone">Rclone (Recommended - Multi-cloud sync)</option>
              <option value="rsync">Rsync (Legacy - Local/S3 two-step)</option>
            </select>
            <p className="text-sm text-gray-500">
              {formData.options.method === 'archive'
                ? 'Creates a compressed tar.gz archive and uploads to S3'
                : formData.options.method === 'rclone'
                ? 'Single-step sync to S3 or other cloud storage with built-in retries and verification (recommended)'
                : 'Uses rsync for incremental local backups, then syncs to S3 (legacy two-step process)'}
            </p>
          </div>

          {/* Rsync-specific options */}
          {formData.options.method === 'rsync' && (
            <div className="space-y-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
              <h4 className="font-semibold text-blue-900">Rsync Configuration</h4>
              <div className="p-3 bg-blue-100 border border-blue-300 rounded text-sm text-blue-900">
                <strong>Shared Bucket Architecture:</strong> All backups use the S3 bucket configured in the application settings (AWS_S3_BUCKET).
                Backups are automatically organized by user, agent, and config: AWS_S3_BUCKET/users/{'userId'}/agents/{'agentId'}/configs/{'configId'}/rsync/YYYY-MM-DD/
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="rsyncLocalReplica">Local Staging Directory</Label>
                  <Input
                    id="rsyncLocalReplica"
                    value={formData.options.rsync?.localReplica || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        options: {
                          ...formData.options,
                          rsync: {
                            localReplica: e.target.value,
                            delete: formData.options.rsync?.delete ?? true,
                            uploadToS3: formData.options.rsync?.uploadToS3 ?? true,
                            storageClass: formData.options.rsync?.storageClass,
                          },
                        },
                      })
                    }
                    placeholder="/var/backups/myapp-replica"
                    required={formData.options.method === 'rsync'}
                  />
                  <p className="text-xs text-gray-600 font-medium">
                    ⚠️ Each backup configuration must use a unique directory to prevent file conflicts
                  </p>
                  <p className="text-xs text-gray-600">Where rsync will stage files locally{formData.options.rsync?.uploadToS3 !== false ? ' before uploading to S3' : ''}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="rsyncUploadToS3"
                  checked={formData.options.rsync?.uploadToS3 ?? true}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      options: {
                        ...formData.options,
                        rsync: {
                          localReplica: formData.options.rsync?.localReplica ?? '',
                          delete: formData.options.rsync?.delete ?? true,
                          uploadToS3: e.target.checked,
                          storageClass: formData.options.rsync?.storageClass,
                        },
                      },
                    })
                  }
                  className="w-4 h-4"
                />
                <Label htmlFor="rsyncUploadToS3">Upload to S3 after rsync (uncheck for local-only backup)</Label>
              </div>
              {formData.options.rsync?.uploadToS3 !== false && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="rsyncStorageClass">S3 Storage Class</Label>
                    <select
                      id="rsyncStorageClass"
                      value={formData.options.rsync?.storageClass || 'STANDARD_IA'}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          options: {
                            ...formData.options,
                            rsync: {
                              localReplica: formData.options.rsync?.localReplica ?? '',
                              delete: formData.options.rsync?.delete ?? true,
                              uploadToS3: formData.options.rsync?.uploadToS3 ?? true,
                              storageClass: e.target.value,
                            },
                          },
                        })
                      }
                      className="w-full p-2 border rounded-md"
                    >
                      <option value="STANDARD">Standard</option>
                      <option value="STANDARD_IA">Standard-IA (Infrequent Access)</option>
                      <option value="GLACIER">Glacier</option>
                      <option value="DEEP_ARCHIVE">Glacier Deep Archive</option>
                    </select>
                    <p className="text-xs text-gray-600">
                      Storage class is applied when files are uploaded to S3. Different backup configs can use different storage classes.
                    </p>
                  </div>
                  <div className="pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowCostAssessment(true)}
                      className="w-full"
                      disabled={formData.sources.length === 0 || !formData.sources[0]?.path}
                    >
                      💰 Calculate S3 Cost Estimate
                    </Button>
                    <p className="text-xs text-gray-500 mt-1 text-center">
                      Get estimated monthly and yearly costs for S3 storage
                    </p>
                  </div>
                </div>
              )}
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="rsyncDelete"
                  checked={formData.options.rsync?.delete ?? true}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      options: {
                        ...formData.options,
                        rsync: {
                          localReplica: formData.options.rsync?.localReplica ?? '',
                          delete: e.target.checked,
                          uploadToS3: formData.options.rsync?.uploadToS3 ?? true,
                          storageClass: formData.options.rsync?.storageClass,
                        },
                      },
                    })
                  }
                  className="w-4 h-4"
                />
                <Label htmlFor="rsyncDelete">Mirror deletions (remove files from backup that no longer exist in source)</Label>
              </div>
            </div>
          )}

          {/* Rclone-specific options */}
          {formData.options.method === 'rclone' && (
            <div className="space-y-4 p-4 bg-green-50 border border-green-200 rounded-md">
              <h4 className="font-semibold text-green-900">Rclone Configuration (Recommended)</h4>
              <div className="p-3 bg-green-100 border border-green-300 rounded text-sm text-green-900">
                <strong>Single-Step Process:</strong> Rclone syncs directly to S3 without needing local staging.
                Backups are automatically organized: AWS_S3_BUCKET/users/{'userId'}/agents/{'agentId'}/configs/{'configId'}/rclone/YYYY-MM-DD/
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="rcloneRemoteType">Storage Backend</Label>
                  <select
                    id="rcloneRemoteType"
                    value={formData.options.rclone?.remoteType || 's3'}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        options: {
                          ...formData.options,
                          rclone: {
                            ...formData.options.rclone,
                            remoteType: e.target.value as 's3' | 'wasabi' | 'b2' | 'gcs' | 'azure',
                            delete: formData.options.rclone?.delete ?? true,
                            storageClass: formData.options.rclone?.storageClass,
                            bandwidth: formData.options.rclone?.bandwidth || 0,
                            checksumVerification: formData.options.rclone?.checksumVerification ?? true,
                          },
                        },
                      })
                    }
                    className="w-full p-2 border rounded-md"
                  >
                    <option value="s3">Amazon S3</option>
                    <option value="wasabi">Wasabi</option>
                    <option value="b2">Backblaze B2</option>
                    <option value="gcs">Google Cloud Storage</option>
                    <option value="azure">Azure Blob Storage</option>
                  </select>
                  <p className="text-xs text-gray-600">Choose your storage provider (currently S3 is fully configured)</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rcloneStorageClass">S3 Storage Class</Label>
                  <select
                    id="rcloneStorageClass"
                    value={formData.options.rclone?.storageClass || 'STANDARD_IA'}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        options: {
                          ...formData.options,
                          rclone: {
                            ...formData.options.rclone,
                            remoteType: formData.options.rclone?.remoteType || 's3',
                            delete: formData.options.rclone?.delete ?? true,
                            storageClass: e.target.value,
                            bandwidth: formData.options.rclone?.bandwidth || 0,
                            checksumVerification: formData.options.rclone?.checksumVerification ?? true,
                          },
                        },
                      })
                    }
                    className="w-full p-2 border rounded-md"
                  >
                    <option value="STANDARD">Standard</option>
                    <option value="STANDARD_IA">Standard-IA (Infrequent Access)</option>
                    <option value="GLACIER">Glacier</option>
                    <option value="DEEP_ARCHIVE">Glacier Deep Archive</option>
                  </select>
                  <p className="text-xs text-gray-600">Cost-optimized storage classes for backups</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rcloneBandwidth">Bandwidth Limit (KB/s, 0 = unlimited)</Label>
                  <Input
                    id="rcloneBandwidth"
                    type="number"
                    value={formData.options.rclone?.bandwidth || 0}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        options: {
                          ...formData.options,
                          rclone: {
                            ...formData.options.rclone,
                            remoteType: formData.options.rclone?.remoteType || 's3',
                            delete: formData.options.rclone?.delete ?? true,
                            storageClass: formData.options.rclone?.storageClass,
                            bandwidth: parseInt(e.target.value) || 0,
                            checksumVerification: formData.options.rclone?.checksumVerification ?? true,
                          },
                        },
                      })
                    }
                    min="0"
                    placeholder="0 (unlimited)"
                  />
                  <p className="text-xs text-gray-600">Limit upload speed to avoid network congestion</p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="rcloneDelete"
                  checked={formData.options.rclone?.delete ?? true}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      options: {
                        ...formData.options,
                        rclone: {
                          ...formData.options.rclone,
                          remoteType: formData.options.rclone?.remoteType || 's3',
                          delete: e.target.checked,
                          storageClass: formData.options.rclone?.storageClass,
                          bandwidth: formData.options.rclone?.bandwidth || 0,
                          checksumVerification: formData.options.rclone?.checksumVerification ?? true,
                        },
                      },
                    })
                  }
                  className="w-4 h-4"
                />
                <Label htmlFor="rcloneDelete">Mirror deletions (remove files from backup that no longer exist in source)</Label>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="rcloneChecksum"
                  checked={formData.options.rclone?.checksumVerification ?? true}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      options: {
                        ...formData.options,
                        rclone: {
                          ...formData.options.rclone,
                          remoteType: formData.options.rclone?.remoteType || 's3',
                          delete: formData.options.rclone?.delete ?? true,
                          storageClass: formData.options.rclone?.storageClass,
                          bandwidth: formData.options.rclone?.bandwidth || 0,
                          checksumVerification: e.target.checked,
                        },
                      },
                    })
                  }
                  className="w-4 h-4"
                />
                <Label htmlFor="rcloneChecksum">Verify checksums (recommended for data integrity)</Label>
              </div>

              {/* Two-Phase Backup Options */}
              <div className="border-t pt-4 mt-4">
                <div className="flex items-center space-x-2 mb-4">
                  <input
                    type="checkbox"
                    id="rcloneTwoPhase"
                    checked={formData.options.rclone?.twoPhase ?? false}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        options: {
                          ...formData.options,
                          rclone: {
                            ...formData.options.rclone,
                            remoteType: formData.options.rclone?.remoteType || 's3',
                            delete: formData.options.rclone?.delete ?? true,
                            storageClass: formData.options.rclone?.storageClass,
                            bandwidth: formData.options.rclone?.bandwidth || 0,
                            checksumVerification: formData.options.rclone?.checksumVerification ?? true,
                            twoPhase: e.target.checked,
                            localBackupPath: formData.options.rclone?.localBackupPath || '',
                            uploadToRemote: formData.options.rclone?.uploadToRemote ?? true,
                            keepLocalCopies: formData.options.rclone?.keepLocalCopies || 7,
                          },
                        },
                      })
                    }
                    className="w-4 h-4"
                  />
                  <Label htmlFor="rcloneTwoPhase" className="font-semibold">Enable two-phase backup (local + remote)</Label>
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  Two-phase backup syncs to a local directory first for fast recovery, then optionally uploads to cloud for disaster recovery.
                </p>

                {formData.options.rclone?.twoPhase && (
                  <div className="space-y-4 pl-6 border-l-2 border-green-300">
                    <div className="space-y-2">
                      <Label htmlFor="rcloneLocalPath">Local Backup Directory *</Label>
                      <Input
                        id="rcloneLocalPath"
                        value={formData.options.rclone?.localBackupPath || ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            options: {
                              ...formData.options,
                              rclone: {
                                ...formData.options.rclone,
                                remoteType: formData.options.rclone?.remoteType || 's3',
                                delete: formData.options.rclone?.delete ?? true,
                                storageClass: formData.options.rclone?.storageClass,
                                bandwidth: formData.options.rclone?.bandwidth || 0,
                                checksumVerification: formData.options.rclone?.checksumVerification ?? true,
                                twoPhase: formData.options.rclone?.twoPhase ?? false,
                                localBackupPath: e.target.value,
                                uploadToRemote: formData.options.rclone?.uploadToRemote ?? true,
                                keepLocalCopies: formData.options.rclone?.keepLocalCopies || 7,
                              },
                            },
                          })
                        }
                        placeholder="/var/backups/myapp"
                        required={formData.options.rclone?.twoPhase}
                      />
                      <p className="text-xs text-gray-600">
                        Base directory for local backups. Date-stamped subdirectories (YYYY-MM-DD) will be created automatically.
                      </p>
                    </div>

                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="rcloneUploadToRemote"
                        checked={formData.options.rclone?.uploadToRemote ?? true}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            options: {
                              ...formData.options,
                              rclone: {
                                ...formData.options.rclone,
                                remoteType: formData.options.rclone?.remoteType || 's3',
                                delete: formData.options.rclone?.delete ?? true,
                                storageClass: formData.options.rclone?.storageClass,
                                bandwidth: formData.options.rclone?.bandwidth || 0,
                                checksumVerification: formData.options.rclone?.checksumVerification ?? true,
                                twoPhase: formData.options.rclone?.twoPhase ?? false,
                                localBackupPath: formData.options.rclone?.localBackupPath || '',
                                uploadToRemote: e.target.checked,
                                keepLocalCopies: formData.options.rclone?.keepLocalCopies || 7,
                              },
                            },
                          })
                        }
                        className="w-4 h-4"
                      />
                      <Label htmlFor="rcloneUploadToRemote">Upload to remote storage after local backup</Label>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="rcloneKeepCopies">Keep Local Copies (0 = keep all)</Label>
                      <Input
                        id="rcloneKeepCopies"
                        type="number"
                        value={formData.options.rclone?.keepLocalCopies || 7}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            options: {
                              ...formData.options,
                              rclone: {
                                ...formData.options.rclone,
                                remoteType: formData.options.rclone?.remoteType || 's3',
                                delete: formData.options.rclone?.delete ?? true,
                                storageClass: formData.options.rclone?.storageClass,
                                bandwidth: formData.options.rclone?.bandwidth || 0,
                                checksumVerification: formData.options.rclone?.checksumVerification ?? true,
                                twoPhase: formData.options.rclone?.twoPhase ?? false,
                                localBackupPath: formData.options.rclone?.localBackupPath || '',
                                uploadToRemote: formData.options.rclone?.uploadToRemote ?? true,
                                keepLocalCopies: parseInt(e.target.value) || 0,
                              },
                            },
                          })
                        }
                        min="0"
                        placeholder="7"
                      />
                      <p className="text-xs text-gray-600">
                        Number of date-stamped local backup copies to retain. Older backups are automatically deleted. Set to 0 to keep all.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCostAssessment(true)}
                  className="w-full"
                  disabled={formData.sources.length === 0 || !formData.sources[0]?.path}
                >
                  💰 Calculate S3 Cost Estimate
                </Button>
                <p className="text-xs text-gray-500 mt-1 text-center">
                  Get estimated monthly and yearly costs for S3 storage
                </p>
              </div>
            </div>
          )}

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
          {/* Compression and encryption only apply to archive method */}
          {formData.options.method === 'archive' && (
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
          )}
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex gap-4">
        <Button type="submit" disabled={loading}>
          {loading
            ? (isEditing ? 'Updating...' : 'Creating...')
            : (isEditing ? 'Update Configuration' : 'Create Configuration')}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>

    {/* Cost Assessment Modal */}
    <CostAssessmentModal
      isOpen={showCostAssessment}
      onClose={() => setShowCostAssessment(false)}
      sources={formData.sources}
      storageClass={formData.options.rsync?.storageClass || 'STANDARD_IA'}
      executionMode={formData.executionMode}
      agentId={formData.agentId}
    />
    </>
  );
}
