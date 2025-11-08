import { Suspense } from 'react';
import { auth } from '@/lib/auth/auth';
import { redirect } from 'next/navigation';
import { AgentLogs } from '@/components/agent/agent-logs';

export const metadata = {
  title: 'Agent Logs | BackApp',
  description: 'View real-time logs from your backup agent',
};

export default async function AgentPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Agent Monitoring</h1>
        <p className="text-muted-foreground">
          Monitor your backup agent in real-time with live log streaming
        </p>
      </div>

      <Suspense fallback={<div>Loading...</div>}>
        <AgentLogs userId={session.user.id} />
      </Suspense>
    </div>
  );
}
