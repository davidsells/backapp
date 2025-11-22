'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

interface AppSettings {
  registrationEnabled: boolean;
  requireApproval: boolean;
}

interface UserInfo {
  id: string;
  email: string;
  name: string;
  role: string;
  approved: boolean;
  suspended: boolean;
  deletedAt: string | null;
  createdAt: string;
}

interface Stats {
  total: number;
  active: number;
  pending: number;
  suspended: number;
  deleted: number;
  admins: number;
}

export function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<'settings' | 'pending' | 'users' | 'stats'>('settings');
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [pendingUsers, setPendingUsers] = useState<UserInfo[]>([]);
  const [allUsers, setAllUsers] = useState<UserInfo[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    setError('');

    try {
      if (activeTab === 'settings') {
        const res = await fetch('/api/admin/settings');
        const data = await res.json();
        if (data.success) setSettings(data.settings);
      } else if (activeTab === 'pending') {
        const res = await fetch('/api/admin/users/pending');
        const data = await res.json();
        if (data.success) setPendingUsers(data.users);
      } else if (activeTab === 'users') {
        const res = await fetch('/api/admin/users?includeDeleted=true');
        const data = await res.json();
        if (data.success) setAllUsers(data.users);
      } else if (activeTab === 'stats') {
        const res = await fetch('/api/admin/stats');
        const data = await res.json();
        if (data.success) setStats(data.stats);
      }
    } catch (err) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (key: keyof AppSettings, value: boolean) => {
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      });
      const data = await res.json();
      if (data.success) {
        setSettings(data.settings);
      } else {
        setError(data.error || 'Failed to update settings');
      }
    } catch (err) {
      setError('Failed to update settings');
    }
  };

  const approveUser = async (userId: string) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/approve`, {
        method: 'PATCH',
      });
      const data = await res.json();
      if (data.success) {
        setPendingUsers(pendingUsers.filter(u => u.id !== userId));
      } else {
        setError(data.error || 'Failed to approve user');
      }
    } catch (err) {
      setError('Failed to approve user');
    }
  };

  const rejectUser = async (userId: string) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject' }),
      });
      const data = await res.json();
      if (data.success) {
        setPendingUsers(pendingUsers.filter(u => u.id !== userId));
      } else {
        setError(data.error || 'Failed to reject user');
      }
    } catch (err) {
      setError('Failed to reject user');
    }
  };

  const deleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        loadData(); // Reload users
      } else {
        setError(data.error || 'Failed to delete user');
      }
    } catch (err) {
      setError('Failed to delete user');
    }
  };

  const restoreUser = async (userId: string) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore' }),
      });
      const data = await res.json();
      if (data.success) {
        loadData(); // Reload users
      } else {
        setError(data.error || 'Failed to restore user');
      }
    } catch (err) {
      setError('Failed to restore user');
    }
  };

  const suspendUser = async (userId: string) => {
    if (!confirm('Are you sure you want to suspend this user?')) return;

    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'suspend' }),
      });
      const data = await res.json();
      if (data.success) {
        loadData(); // Reload users
      } else {
        setError(data.error || 'Failed to suspend user');
      }
    } catch (err) {
      setError('Failed to suspend user');
    }
  };

  const unsuspendUser = async (userId: string) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unsuspend' }),
      });
      const data = await res.json();
      if (data.success) {
        loadData(); // Reload users
      } else {
        setError(data.error || 'Failed to unsuspend user');
      }
    } catch (err) {
      setError('Failed to unsuspend user');
    }
  };

  const toggleUserRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    if (!confirm(`Change user role to ${newRole}?`)) return;

    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();
      if (data.success) {
        loadData(); // Reload users
      } else {
        setError(data.error || 'Failed to update role');
      }
    } catch (err) {
      setError('Failed to update role');
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-700">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex space-x-2 border-b">
        <button
          onClick={() => setActiveTab('settings')}
          className={`px-4 py-2 font-medium ${
            activeTab === 'settings'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-primary'
          }`}
        >
          Settings
        </button>
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-4 py-2 font-medium ${
            activeTab === 'pending'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-primary'
          }`}
        >
          Pending Users {pendingUsers.length > 0 && `(${pendingUsers.length})`}
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 font-medium ${
            activeTab === 'users'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-primary'
          }`}
        >
          All Users
        </button>
        <button
          onClick={() => setActiveTab('stats')}
          className={`px-4 py-2 font-medium ${
            activeTab === 'stats'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-primary'
          }`}
        >
          Statistics
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12">Loading...</div>
      ) : (
        <>
          {/* Settings Tab */}
          {activeTab === 'settings' && settings && (
            <Card>
              <CardHeader>
                <CardTitle>Application Settings</CardTitle>
                <CardDescription>Configure registration and user approval</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Enable Registration</Label>
                    <p className="text-sm text-muted-foreground">
                      Allow new users to register for accounts
                    </p>
                  </div>
                  <Button
                    variant={settings.registrationEnabled ? 'default' : 'outline'}
                    onClick={() => updateSettings('registrationEnabled', !settings.registrationEnabled)}
                  >
                    {settings.registrationEnabled ? 'Enabled' : 'Disabled'}
                  </Button>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Require Approval</Label>
                    <p className="text-sm text-muted-foreground">
                      New registrations require admin approval before login
                    </p>
                  </div>
                  <Button
                    variant={settings.requireApproval ? 'default' : 'outline'}
                    onClick={() => updateSettings('requireApproval', !settings.requireApproval)}
                  >
                    {settings.requireApproval ? 'Required' : 'Not Required'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Pending Users Tab */}
          {activeTab === 'pending' && (
            <Card>
              <CardHeader>
                <CardTitle>Pending User Approvals</CardTitle>
                <CardDescription>Users awaiting admin approval</CardDescription>
              </CardHeader>
              <CardContent>
                {pendingUsers.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    No pending users
                  </div>
                ) : (
                  <div className="space-y-4">
                    {pendingUsers.map((user) => (
                      <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <p className="font-medium">{user.name}</p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                          <p className="text-xs text-muted-foreground">
                            Registered: {new Date(user.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={() => approveUser(user.id)} size="sm">
                            Approve
                          </Button>
                          <Button onClick={() => rejectUser(user.id)} variant="outline" size="sm">
                            Reject
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* All Users Tab */}
          {activeTab === 'users' && (
            <Card>
              <CardHeader>
                <CardTitle>All Users</CardTitle>
                <CardDescription>Manage all user accounts</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {allUsers.map((user) => (
                    <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{user.name}</p>
                          <span
                            className={`text-xs px-2 py-1 rounded ${
                              user.role === 'admin'
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {user.role}
                          </span>
                          {user.deletedAt && (
                            <span className="text-xs px-2 py-1 rounded bg-red-100 text-red-700">
                              Deleted
                            </span>
                          )}
                          {user.suspended && !user.deletedAt && (
                            <span className="text-xs px-2 py-1 rounded bg-orange-100 text-orange-700">
                              Suspended
                            </span>
                          )}
                          {!user.approved && !user.deletedAt && (
                            <span className="text-xs px-2 py-1 rounded bg-yellow-100 text-yellow-700">
                              Pending
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>
                      <div className="flex gap-2">
                        {user.deletedAt ? (
                          <Button onClick={() => restoreUser(user.id)} variant="outline" size="sm">
                            Restore
                          </Button>
                        ) : (
                          <>
                            {user.suspended ? (
                              <Button onClick={() => unsuspendUser(user.id)} variant="outline" size="sm">
                                Unsuspend
                              </Button>
                            ) : (
                              <Button onClick={() => suspendUser(user.id)} variant="outline" size="sm">
                                Suspend
                              </Button>
                            )}
                            <Button
                              onClick={() => toggleUserRole(user.id, user.role)}
                              variant="outline"
                              size="sm"
                            >
                              {user.role === 'admin' ? 'Make User' : 'Make Admin'}
                            </Button>
                            <Button onClick={() => deleteUser(user.id)} variant="outline" size="sm">
                              Delete
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Stats Tab */}
          {activeTab === 'stats' && stats && (
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total Users</CardDescription>
                  <CardTitle className="text-3xl">{stats.total}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Active Users</CardDescription>
                  <CardTitle className="text-3xl">{stats.active}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Pending Approval</CardDescription>
                  <CardTitle className="text-3xl">{stats.pending}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Suspended Users</CardDescription>
                  <CardTitle className="text-3xl">{stats.suspended}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Deleted Users</CardDescription>
                  <CardTitle className="text-3xl">{stats.deleted}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Administrators</CardDescription>
                  <CardTitle className="text-3xl">{stats.admins}</CardTitle>
                </CardHeader>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
