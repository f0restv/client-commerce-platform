# Task: Verify Production Deploy

## Checks
1. Visit https://collektiq.com - does it load without auth wall?
2. If auth wall, check Vercel deployment protection settings
3. Test /api/v1/analyze endpoint with curl
4. Check Vercel env vars are set (via vercel env ls or dashboard)
5. Create /api/health if missing

## Report
- Site accessible: yes/no
- API working: yes/no
- Missing env vars: list them
