import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';
import { getReportService, ReportPeriod } from '@/lib/reports/report-service';

/**
 * GET /api/reports
 * Generate a backup report for a specified period
 * Query params:
 *   - period: daily, weekly, monthly, custom (required)
 *   - startDate: ISO date string (optional, for custom period)
 *   - endDate: ISO date string (optional, for custom period)
 *   - configIds: comma-separated config IDs (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') as ReportPeriod || 'weekly';
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');
    const configIdsStr = searchParams.get('configIds');

    // Validate period
    const validPeriods = ['daily', 'weekly', 'monthly', 'custom'];
    if (!validPeriods.includes(period)) {
      return NextResponse.json(
        { success: false, error: 'Invalid period. Must be one of: daily, weekly, monthly, custom' },
        { status: 400 }
      );
    }

    // Parse dates for custom period
    let startDate: Date | undefined;
    let endDate: Date | undefined;

    if (period === 'custom') {
      if (!startDateStr || !endDateStr) {
        return NextResponse.json(
          { success: false, error: 'startDate and endDate are required for custom period' },
          { status: 400 }
        );
      }

      startDate = new Date(startDateStr);
      endDate = new Date(endDateStr);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return NextResponse.json(
          { success: false, error: 'Invalid date format' },
          { status: 400 }
        );
      }
    }

    // Parse config IDs if provided
    const configIds = configIdsStr ? configIdsStr.split(',').filter(Boolean) : undefined;

    // Generate report
    const reportService = getReportService();
    const report = await reportService.generateReport({
      userId: session.user.id,
      period,
      startDate,
      endDate,
      configIds,
    });

    return NextResponse.json({ success: true, report });
  } catch (error) {
    console.error('[API] Failed to generate report:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate report';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
