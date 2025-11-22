import { NextResponse } from 'next/server';
import { prisma } from '@chess960/db';
import { authOptions } from '../auth/[...nextauth]/route';

export async function GET() {
  try {
    const results: Record<string, any> = {
      timestamp: new Date().toISOString(),
    };

    // Test 1: Database connection
    try {
      await prisma.$queryRaw`SELECT 1`;
      results.database = 'connected';
    } catch (error) {
      results.database = 'error';
      results.databaseError = error instanceof Error ? error.message : String(error);
    }

    // Test 2: Check Session table exists
    try {
      const sessionCount = await prisma.session.count();
      results.sessionTable = 'exists';
      results.sessionCount = sessionCount;
    } catch (error) {
      results.sessionTable = 'error';
      results.sessionTableError = error instanceof Error ? error.message : String(error);
    }

    // Test 3: Check User table exists
    try {
      const userCount = await prisma.user.count();
      results.userTable = 'exists';
      results.userCount = userCount;
    } catch (error) {
      results.userTable = 'error';
      results.userTableError = error instanceof Error ? error.message : String(error);
    }

    // Test 4: Check Account table exists
    try {
      const accountCount = await prisma.account.count();
      results.accountTable = 'exists';
      results.accountCount = accountCount;
    } catch (error) {
      results.accountTable = 'error';
      results.accountTableError = error instanceof Error ? error.message : String(error);
    }

    // Test 5: Environment variables
    results.env = {
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? 'SET' : 'MISSING',
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ? 'SET' : 'MISSING',
      GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ? 'SET' : 'MISSING',
      DATABASE_URL: process.env.DATABASE_URL ? 'SET' : 'MISSING',
      NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'NOT SET',
    };

    // Test 6: AuthOptions validation
    try {
      if (!authOptions.secret) {
        results.authOptions = 'error';
        results.authOptionsError = 'NEXTAUTH_SECRET is missing';
      } else {
        results.authOptions = 'valid';
      }
    } catch (error) {
      results.authOptions = 'error';
      results.authOptionsError = error instanceof Error ? error.message : String(error);
    }

    return NextResponse.json(results, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Test failed',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

