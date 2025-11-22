import NextAuth, { NextAuthOptions } from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import GoogleProvider from 'next-auth/providers/google';
import EmailProvider from 'next-auth/providers/email';
import { prisma } from '@chess960/db';
// import { getServerPosthog } from '@/lib/posthog-server';

// Force Node.js runtime for NextAuth
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  secret: process.env.NEXTAUTH_SECRET,
  // @ts-ignore - trustHost is valid in NextAuth v4 but types may not reflect it
  trustHost: true, // Required for NextAuth v4
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    EmailProvider({
      from: process.env.EMAIL_FROM || 'Chess960 <noreply@chess960.game>',
      async sendVerificationRequest({ identifier: email, url, provider }) {
        try {
          console.log('Sending verification email to:', email);
          console.log('RESEND_API_KEY exists:', !!process.env.RESEND_API_KEY);
          console.log('From address:', provider.from);
          console.log('Magic link URL:', url);

          const { host } = new URL(url);

          // Dynamically import Resend for serverless compatibility
          const { Resend } = await import('resend');
          const resend = new Resend(process.env.RESEND_API_KEY);

          const { data, error } = await resend.emails.send({
            from: provider.from as string,
            to: email,
            subject: `Sign in to ${host}`,
            html: `
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <title>Sign in to ${host}</title>
                <style>
                  .container { max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, sans-serif; }
                  .header { background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: white; padding: 24px; text-align: center; border-radius: 8px 8px 0 0; }
                  .content { background: #ffffff; padding: 32px; border: 1px solid #e5e7eb; text-align: center; }
                  .button { display: inline-block; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 16px 0; }
                  .footer { background: #f9fafb; padding: 16px; text-align: center; color: #6b7280; border-radius: 0 0 8px 8px; font-size: 14px; }
                </style>
              </head>
              <body style="background-color: #f3f4f6; margin: 0; padding: 20px;">
                <div class="container">
                  <div class="header">
                    <h1 style="margin: 0; font-size: 24px;">Chess960</h1>
                  </div>
                  <div class="content">
                    <h2 style="color: #111827; margin-top: 0; margin-bottom: 12px;">Sign in to your account</h2>
                    <p style="color: #374151; line-height: 1.6; margin-bottom: 24px;">
                      Click the button below to sign in to Chess960.
                    </p>
                    <div style="margin: 32px 0;">
                      <a href="${url}" class="button">Sign In to Chess960</a>
                    </div>
                  </div>
                  <div class="footer">
                    <p style="margin: 0;">
                      Chess960 - Fischer Random Chess<br>
                      <a href="https://chess960.game" style="color: #f97316;">Visit chess960.game</a>
                    </p>
                  </div>
                </div>
              </body>
              </html>
            `,
          });

          if (error) {
            console.error('Resend error:', error);
            throw new Error(`Resend API error: ${JSON.stringify(error)}`);
          }

          console.log('Email sent successfully via Resend API:', data);
        } catch (error) {
          console.error('Failed to send email:', error);
          console.error('Error details:', error instanceof Error ? error.message : JSON.stringify(error));
          throw new Error(`Failed to send verification email: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      },
    }),
  ],
  pages: {
    signIn: '/auth/signin',
    verifyRequest: '/auth/verify-request',
    error: '/auth/error',
  },
  callbacks: {
    async redirect({ url, baseUrl }) {
      // If user is signing in, redirect to setup-username if they don't have a handle
      if (url === baseUrl || url === `${baseUrl}/`) {
        return `${baseUrl}/auth/setup-username`;
      }
      // If it's a relative URL, make it absolute
      if (url.startsWith('/')) {
        return `${baseUrl}${url}`;
      }
      // If it's the same origin, allow it
      if (url.startsWith(baseUrl)) {
        return url;
      }
      // Otherwise, redirect to base URL
      return baseUrl;
    },
    async session({ session, user }) {
      try {
        if (session.user && user) {
          session.user.id = user.id;
          // Add custom fields from your user model
          const dbUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: { handle: true, ratings: true },
          });
          if (dbUser) {
            (session.user as any).handle = dbUser.handle;
            (session.user as any).ratings = dbUser.ratings;
          }
        }
        return session;
      } catch (error) {
        console.error('Session callback error:', error);
        // Return session even if custom fields fail to load
        return session;
      }
    },
    async signIn({ user, account, profile }) {
      try {
        console.log('SignIn callback triggered', { 
          userId: user.id, 
          provider: account?.provider,
          profileName: profile?.name,
          profileEmail: profile?.email 
        });

        if (!user.id) {
          console.error('No user ID in signIn callback');
          return true; // Still allow sign-in attempt
        }

        // Check if user exists and update/create handle if needed
        const existingUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { id: true, handle: true, createdAt: true },
        });

        if (!existingUser) {
          console.error('User not found in database after creation:', user.id);
          return true; // Still allow sign-in, adapter will handle it
        }

        // Don't auto-generate handle - let user choose it on setup-username page
        // Just update lastActivityAt
        await prisma.user.update({
          where: { id: user.id },
          data: { lastActivityAt: new Date() },
        });

        // Track user sign up or sign in
        // TODO: Re-enable PostHog tracking after fixing webpack bundling issue
        // const posthog = getServerPosthog();
        // if (posthog && user.id) {
        //   try {
        //     const dbUser = await prisma.user.findUnique({
        //       where: { id: user.id },
        //       select: { handle: true, createdAt: true },
        //     });

        //     const isNew = isNewUser || (dbUser && new Date().getTime() - new Date(dbUser.createdAt).getTime() < 5000);

        //     posthog.capture({
        //       distinctId: user.id,
        //       event: isNew ? 'user_signed_up' : 'user_signed_in',
        //       properties: {
        //         handle: dbUser?.handle,
        //         provider: account?.provider,
        //         email: user.email,
        //       },
        //     });

        //     if (isNew) {
        //       posthog.identify({
        //         distinctId: user.id,
        //         properties: {
        //           handle: dbUser?.handle,
        //           email: user.email,
        //           signed_up_at: new Date().toISOString(),
        //         },
        //       });
        //     }

        //     await posthog.shutdown();
        //   } catch (error) {
        //     console.error('PostHog tracking error:', error);
        //   }
        // }

        console.log('SignIn callback completed successfully');
        return true;
      } catch (error) {
        console.error('SignIn callback error:', error);
        // Still allow sign in even if tracking fails
        return true;
      }
    },
  },
  session: {
    strategy: 'database',
  },
  debug: process.env.NODE_ENV === 'development',
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
