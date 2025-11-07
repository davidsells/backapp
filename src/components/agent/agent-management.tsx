'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Agent {
  id: string;
  name: string;
  status: string;
  platform: string | null;
  version: string | null;
  lastSeen: Date | null;
  createdAt: Date;
}

interface AgentManagementProps {
  agents: Agent[];
}

export function AgentManagement({ agents }: AgentManagementProps) {
  const router = useRouter();
  const [showRegister, setShowRegister] = useState(false);
  const [registerForm, setRegisterForm] = useState({ name: '', platform: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [newAgent, setNewAgent] = useState<{ name: string; apiKey: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/agent/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registerForm),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to register agent');
      }

      // Show API key (only time it's displayed)
      setNewAgent({ name: data.agent.name, apiKey: data.agent.apiKey });
      setShowRegister(false);
      setRegisterForm({ name: '', platform: '' });

      // Refresh page to show new agent
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to register agent');
    } finally {
      setLoading(false);
    }
  };

  const copyApiKey = () => {
    if (newAgent) {
      navigator.clipboard.writeText(newAgent.apiKey);
      alert('API key copied to clipboard!');
    }
  };

  const closeApiKeyDialog = () => {
    setNewAgent(null);
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;

    setDeleteLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/agents/${deleteConfirm.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete agent');
      }

      // Close dialog and refresh
      setDeleteConfirm(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete agent');
      setDeleteConfirm(null);
    } finally {
      setDeleteLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'text-green-600 bg-green-100';
      case 'offline': return 'text-gray-600 bg-gray-100';
      case 'error': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const formatLastSeen = (lastSeen: Date | null) => {
    if (!lastSeen) return 'Never';
    const date = new Date(lastSeen);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="space-y-6">
      {/* API Key Display Dialog */}
      {newAgent && (
        <Card className="border-2 border-green-500">
          <CardHeader>
            <CardTitle>Agent Registered Successfully!</CardTitle>
            <CardDescription>
              Save this API key securely - it will not be shown again
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Agent Name</Label>
              <div className="font-mono text-sm">{newAgent.name}</div>
            </div>
            <div>
              <Label>API Key</Label>
              <div className="flex gap-2">
                <Input
                  value={newAgent.apiKey}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button onClick={copyApiKey} variant="outline">
                  Copy
                </Button>
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              Store this API key in your agent&apos;s config.json file. You&apos;ll need it to authenticate the agent.
            </div>
            <Button onClick={closeApiKeyDialog}>I&apos;ve Saved the API Key</Button>
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <Card className="border-2 border-red-500">
          <CardHeader>
            <CardTitle>Delete Agent?</CardTitle>
            <CardDescription>
              Are you sure you want to delete &quot;{deleteConfirm.name}&quot;?
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground">
              This will permanently delete the agent and all its logs. Any backup configurations using this agent will be unassigned but not deleted.
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleDelete}
                disabled={deleteLoading}
                variant="destructive"
              >
                {deleteLoading ? 'Deleting...' : 'Delete Agent'}
              </Button>
              <Button
                onClick={() => setDeleteConfirm(null)}
                disabled={deleteLoading}
                variant="outline"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Register Form */}
      {showRegister && (
        <Card>
          <CardHeader>
            <CardTitle>Register New Agent</CardTitle>
            <CardDescription>
              Create a new agent to run backups from a remote machine
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRegister} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="name">Agent Name</Label>
                <Input
                  id="name"
                  value={registerForm.name}
                  onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
                  placeholder="e.g., My MacBook"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="platform">Platform (Optional)</Label>
                <Input
                  id="platform"
                  value={registerForm.platform}
                  onChange={(e) => setRegisterForm({ ...registerForm, platform: e.target.value })}
                  placeholder="e.g., darwin, linux, win32"
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={loading}>
                  {loading ? 'Registering...' : 'Register Agent'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowRegister(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Register Button */}
      {!showRegister && !newAgent && (
        <Button onClick={() => setShowRegister(true)}>
          Register New Agent
        </Button>
      )}

      {/* Agents List */}
      <div className="space-y-4">
        {agents.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No agents registered yet. Register your first agent to get started.
            </CardContent>
          </Card>
        ) : (
          agents.map((agent) => (
            <Card key={agent.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold">{agent.name}</h3>
                      <span className={`text-xs px-2 py-1 rounded ${getStatusColor(agent.status)}`}>
                        {agent.status}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <div>ID: {agent.id}</div>
                      {agent.platform && <div>Platform: {agent.platform}</div>}
                      {agent.version && <div>Version: {agent.version}</div>}
                      <div>Last seen: {formatLastSeen(agent.lastSeen)}</div>
                      <div>Created: {new Date(agent.createdAt).toLocaleDateString()}</div>
                    </div>
                  </div>
                  <div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setDeleteConfirm({ id: agent.id, name: agent.name })}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
