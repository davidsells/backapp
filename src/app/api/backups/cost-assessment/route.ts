import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth/auth';
import * as fs from 'fs/promises';
import * as path from 'path';

const costAssessmentSchema = z.object({
  sources: z.array(z.object({
    path: z.string(),
  })),
  storageClass: z.enum(['STANDARD', 'STANDARD_IA', 'GLACIER', 'DEEP_ARCHIVE']).optional().default('STANDARD_IA'),
  executionMode: z.enum(['agent', 'server']),
  agentId: z.string().optional(),
});

interface S3Pricing {
  storage: number; // per GB per month
  putRequests: number; // per 1000 requests
  getRequests: number; // per 1000 requests
  dataTransferOut: number; // per GB
  retrievalFee?: number; // per GB (for Glacier)
}

/**
 * POST /api/backups/cost-assessment - Calculate cost estimate for S3 backup
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validationResult = costAssessmentSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { success: false, error: validationResult.error.errors[0]?.message || 'Validation failed' },
        { status: 400 }
      );
    }

    const { sources, storageClass, executionMode } = validationResult.data;

    // Calculate total size of source directories
    let totalSizeBytes = 0;
    let totalFiles = 0;

    if (executionMode === 'server') {
      // Calculate size locally
      for (const source of sources) {
        const sizeInfo = await calculateDirectorySize(source.path);
        totalSizeBytes += sizeInfo.bytes;
        totalFiles += sizeInfo.files;
      }
    } else {
      // For agent-based, create a size assessment request
      const { agentId } = validationResult.data;

      if (!agentId) {
        return NextResponse.json({
          success: false,
          error: 'Agent ID is required for agent-based cost assessment',
        }, { status: 400 });
      }

      // Create size assessment request for agent to pick up
      const { prisma } = await import('@/lib/db/prisma');
      const assessmentRequest = await prisma.sizeAssessmentRequest.create({
        data: {
          userId: session.user.id,
          agentId,
          sources: sources as any,
          status: 'pending',
        },
      });

      // Return request ID for polling
      return NextResponse.json({
        success: true,
        agentBased: true,
        requestId: assessmentRequest.id,
        message: 'Size assessment requested from agent. This may take a few moments depending on agent polling interval (typically 10 minutes).',
        estimatedPricing: await getS3Pricing(storageClass),
      });
    }

    // Get S3 pricing
    const pricing = await getS3Pricing(storageClass);

    // Calculate costs
    const sizeGB = totalSizeBytes / (1024 * 1024 * 1024);
    const assessment = calculateCosts(sizeGB, totalFiles, pricing, storageClass);

    return NextResponse.json({
      success: true,
      agentBased: false,
      totalSizeBytes,
      totalSizeGB: sizeGB,
      totalFiles,
      storageClass,
      costs: assessment,
      pricing,
    });
  } catch (error) {
    console.error('Failed to assess backup costs:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to assess backup costs';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * Calculate size of a directory recursively
 */
async function calculateDirectorySize(dirPath: string): Promise<{ bytes: number; files: number }> {
  let totalBytes = 0;
  let totalFiles = 0;

  async function walk(currentPath: string) {
    try {
      const stats = await fs.stat(currentPath);

      if (stats.isFile()) {
        totalBytes += stats.size;
        totalFiles++;
      } else if (stats.isDirectory()) {
        const entries = await fs.readdir(currentPath);
        for (const entry of entries) {
          // Skip common exclusions
          if (entry === 'node_modules' || entry === '.git' || entry.endsWith('.log')) {
            continue;
          }
          await walk(path.join(currentPath, entry));
        }
      }
    } catch (error) {
      // Skip files we can't access
      console.warn(`Skipping ${currentPath}: ${error}`);
    }
  }

  await walk(dirPath);
  return { bytes: totalBytes, files: totalFiles };
}

/**
 * Get S3 pricing for specified storage class using AWS Pricing API
 */
