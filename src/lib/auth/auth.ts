import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@/lib/db';
import { authConfig } from '@/lib/auth/auth.config';
import { ADMIN_EMAIL } from '@/lib/auth/admin-email';

/**
 * Full Auth.js v5 configuration (server only).
 * Strategy: JWT sessions (enables edge-safe route protection via Proxy) with a
 * Prisma-backed user + account store. Google is the only sign-in provider.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt' },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      // A Gmail that already has a row (e.g. a pre-recorded privileged-role
      // request from /register) links to that existing user instead of
      // failing with OAuthAccountNotLinked.
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    signIn: async ({ user }) => {
      // Auto-assign ADMIN role for the single configured admin email (normalized).
      const email = user.email?.trim().toLowerCase() ?? '';
      if (email === ADMIN_EMAIL && email !== '' && user.id) {
        try {
          // Persist ADMIN on the stored user so it survives beyond the JWT and
          // any server-side checks that read from the DB. If the row doesn't
          // exist yet (first-time Google login races the PrismaAdapter user
          // creation), skip and let the adapter create it; the JWT callback
          // still stamps ADMIN for this session.
          await prisma.user.update({
            where: { id: user.id },
            data: { role: 'ADMIN' },
          });
        } catch {
          // The user row may not exist yet; PrismaAdapter will create it and
          // the JWT callback remains authoritative for the session role.
        }
      }
      return true;
    },
  },
});