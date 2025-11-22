import { NextResponse } from 'next/server';

export async function GET() {
  // Check environment variables at runtime
  const envCheck = {
    NEXTAUTH_SECRET: {
      exists: !!process.env.NEXTAUTH_SECRET,
      length: process.env.NEXTAUTH_SECRET?.length || 0,
      firstChars: process.env.NEXTAUTH_SECRET?.substring(0, 5) + '...' || 'MISSING',
    },
    GOOGLE_CLIENT_ID: {
      exists: !!process.env.GOOGLE_CLIENT_ID,
      length: process.env.GOOGLE_CLIENT_ID?.length || 0,
      firstChars: process.env.GOOGLE_CLIENT_ID?.substring(0, 10) + '...' || 'MISSING',
    },
    GOOGLE_CLIENT_SECRET: {
      exists: !!process.env.GOOGLE_CLIENT_SECRET,
      length: process.env.GOOGLE_CLIENT_SECRET?.length || 0,
      firstChars: process.env.GOOGLE_CLIENT_SECRET?.substring(0, 5) + '...' || 'MISSING',
    },
    DATABASE_URL: {
      exists: !!process.env.DATABASE_URL,
      length: process.env.DATABASE_URL?.length || 0,
      // Show only the protocol and host, not credentials
      preview: process.env.DATABASE_URL
        ? process.env.DATABASE_URL.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')
        : 'MISSING',
    },
    NEXTAUTH_URL: {
      exists: !!process.env.NEXTAUTH_URL,
      value: process.env.NEXTAUTH_URL || 'NOT SET',
      hasQuotes: process.env.NEXTAUTH_URL?.startsWith('"') || false,
    },
  };

  // Check for common issues
  const issues: string[] = [];
  
  if (!envCheck.NEXTAUTH_SECRET.exists) {
    issues.push('NEXTAUTH_SECRET is missing');
  } else if (envCheck.NEXTAUTH_SECRET.length < 32) {
    issues.push('NEXTAUTH_SECRET seems too short (should be at least 32 characters)');
  }

  if (!envCheck.GOOGLE_CLIENT_ID.exists) {
    issues.push('GOOGLE_CLIENT_ID is missing');
  }

  if (!envCheck.GOOGLE_CLIENT_SECRET.exists) {
    issues.push('GOOGLE_CLIENT_SECRET is missing');
  }

  if (!envCheck.DATABASE_URL.exists) {
    issues.push('DATABASE_URL is missing');
  }

  if (envCheck.NEXTAUTH_URL.hasQuotes) {
    issues.push('NEXTAUTH_URL has quotes - this might cause issues. Should be: http://localhost:3000 (without quotes)');
  }

  if (!envCheck.NEXTAUTH_URL.exists || envCheck.NEXTAUTH_URL.value === 'NOT SET') {
    issues.push('NEXTAUTH_URL is not set - should be http://localhost:3000 for local development');
  }

  return NextResponse.json({
    status: issues.length === 0 ? 'OK' : 'ISSUES FOUND',
    issues,
    environment: envCheck,
    nodeEnv: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
}

