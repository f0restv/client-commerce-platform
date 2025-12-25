# CoinVault - Coin & Collectibles E-Commerce Platform

A modern, Instagram-style shoppable website for coin and collectibles dealers. Built with Next.js 14, Supabase, and integrated with multiple marketplace platforms.

## Features

### Core E-Commerce
- **Instagram-style Product Grid**: Modern, visual-first product display
- **Buy It Now & Auctions**: Support for both fixed-price and auction listings
- **Real-time Auction Countdown**: Live bid tracking with countdown timers
- **Shopping Cart**: Persistent cart with guest and logged-in support
- **Secure Checkout**: Stripe integration for payments

### Client Portal
- **Item Submission**: Clients can submit items for consignment
- **AI-Powered Valuations**: Claude AI integration for instant price estimates
- **Submission Tracking**: View status of all submitted items
- **Invoice Management**: View and pay invoices online
- **Earnings Dashboard**: Track sales and commissions

### Multi-Platform Integration
- **eBay**: List and sync with eBay marketplace
- **Etsy**: Post to Etsy shop automatically
- **AuctionFlex360**: Integration with auction platform
- **Auto-sync**: Inventory syncs across all platforms
- **Unified Management**: Manage all listings from one dashboard

### Listing Scraper
- **Multi-source Search**: Search eBay, Heritage Auctions, APMEX
- **URL Scraping**: Import any supported listing by URL
- **Bulk Import**: Select and import multiple listings at once
- **Price Comparison**: See market prices for similar items

### Precious Metals
- **Live Ticker**: Real-time gold, silver, platinum, palladium prices
- **Melt Value Calculation**: Auto-calculate metal content value
- **Price-based Listings**: Items that update based on spot prices

### Admin Dashboard
- **Sales Analytics**: Revenue, orders, conversion tracking
- **Client Management**: Manage consignment clients
- **Inventory Alerts**: Low stock notifications
- **Platform Status**: Monitor all marketplace connections

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: PostgreSQL via Supabase
- **Authentication**: Supabase Auth
- **Payments**: Stripe
- **AI**: Claude (Anthropic)
- **State Management**: Zustand
- **Forms**: React Hook Form + Zod

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Supabase account
- Stripe account
- Anthropic API key (for Claude AI)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd coin-shop
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

4. Configure your `.env.local` with:
```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_key
STRIPE_SECRET_KEY=your_stripe_secret
STRIPE_WEBHOOK_SECRET=your_webhook_secret

# Claude AI
ANTHROPIC_API_KEY=your_anthropic_key

# Metals API
METALS_API_KEY=your_metals_api_key

# Platform APIs (optional)
EBAY_APP_ID=your_ebay_app_id
ETSY_API_KEY=your_etsy_api_key
AUCTIONFLEX_API_KEY=your_auctionflex_key
```

5. Set up the database:
- Go to your Supabase dashboard
- Run the SQL from `supabase/schema.sql` in the SQL Editor

6. Run the development server:
```bash
npm run dev
```

7. Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
coin-shop/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── admin/             # Admin dashboard
│   │   ├── api/               # API routes
│   │   ├── auth/              # Authentication pages
│   │   ├── client-portal/     # Client portal
│   │   └── shop/              # Shop pages
│   ├── components/
│   │   ├── admin/             # Admin components
│   │   ├── layout/            # Layout components
│   │   ├── portal/            # Client portal components
│   │   ├── shop/              # Shop components
│   │   └── ui/                # Reusable UI components
│   ├── lib/
│   │   ├── claude/            # Claude AI integration
│   │   ├── platforms/         # eBay, Etsy, AuctionFlex
│   │   ├── scrapers/          # Listing scrapers
│   │   ├── stripe/            # Payment integration
│   │   ├── supabase/          # Database client
│   │   └── utils/             # Utility functions
│   ├── store/                 # Zustand stores
│   └── types/                 # TypeScript types
├── supabase/
│   └── schema.sql             # Database schema
└── public/                    # Static assets
```

## Key Features Explained

### Claude AI Integration
The platform uses Claude AI to analyze coin submissions:
- Image recognition for coin identification
- Grade estimation based on visible condition
- Market value analysis with price ranges
- Recent sales data compilation
- Selling recommendations

### Multi-Platform Listing
Products can be automatically listed on:
- Your website (primary)
- eBay (via Trading API)
- Etsy (via Open API)
- AuctionFlex360 (auction platform)

Inventory syncs automatically to prevent overselling.

### Consignment Workflow
1. Client submits item with photos
2. AI provides instant valuation
3. Admin reviews and approves
4. Item is listed across platforms
5. When sold, invoice is generated
6. Client receives payment (minus commission)

## API Routes

- `POST /api/claude/analyze` - AI item analysis
- `GET /api/metals` - Live metal prices
- `POST /api/webhooks/stripe` - Stripe webhooks
- Additional routes for products, orders, etc.

## Deployment

### Vercel (Recommended)
1. Push to GitHub
2. Import project in Vercel
3. Configure environment variables
4. Deploy

### Other Platforms
The app can be deployed on any platform supporting Next.js:
- Netlify
- Railway
- AWS Amplify
- Self-hosted with Docker

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For questions or issues, please open a GitHub issue.
