import { auth } from '@/lib/auth/auth';
import { redirect } from 'next/navigation';
import { getAgentManagementService } from '@/lib/agent/agent-management.service';
import { AgentManagement } from '@/components/agent/agent-management';

export default async function AgentsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  // Fetch agents for user
  const agentService = getAgentManagementService();
  const agents = await agentService.listAgents(session.user.id);
  const stats = await agentService.getAgentStats(session.user.id);

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Agents</h1>
        <p className="text-muted-foreground mt-2">
          Manage backup agents running on your devices
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4 mb-8">
        <div className="p-4 border rounded-lg">
          <div className="text-sm text-muted-foreground">Total Agents</div>
          <div className="text-2xl font-bold">{stats.total}</div>
        </div>
        <div className="p-4 border rounded-lg">
          <div className="text-sm text-muted-foreground">Online</div>
          <div className="text-2xl font-bold text-green-600">{stats.online}</div>
        </div>
        <div className="p-4 border rounded-lg">
          <div className="text-sm text-muted-foreground">Offline</div>
          <div className="text-2xl font-bold text-gray-600">{stats.offline}</div>
        </div>
        <div className="p-4 border rounded-lg">
          <div className="text-sm text-muted-foreground">Errors</div>
          <div className="text-2xl font-bold text-red-600">{stats.error}</div>
        </div>
      </div>

      {/* Agent Management Component */}
      <AgentManagement agents={agents} />
    </div>
  );
}
