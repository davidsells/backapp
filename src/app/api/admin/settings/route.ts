import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminApi } from '@/lib/admin/admin-auth';
import { getSettingsService } from '@/lib/admin/settings-service';

const updateSettingsSchema = z.object({
  registrationEnabled: z.boolean().optional(),
  requireApproval: z.boolean().optional(),
});

/**
 * GET /api/admin/settings - Get current app settings
 */
export async function GET() {
  const { error, session } = await requireAdminApi();
  if (error) return error;

  try {
    const settingsService = getSettingsService();
    const settings = await settingsService.getSettings();

    return NextResponse.json({ success: true, settings });
  } catch (err) {
    console.error('Failed to get settings:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to get settings' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/settings - Update app settings
 */
export async function PATCH(request: NextRequest) {
  const { error, session } = await requireAdminApi();
  if (error) return error;

  try {
    const body = await request.json();
    const validationResult = updateSettingsSchema.safeParse(body);

    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors[0]?.message || 'Validation failed';
      return NextResponse.json({ success: false, error: errorMessage }, { status: 400 });
    }

    const settingsService = getSettingsService();
    const settings = await settingsService.updateSettings(validationResult.data);

    return NextResponse.json({ success: true, settings });
  } catch (err) {
    console.error('Failed to update settings:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}
