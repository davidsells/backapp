import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';
import { getAlertService } from '@/lib/alerts/alert-service';

/**
 * PATCH /api/alerts/:alertId
 * Acknowledge a specific alert
 */
export async function PATCH(
  _request: NextRequest,
  { params }: { params: { alertId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { alertId } = params;

    const alertService = getAlertService();
    await alertService.acknowledgeAlert(alertId, session.user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Failed to acknowledge alert:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to acknowledge alert' },
      { status: 500 }
    );
  }
}
