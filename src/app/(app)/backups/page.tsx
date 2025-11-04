import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function BackupsPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Backup History</h1>
        <p className="mt-2 text-sm text-gray-600">
          View your backup history and logs
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Backups</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">
            No backups yet. This feature will be implemented in Phase 4.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
