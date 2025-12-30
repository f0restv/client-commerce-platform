# Task: Stripe Subscriptions

## Objective
Enable Pro subscription tier with Stripe.

## Steps
1. Review existing Stripe setup in src/lib/stripe/
2. Create subscription products in Stripe dashboard (or via API):
   - Free tier: 5 scans/month
   - Pro tier: $9.99/month, unlimited scans, display aggregate pricing data
3. Build /pricing page showing tiers
4. Build /api/stripe/create-checkout endpoint
5. Build /api/stripe/webhook to handle subscription events
6. Update User model with stripeCustomerId, subscriptionStatus
7. Gate features based on tier (check in /api/v1/scan)
