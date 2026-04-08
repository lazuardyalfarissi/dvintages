import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Admin Login",
      credentials: {
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const correctPassword = process.env.ADMIN_PASSWORD;
        if (!correctPassword) {
          throw new Error("ADMIN_PASSWORD belum diset di environment variables");
        }
        if (credentials?.password === correctPassword) {
          // Return user object sederhana (karena hanya 1 admin)
          return { id: "1", name: "Admin", email: "admin@dvintages.com" };
        }
        return null;
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 jam
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.isAdmin = true;
      return token;
    },
    async session({ session, token }) {
      if (token.isAdmin) (session as any).isAdmin = true;
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
