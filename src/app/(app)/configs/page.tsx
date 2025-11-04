import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ConfigsPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Backup Configurations</h1>
        <p className="mt-2 text-sm text-gray-600">
          Manage your backup configurations
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Configurations</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">
            No configurations yet. This feature will be implemented in Phase 4.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
