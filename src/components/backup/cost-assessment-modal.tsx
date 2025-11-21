'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface CostAssessmentResult {
  success: boolean;
  agentBased: boolean;
  message?: string;
  totalSizeBytes?: number;
  totalSizeGB?: number;
  totalFiles?: number;
  storageClass?: string;
  costs?: {
    oneTime: {
      uploadRequests: number;
      uploadTransfer: number;
      total: number;
    };
    monthly: {
      storage: number;
      estimatedRetrieval: number;
      total: number;
    };
    yearly: {
      storage: number;
      estimatedRetrieval: number;
      total: number;
    };
    breakdown: {
      storagePerGB: number;
      putRequestsPer1000: number;
      getRequestsPer1000: number;
      dataTransferOutPerGB: number;
      retrievalFeePerGB: number;
    };
    notes: string[];
  };
  estimatedPricing?: any;
  error?: string;
}

interface CostAssessmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  sources: Array<{ path: string }>;
  storageClass: string;
  executionMode: 'agent' | 'server';
  agentId?: string;
}

export function CostAssessmentModal({
  isOpen,
  onClose,
  sources,
  storageClass,
  executionMode,
  agentId,
}: CostAssessmentModalProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CostAssessmentResult | null>(null);

  const runAssessment = async () => {
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/backups/cost-assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sources,
          storageClass,
          executionMode,
          agentId,
        }),
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({
        success: false,
        agentBased: false,
        error: 'Failed to calculate cost assessment',
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(amount);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b sticky top-0 bg-white">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">S3 Backup Cost Assessment</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {!result && !loading && (
            <div className="text-center py-8">
              <p className="text-gray-600 mb-4">
                Click the button below to calculate the estimated costs for backing up your selected sources to S3.
              </p>
              <Button onClick={runAssessment}>Calculate Cost Estimate</Button>
            </div>
          )}

          {loading && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-gray-600">Calculating directory size and fetching pricing...</p>
            </div>
          )}

          {result && result.error && (
            <Card className="border-red-200 bg-red-50">
              <CardHeader>
                <CardTitle className="text-red-700">Error</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-red-600">{result.error}</p>
              </CardContent>
            </Card>
          )}

          {result && result.agentBased && (
            <Card className="border-yellow-200 bg-yellow-50">
              <CardHeader>
                <CardTitle className="text-yellow-700">Agent-Based Backup</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-yellow-800">{result.message}</p>
              </CardContent>
            </Card>
          )}

          {result && result.success && !result.agentBased && result.costs && (
            <>
              {/* Data Summary */}
              <Card>
                <CardHeader>
                  <CardTitle>Data Summary</CardTitle>
                  <CardDescription>Size of directories to be backed up</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span className="font-semibold">Total Size:</span>
                    <span>{formatBytes(result.totalSizeBytes || 0)} ({result.totalSizeGB?.toFixed(2)} GB)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold">Total Files:</span>
                    <span>{formatNumber(result.totalFiles || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold">Storage Class:</span>
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm">{result.storageClass}</span>
                  </div>
                </CardContent>
              </Card>

              {/* One-Time Costs */}
              <Card>
                <CardHeader>
                  <CardTitle>Initial Upload Costs (One-Time)</CardTitle>
                  <CardDescription>Costs incurred when first uploading data to S3</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span>PUT Requests:</span>
                    <span>{formatCurrency(result.costs.oneTime.uploadRequests)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Data Transfer IN:</span>
                    <span className="text-green-600">FREE</span>
                  </div>
                  <div className="flex justify-between border-t pt-2 font-semibold">
                    <span>Total One-Time Cost:</span>
                    <span>{formatCurrency(result.costs.oneTime.total)}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Monthly Costs */}
              <Card>
                <CardHeader>
                  <CardTitle>Monthly Costs</CardTitle>
                  <CardDescription>Recurring costs for storage and access</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span>Storage ({result.totalSizeGB?.toFixed(2)} GB @ {formatCurrency(result.costs.breakdown.storagePerGB)}/GB):</span>
                    <span>{formatCurrency(result.costs.monthly.storage)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Estimated Retrieval (10% of data):</span>
                    <span>{formatCurrency(result.costs.monthly.estimatedRetrieval)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2 font-semibold text-lg">
                    <span>Total Monthly Cost:</span>
                    <span>{formatCurrency(result.costs.monthly.total)}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Yearly Projection */}
              <Card>
                <CardHeader>
                  <CardTitle>Yearly Projection</CardTitle>
                  <CardDescription>Estimated annual costs</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span>Storage (12 months):</span>
                    <span>{formatCurrency(result.costs.yearly.storage)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Estimated Retrieval (12 months):</span>
                    <span>{formatCurrency(result.costs.yearly.estimatedRetrieval)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2 font-semibold text-lg">
                    <span>Total Yearly Cost:</span>
                    <span className="text-blue-600">{formatCurrency(result.costs.yearly.total)}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Pricing Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle>Pricing Breakdown</CardTitle>
                  <CardDescription>Current S3 pricing rates (US East - N. Virginia)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Storage:</span>
                    <span>{formatCurrency(result.costs.breakdown.storagePerGB)}/GB per month</span>
                  </div>
                  <div className="flex justify-between">
                    <span>PUT Requests:</span>
                    <span>{formatCurrency(result.costs.breakdown.putRequestsPer1000)} per 1,000 requests</span>
                  </div>
                  <div className="flex justify-between">
                    <span>GET Requests:</span>
                    <span>{formatCurrency(result.costs.breakdown.getRequestsPer1000)} per 1,000 requests</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Data Transfer OUT:</span>
                    <span>{formatCurrency(result.costs.breakdown.dataTransferOutPerGB)}/GB</span>
                  </div>
                  {result.costs.breakdown.retrievalFeePerGB > 0 && (
                    <div className="flex justify-between">
                      <span>Retrieval Fee:</span>
                      <span>{formatCurrency(result.costs.breakdown.retrievalFeePerGB)}/GB</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Notes */}
              {result.costs.notes && result.costs.notes.length > 0 && (
                <Card className="border-blue-200 bg-blue-50">
                  <CardHeader>
                    <CardTitle className="text-blue-900">Storage Class Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="list-disc list-inside space-y-1 text-blue-800">
                      {result.costs.notes.map((note, index) => (
                        <li key={index}>{note}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Disclaimer */}
              <Card className="border-gray-200 bg-gray-50">
                <CardContent className="pt-6">
                  <p className="text-xs text-gray-600">
                    <strong>Disclaimer:</strong> These are estimated costs based on current AWS S3 pricing for US East (N. Virginia) region.
                    Actual costs may vary based on your AWS region, data access patterns, and AWS pricing changes.
                    Retrieval costs assume 10% of data accessed monthly. Data transfer INTO S3 is free, but transfer OUT incurs charges.
                    Some storage classes have minimum storage duration charges.
                  </p>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        <div className="p-6 border-t bg-gray-50 sticky bottom-0">
          <div className="flex justify-end gap-2">
            {result && (
              <Button variant="outline" onClick={() => setResult(null)}>
                Recalculate
              </Button>
            )}
            <Button variant="default" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
