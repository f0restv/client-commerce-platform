# Task: User Authentication

## Objective
Set up NextAuth with user accounts, Pro subscriptions tracking.

## Steps
1. Configure NextAuth in src/app/api/auth/[...nextauth]/route.ts
2. Providers: Google, Email/password (with secure password hashing, e.g. bcrypt, and minimum password strength checks)
3. Use existing Prisma User model
4. Create sign-in/sign-up pages
5. Protect routes: /dashboard, /inventory, /scan (require login)
6. Add subscription tier field (free/pro) to User model if missing
7. Implement email verification flow for email/password sign-ups (send verification email and require verification before full access)
8. Create /api/user/profile endpoint

## Env vars needed
- NEXTAUTH_SECRET (generate if missing)
- NEXTAUTH_URL=https://collektiq.com
- GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
