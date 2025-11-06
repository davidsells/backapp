import { NextResponse } from 'next/server';

export async function POST() {
  // Registration is currently disabled
  return NextResponse.json(
    {
      success: false,
      error: 'Registration is currently disabled',
    },
    { status: 403 }
  );
}
