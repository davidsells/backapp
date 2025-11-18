import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/admin/admin-auth';
import { AdminDashboard } from '@/components/admin/admin-dashboard';

export default async function AdminPage() {
  const session = await requireAdmin();

  if (!session) {
    redirect('/dashboard');
  }

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Administration</h1>
        <p className="text-muted-foreground">
          Manage users, settings, and system configuration
        </p>
      </div>
      <Suspense fallback={<div>Loading...</div>}>
        <AdminDashboard />
      </Suspense>
    </div>
  );
}
