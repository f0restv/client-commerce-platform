# TODO - Client Commerce Platform

## Phase 2: Merge from coinsite
- [x] AI analysis workflow (Claude Vision + market comps + auto-eval logic) - Already in ProductIntelligence service
- [x] Multi-method unlisting system (QR, barcode, SMS, email) - Added to src/lib/services/unlisting
- [ ] Inngest background job setup
- [x] Twilio SMS integration - Added to src/lib/services/notifications
- [x] SendGrid email integration - Added to src/lib/services/notifications

## Phase 3: Cleanup
- [x] Delete `clientpotal45NCC` repo (local deleted)
- [ ] Delete `clientpotal45NCC` repo on GitHub (needs user auth)
- [ ] Archive `coinsite` repo after merge complete

## Phase 4: Connect to 45north-site
- [ ] Add portal entry point/links to 45north-site
- [ ] Auth flow between marketing site and platform

## Backlog
- [ ] Platform API integrations (eBay, Etsy, etc.)
- [ ] Auction real-time bidding
- [ ] Stripe payment flow
- [ ] Admin dashboard
- [ ] Client onboarding flow
- [ ] Inngest background jobs for:
  - Submission analysis
  - Multi-platform listing
  - Price sync
  - Payout processing
