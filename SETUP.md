# CollektIQ - AI-Powered Collectibles Platform

Know what it's worth. Scan any coin, card, or collectible to get instant market values. AI-powered pricing for collectors and dealers.

## Features

### Core E-commerce
- **Instagram-style grid layout** - Modern, visual product browsing
- **Buy It Now & Auction support** - Dual listing types with real-time bidding
- **Category navigation** - US Coins, World Coins, Bullion, Certified, Collectibles
- **Product detail pages** - Rich media, specifications, and purchase options

### Client Portal
- **Item submission** - Upload photos and details for consignment
- **AI-powered valuation** - Claude integration for market analysis and pricing estimates
- **Submission tracking** - View status from pending to sold
- **Invoice management** - View, download, and pay invoices
- **Payout tracking** - See earnings and pending payouts

### Admin Dashboard
- **Product management** - Create, edit, and organize listings
- **Submission review** - Approve client submissions
- **Auction management** - Create and monitor auction events
- **Cross-listing** - Post to eBay, Etsy, AuctionFlex360

### Integrations
- **eBay** - Full API integration for listing and order sync
- **Etsy** - OAuth-based listing management
- **AuctionFlex360** - Auction lot management
- **Stripe** - Payment processing and invoicing
- **Claude AI** - Market analysis and coin identification

### Dynamic Pricing
- **Live metal price ticker** - Gold, Silver, Platinum, Palladium
- **Automatic price updates** - Products adjust based on spot prices
- **Premium calculations** - Percentage and flat premiums over spot

## Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js v5
- **Payments**: Stripe
- **AI**: Anthropic Claude API
- **File Uploads**: UploadThing (or AWS S3)
- **Background Jobs**: Bull + Redis

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Redis (for background jobs)
- API keys for integrations

### Installation

1. **Clone and install dependencies**
   ```bash
   npm install
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Initialize the database**
   ```bash
   npx prisma generate
   npx prisma db push
   ```

4. **Seed initial data (optional)**
   ```bash
   npx prisma db seed
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

## Environment Variables

See `.env.example` for all required variables:

### Required
- `DATABASE_URL` - PostgreSQL connection string
- `NEXTAUTH_SECRET` - Auth encryption key
- `NEXTAUTH_URL` - Your site URL

### Recommended
- `ANTHROPIC_API_KEY` - For AI features
- `STRIPE_SECRET_KEY` - For payments
- `METALS_API_KEY` - For live metal prices

### Platform Integrations
- `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`
- `ETSY_API_KEY`, `ETSY_SHARED_SECRET`
- `AUCTIONFLEX_API_KEY`

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   ├── shop/              # Public shop pages
│   ├── portal/            # Client portal
│   └── admin/             # Admin dashboard
├── components/
│   ├── ui/                # Base UI components
│   ├── shop/              # Shop-specific components
│   ├── portal/            # Portal components
│   ├── admin/             # Admin components
│   └── layout/            # Header, footer, etc.
├── lib/
│   ├── db.ts              # Prisma client
│   ├── auth.ts            # NextAuth configuration
│   ├── stripe.ts          # Stripe utilities
│   ├── claude.ts          # Claude AI integration
│   ├── metal-prices.ts    # Metal price fetching
│   ├── scraper.ts         # Market data scraping
│   └── integrations/      # Platform integrations
└── types/                 # TypeScript types
```

## Key Components

### Shop Components
- `ProductGrid` - Instagram-style product grid
- `MetalTicker` - Live metal price ticker
- `CategoryNav` - Category navigation
- `ProfileHeader` - Shop profile header
- `AuctionCard` - Auction item display

### Portal Components
- `SubmissionForm` - Item submission with AI analysis
- `SubmissionsList` - Track submitted items
- `InvoiceList` - View and pay invoices

## Database Schema

The Prisma schema includes:

- **Users & Auth** - Accounts, sessions, roles
- **Products** - Full inventory with metal content tracking
- **Auctions** - Timed auctions with bidding
- **Submissions** - Client consignment workflow
- **Orders & Invoices** - E-commerce transactions
- **Platform Listings** - Multi-platform sync
- **Metal Prices** - Historical price tracking

## API Endpoints

### Public
- `GET /api/products` - List products with filtering
- `GET /api/prices/metals` - Current metal prices

### Authenticated
- `POST /api/submissions` - Submit items for consignment
- `GET /api/submissions` - View your submissions
- `POST /api/ai/analyze` - AI market analysis

### Admin Only
- `POST /api/products` - Create products
- `POST /api/integrations/crosslist` - Cross-list to platforms

## Recommendations & Things You Might Be Missing

### Security
1. **SSL Certificate** - Required for production
2. **Rate Limiting** - Add to API routes
3. **Input Validation** - Zod schemas on all inputs
4. **File Upload Scanning** - Verify image uploads

### Performance
1. **Image Optimization** - Use Next.js Image with CDN
2. **Database Indexing** - Already included in schema
3. **Caching** - Redis for session and API responses
4. **Edge Functions** - Consider for metal price API

### Business Features
1. **Email Notifications** - Order confirmations, bid updates
2. **SMS Alerts** - Auction ending notifications
3. **Reporting** - Sales analytics dashboard
4. **Affiliate/Referral** - Program for client referrals

### SEO & Marketing
1. **Schema Markup** - Product structured data
2. **Sitemap** - Auto-generated sitemap.xml
3. **Meta Tags** - Dynamic OG images
4. **Blog/Content** - Numismatic content for SEO

### Legal/Compliance
1. **Terms of Service** - Consignment agreement
2. **Privacy Policy** - Data handling disclosure
3. **Cookie Consent** - GDPR compliance
4. **Shipping Policies** - Insurance, international

### Automation Opportunities
1. **Background Jobs** - Price updates, sync, emails
2. **Webhooks** - Platform order notifications
3. **Scheduled Tasks** - Auction endings, reminders
4. **Auto-posting** - Social media integration

## Hosting Recommendations

### Best Options for This Stack

1. **Vercel** (Recommended)
   - Perfect for Next.js
   - Edge functions
   - Easy deployment
   - Free tier available

2. **Railway**
   - PostgreSQL + Redis included
   - Simple pricing
   - Good for full-stack

3. **AWS/GCP/Azure**
   - Full control
   - Better for high traffic
   - More complex setup

### Database
- **Supabase** - PostgreSQL with extras
- **PlanetScale** - Serverless MySQL
- **Neon** - Serverless PostgreSQL

## Development Commands

```bash
# Development
npm run dev

# Build
npm run build

# Type check
npm run type-check

# Lint
npm run lint

# Database
npx prisma studio     # Open database viewer
npx prisma db push    # Push schema changes
npx prisma generate   # Regenerate client
```

## Support

For issues or questions, please open a GitHub issue.