export async function getS3Pricing(storageClass: string): Promise<S3Pricing> {
  // Guaranteed fallback pricing (STANDARD_IA)
  const fallbackPricing: S3Pricing = {
    storage: 0.0125,
    putRequests: 0.01,
    getRequests: 0.001,
    dataTransferOut: 0.09,
    retrievalFee: 0.01,
  };

  // Default pricing (fallback if AWS CLI not available or API call fails)
  // Prices as of 2024 for us-east-1
  const defaultPricing: Record<string, S3Pricing> = {
    STANDARD: {
      storage: 0.023, // $0.023 per GB/month
      putRequests: 0.005, // $0.005 per 1000 PUT requests
      getRequests: 0.0004, // $0.0004 per 1000 GET requests
      dataTransferOut: 0.09, // $0.09 per GB (first 10TB)
    },
    STANDARD_IA: fallbackPricing,
    GLACIER: {
      storage: 0.004, // $0.004 per GB/month
      putRequests: 0.03, // $0.03 per 1000 PUT requests
      getRequests: 0.0004, // $0.0004 per 1000 GET requests
      dataTransferOut: 0.09,
      retrievalFee: 0.01, // Expedited retrieval
    },
    DEEP_ARCHIVE: {
      storage: 0.00099, // $0.00099 per GB/month
      putRequests: 0.05, // $0.05 per 1000 PUT requests
      getRequests: 0.0004,
      dataTransferOut: 0.09,
      retrievalFee: 0.02, // Standard retrieval
    },
  };

  try {
    // Try to get live pricing from AWS (optional - requires AWS CLI and credentials)
    // This is commented out by default since it requires AWS configuration
    /*
    const storageClassMapping: Record<string, string> = {
      STANDARD: 'General Purpose',
      STANDARD_IA: 'Infrequent Access',
      GLACIER: 'Amazon Glacier',
      DEEP_ARCHIVE: 'Amazon Glacier Deep Archive',
    };

    const { stdout } = await execAsync(
      `aws pricing get-products \
        --service-code AmazonS3 \
        --region us-east-1 \
        --filters Type=TERM_MATCH,Field=location,Value="US East (N. Virginia)" \
                  Type=TERM_MATCH,Field=storageClass,Value="${storageClassMapping[storageClass]}" \
        --output json`,
      { timeout: 5000 }
    );

    const result = JSON.parse(stdout);
    if (result.PriceList && result.PriceList.length > 0) {
      // Parse pricing from AWS response
      // This is complex and would need proper parsing logic
    }
    */
  } catch (error) {
    console.warn('Failed to fetch live pricing from AWS, using default pricing:', error);
  }

  // Return pricing for the specified storage class, or default to fallback
  return defaultPricing[storageClass] ?? fallbackPricing;
}

/**
 * Calculate cost breakdown
 */
export function calculateCosts(sizeGB: number, fileCount: number, pricing: S3Pricing, storageClass: string) {
  // Initial upload costs
  const uploadRequests = Math.ceil(fileCount / 1000); // Assume 1 PUT per file
  const uploadRequestCost = uploadRequests * pricing.putRequests;
  const uploadTransferCost = 0; // Data transfer INTO S3 is free

  // Monthly storage cost
  const monthlyStorageCost = sizeGB * pricing.storage;

  // Estimated retrieval costs (assuming you might retrieve 10% of data per month)
  const retrievalGB = sizeGB * 0.1;
  const retrievalRequests = Math.ceil((fileCount * 0.1) / 1000);
  const retrievalRequestCost = retrievalRequests * pricing.getRequests;
  const retrievalTransferCost = retrievalGB * pricing.dataTransferOut;
  const retrievalFee = pricing.retrievalFee ? retrievalGB * pricing.retrievalFee : 0;
  const totalRetrievalCost = retrievalRequestCost + retrievalTransferCost + retrievalFee;

  // Yearly projection
  const yearlyStorageCost = monthlyStorageCost * 12;
  const yearlyRetrievalCost = totalRetrievalCost * 12;

  return {
    oneTime: {
      uploadRequests: uploadRequestCost,
      uploadTransfer: uploadTransferCost,
      total: uploadRequestCost + uploadTransferCost,
    },
    monthly: {
      storage: monthlyStorageCost,
      estimatedRetrieval: totalRetrievalCost,
      total: monthlyStorageCost + totalRetrievalCost,
    },
    yearly: {
      storage: yearlyStorageCost,
      estimatedRetrieval: yearlyRetrievalCost,
      total: yearlyStorageCost + yearlyRetrievalCost,
    },
    breakdown: {
      storagePerGB: pricing.storage,
      putRequestsPer1000: pricing.putRequests,
      getRequestsPer1000: pricing.getRequests,
      dataTransferOutPerGB: pricing.dataTransferOut,
      retrievalFeePerGB: pricing.retrievalFee || 0,
    },
    notes: getCostNotes(storageClass),
  };
}

/**
 * Get storage-class specific notes
 */
function getCostNotes(storageClass: string): string[] {
  const notes: Record<string, string[]> = {
    STANDARD: [
      'Best for frequently accessed data',
      'No retrieval fees',
      'Highest storage cost but lowest access cost',
    ],
    STANDARD_IA: [
      'Best for infrequently accessed data (< once per month)',
      'Lower storage cost than Standard',
      'Minimum storage duration: 30 days',
      'Retrieval fee applies per GB accessed',
    ],
    GLACIER: [
      'Best for archive data with rare access',
      'Very low storage cost',
      'Retrieval times: 1-5 minutes (Expedited), 3-5 hours (Standard), 5-12 hours (Bulk)',
      'Minimum storage duration: 90 days',
      'Retrieval fees apply',
    ],
    DEEP_ARCHIVE: [
      'Lowest cost storage for long-term archives',
      'Best for data accessed once or twice per year',
      'Retrieval times: 12-48 hours',
      'Minimum storage duration: 180 days',
      'Higher retrieval fees than Glacier',
    ],
  };

  return notes[storageClass] || [];
}
