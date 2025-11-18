import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';
import { getAlertService } from '@/lib/alerts/alert-service';

/**
 * GET /api/alerts
 * Get alerts for the current user
 * Query params: unacknowledged (optional, boolean)
 */
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const unacknowledgedOnly = searchParams.get('unacknowledged') === 'true';

    const alertService = getAlertService();
    const alerts = unacknowledgedOnly
      ? await alertService.getUnacknowledgedAlerts(session.user.id)
      : await alertService.getAllAlerts(session.user.id);

    return NextResponse.json({ success: true, alerts });
  } catch (error) {
    console.error('[API] Failed to get alerts:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get alerts' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/alerts/acknowledge-all
 * Acknowledge all alerts for the current user
 */
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const alertService = getAlertService();
    await alertService.acknowledgeAllAlerts(session.user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Failed to acknowledge all alerts:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to acknowledge alerts' },
      { status: 500 }
    );
  }
}
