import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';
import { prisma } from '@/lib/db/prisma';

/**
 * GET /api/backups/cost-assessment/[requestId] - Poll size assessment status
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { requestId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { requestId } = params;

    // Get the assessment request
    const assessmentRequest = await prisma.sizeAssessmentRequest.findFirst({
      where: {
        id: requestId,
        userId: session.user.id,
      },
    });

    if (!assessmentRequest) {
      return NextResponse.json(
        { success: false, error: 'Assessment request not found' },
        { status: 404 }
      );
    }

    // If completed, calculate costs
    if (assessmentRequest.status === 'completed' && assessmentRequest.totalBytes) {
      const storageClass = new URL(request.url).searchParams.get('storageClass') || 'STANDARD_IA';
      const { getS3Pricing, calculateCosts } = await import('../route');

      const sizeGB = Number(assessmentRequest.totalBytes) / (1024 * 1024 * 1024);
      const pricing = await getS3Pricing(storageClass);
      const assessment = calculateCosts(
        sizeGB,
        assessmentRequest.totalFiles || 0,
        pricing,
        storageClass
      );

      // Calculate costs for all storage classes for comparison
      const allStorageClasses = ['STANDARD', 'STANDARD_IA', 'GLACIER', 'DEEP_ARCHIVE'] as const;
      const allAssessments = await Promise.all(
        allStorageClasses.map(async (sc) => {
          const scPricing = await getS3Pricing(sc);
          return {
            storageClass: sc,
            selected: sc === storageClass,
            costs: calculateCosts(sizeGB, assessmentRequest.totalFiles || 0, scPricing, sc),
            pricing: scPricing,
          };
        })
      );

      return NextResponse.json({
        success: true,
        status: 'completed',
        totalSizeBytes: Number(assessmentRequest.totalBytes),
        totalSizeGB: sizeGB,
        totalFiles: assessmentRequest.totalFiles || 0,
        storageClass,
        costs: assessment,
        pricing,
        allStorageClasses: allAssessments, // Add comparison of all storage classes
      });
    }

    // Return current status
    return NextResponse.json({
      success: true,
      status: assessmentRequest.status,
      error: assessmentRequest.error,
      createdAt: assessmentRequest.createdAt,
    });
  } catch (error) {
    console.error('Failed to get assessment status:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get assessment status' },
      { status: 500 }
    );
  }
}
