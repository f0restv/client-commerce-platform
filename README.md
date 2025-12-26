# Client Commerce Platform

A scalable marketplace and client portal for managing e-commerce on behalf of small businesses who can't or don't want to sell online themselves.

## Overview

Small businesses often lack the time, expertise, or desire to manage online sales. This platform lets them:
- Submit inventory via a simple portal
- Get AI-powered market analysis and pricing suggestions
- Have items listed across multiple channels automatically
- Remove items easily if sold in-store (QR, SMS, email, barcode)
- Track sales and payouts

You handle listing, marketing, and sales. They ship to buyers. Everyone profits.

## Tech Stack

- **Frontend:** Next.js 14 (App Router)
- **Database:** PostgreSQL + Prisma
- **Auth:** NextAuth.js
- **AI:** Anthropic Claude (Vision + analysis)
- **Background Jobs:** Inngest
- **Notifications:** Twilio (SMS), SendGrid (Email)
- **Payments:** Stripe
- **Platforms:** eBay, Etsy, AuctionFlex, Whatnot, HiBid, Proxibid

## Core Features

- Client submission portal with drag-drop uploads
- AI-powered item identification and market comps
- Auto-accept/decline based on profitability thresholds
- Multi-channel listing sync
- Auction + buy-now support
- Real-time metal spot pricing integration
- Multi-method unlisting (QR, barcode, SMS, email, portal)
- Invoicing and payout tracking
- Admin dashboard for review workflows

## Getting Started

```bash
npm install
cp .env.example .env.local
npx prisma db push
npm run dev
```

## Related

- [45north-site](https://github.com/f0restv/45north-site) - Marketing site / client entry point

## License

Proprietary - All rights reserved
