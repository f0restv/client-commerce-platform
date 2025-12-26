# Client Commerce Platform

A scalable marketplace and client portal for managing e-commerce on behalf of small businesses who can't or don't want to sell online. Built by 45° North Collective.

## Business Model

Small businesses submit inventory → AI analyzes and prices → Platform lists across multiple channels → Item sells → Business gets paid

**Value prop:** We handle all the complexity of online selling (photography, listings, multi-platform sync, customer service) so businesses can focus on what they do best.

## Core Features

### Client Portal
- Submit items with photos
- AI-powered analysis and pricing suggestions
- Track listing status across all platforms
- View sales and earnings
- Multi-method item removal (QR, barcode, SMS, email, portal)

### Multi-Platform Listing
- eBay
- Etsy
- AuctionFlex 360
- Whatnot
- HiBid
- Proxibid

### Pricing Intelligence
- AI market analysis (Claude Vision)
- Comparable sales lookup
- Metal spot price integration (for bullion/coins)
- Dynamic pricing support

### Auctions & Buy-Now
- Timed auctions with proxy bidding
- Reserve prices
- Buy-now option
- Real-time bid updates

### Admin Dashboard
- Submission review queue
- Auto-accept/decline based on margin thresholds
- Multi-platform inventory sync
- Invoicing and payouts

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Database:** PostgreSQL + Prisma
- **Auth:** NextAuth.js
- **AI:** Anthropic Claude
- **Payments:** Stripe
- **Background Jobs:** Inngest (planned)
- **Notifications:** Twilio SMS, SendGrid Email (planned)

## Getting Started

```bash
npm install
npm run db:generate
npm run dev
```

## Project Status

Active development. See [TODO.md](./TODO.md) for current priorities.

## License

Proprietary - 45° North Collective
