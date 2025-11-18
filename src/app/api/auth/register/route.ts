import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authService } from '@/lib/auth/auth-service';
import { getSettingsService } from '@/lib/admin/settings-service';

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  password: z.string()
    .min(12, 'Password must be at least 12 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

export async function POST(request: NextRequest) {
  try {
    // Check if registration is enabled
    const settingsService = getSettingsService();
    const settings = await settingsService.getSettings();

    if (!settings.registrationEnabled) {
      return NextResponse.json(
        {
          success: false,
          error: 'Registration is currently disabled',
        },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Validate request body
    const validationResult = registerSchema.safeParse(body);
    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors[0]?.message || 'Validation failed';
      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
        },
        { status: 400 }
      );
    }

    const { email, name, password } = validationResult.data;

    // Register user
    const user = await authService.registerUser({ email, name, password });

    // Check if approval is required
    const message = settings.requireApproval
      ? 'Account created successfully! Please wait for admin approval before logging in.'
      : 'Account created successfully! You can now log in.';

    return NextResponse.json(
      {
        success: true,
        message,
        requiresApproval: settings.requireApproval,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected error occurred',
      },
      { status: 500 }
    );
  }
}
