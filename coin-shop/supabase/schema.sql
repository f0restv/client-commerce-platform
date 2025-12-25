-- ==========================================
-- CoinVault E-Commerce Database Schema
-- Run this in your Supabase SQL Editor
-- ==========================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- USERS & AUTHENTICATION
-- ==========================================

CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('admin', 'client', 'customer')),
  stripe_customer_id TEXT,

  -- Client-specific fields
  company_name TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  tax_id TEXT,
  commission_rate DECIMAL(5,2) DEFAULT 15.00,
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- CATEGORIES
-- ==========================================

CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  image_url TEXT,
  parent_id UUID REFERENCES public.categories(id),
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default categories for coins
INSERT INTO public.categories (name, slug, description, position) VALUES
  ('US Coins', 'us-coins', 'United States coinage', 1),
  ('World Coins', 'world-coins', 'International coinage', 2),
  ('Ancient Coins', 'ancient-coins', 'Ancient and medieval coins', 3),
  ('Bullion', 'bullion', 'Gold, silver, and platinum bullion', 4),
  ('Paper Money', 'paper-money', 'Currency and banknotes', 5),
  ('Tokens & Medals', 'tokens-medals', 'Tokens, medals, and exonumia', 6),
  ('Coin Supplies', 'supplies', 'Holders, albums, and accessories', 7);

-- Subcategories
INSERT INTO public.categories (name, slug, description, parent_id, position)
SELECT 'Morgan Dollars', 'morgan-dollars', 'Morgan Silver Dollars 1878-1921', id, 1
FROM public.categories WHERE slug = 'us-coins';

INSERT INTO public.categories (name, slug, description, parent_id, position)
SELECT 'Peace Dollars', 'peace-dollars', 'Peace Silver Dollars 1921-1935', id, 2
FROM public.categories WHERE slug = 'us-coins';

INSERT INTO public.categories (name, slug, description, parent_id, position)
SELECT 'American Eagles', 'american-eagles', 'American Gold & Silver Eagles', id, 3
FROM public.categories WHERE slug = 'us-coins';

INSERT INTO public.categories (name, slug, description, parent_id, position)
SELECT 'Gold Bullion', 'gold-bullion', 'Gold bars and rounds', id, 1
FROM public.categories WHERE slug = 'bullion';

INSERT INTO public.categories (name, slug, description, parent_id, position)
SELECT 'Silver Bullion', 'silver-bullion', 'Silver bars and rounds', id, 2
FROM public.categories WHERE slug = 'bullion';

-- ==========================================
-- PRODUCTS
-- ==========================================

CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sku TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  short_description TEXT,

  -- Categorization
  category_id UUID NOT NULL REFERENCES public.categories(id),
  subcategory_id UUID REFERENCES public.categories(id),
  tags TEXT[] DEFAULT '{}',

  -- Pricing
  price DECIMAL(12,2) NOT NULL,
  cost DECIMAL(12,2),
  reserve_price DECIMAL(12,2),
  starting_bid DECIMAL(12,2),

  -- Metal content
  metal_type TEXT CHECK (metal_type IN ('gold', 'silver', 'platinum', 'palladium', 'copper', 'none')),
  metal_weight_oz DECIMAL(10,4),
  metal_purity DECIMAL(5,4),

  -- Coin specifics
  year INTEGER,
  mint TEXT,
  grade TEXT,
  certification TEXT,
  cert_number TEXT,
  diameter_mm DECIMAL(6,2),
  weight_grams DECIMAL(10,4),

  -- Listing type
  listing_type TEXT NOT NULL DEFAULT 'buy_now' CHECK (listing_type IN ('buy_now', 'auction', 'both')),
  auction_end_date TIMESTAMPTZ,

  -- Status
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'sold', 'reserved', 'archived')),
  quantity INTEGER NOT NULL DEFAULT 1,

  -- Consignment
  client_id UUID REFERENCES public.users(id),
  is_consignment BOOLEAN DEFAULT FALSE,
  consignment_rate DECIMAL(5,2),

  -- External listings
  ebay_listing_id TEXT,
  etsy_listing_id TEXT,
  auctionflex_listing_id TEXT,
  external_source_url TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  listed_at TIMESTAMPTZ,
  sold_at TIMESTAMPTZ
);

-- Product images
CREATE TABLE public.product_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  alt_text TEXT,
  position INTEGER DEFAULT 0,
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- AUCTIONS
-- ==========================================

CREATE TABLE public.auctions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID UNIQUE NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  starting_price DECIMAL(12,2) NOT NULL,
  reserve_price DECIMAL(12,2),
  current_bid DECIMAL(12,2),
  bid_increment DECIMAL(12,2) NOT NULL DEFAULT 1.00,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'ended', 'cancelled')),
  winner_id UUID REFERENCES public.users(id),
  winning_bid DECIMAL(12,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.bids (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auction_id UUID NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id),
  amount DECIMAL(12,2) NOT NULL,
  is_winning BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- ORDERS
-- ==========================================

CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number TEXT UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES public.users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'shipped', 'delivered', 'cancelled', 'refunded')),

  -- Totals
  subtotal DECIMAL(12,2) NOT NULL,
  tax DECIMAL(12,2) DEFAULT 0,
  shipping DECIMAL(12,2) DEFAULT 0,
  total DECIMAL(12,2) NOT NULL,

  -- Payment
  stripe_payment_intent_id TEXT,
  paid_at TIMESTAMPTZ,

  -- Shipping
  shipping_name TEXT,
  shipping_street1 TEXT,
  shipping_street2 TEXT,
  shipping_city TEXT,
  shipping_state TEXT,
  shipping_zip TEXT,
  shipping_country TEXT DEFAULT 'US',
  shipping_phone TEXT,
  tracking_number TEXT,
  shipped_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(12,2) NOT NULL,
  total DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- CLIENT SUBMISSIONS
-- ==========================================

CREATE TABLE public.client_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES public.users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'approved', 'rejected', 'listed')),

  -- Item details
  title TEXT NOT NULL,
  description TEXT,
  category_id UUID REFERENCES public.categories(id),

  -- Client estimates
  estimated_value DECIMAL(12,2),
  desired_price DECIMAL(12,2),

  -- AI Analysis (stored as JSONB)
  ai_analysis JSONB,

  -- Images (array of URLs)
  images TEXT[] DEFAULT '{}',

  -- Admin
  admin_notes TEXT,
  rejection_reason TEXT,
  product_id UUID REFERENCES public.products(id),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

-- ==========================================
-- INVOICES
-- ==========================================

CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_number TEXT UNIQUE NOT NULL,
  client_id UUID NOT NULL REFERENCES public.users(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')),

  -- Totals
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
  fees DECIMAL(12,2) DEFAULT 0,
  commission DECIMAL(12,2) DEFAULT 0,
  total_due DECIMAL(12,2) NOT NULL DEFAULT 0,
  amount_paid DECIMAL(12,2) DEFAULT 0,

  -- Payment
  stripe_invoice_id TEXT,
  payment_link TEXT,
  paid_at TIMESTAMPTZ,

  -- Dates
  due_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.invoice_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  product_id UUID REFERENCES public.products(id),
  sale_price DECIMAL(12,2),
  commission_rate DECIMAL(5,2),
  commission_amount DECIMAL(12,2),
  fees DECIMAL(12,2),
  net_amount DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- METAL PRICES
-- ==========================================

CREATE TABLE public.metal_prices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gold DECIMAL(12,2) NOT NULL,
  silver DECIMAL(12,2) NOT NULL,
  platinum DECIMAL(12,2) NOT NULL,
  palladium DECIMAL(12,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- PLATFORM LISTINGS
-- ==========================================

CREATE TABLE public.platform_listings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('ebay', 'etsy', 'auctionflex')),
  external_id TEXT NOT NULL,
  external_url TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended', 'sold', 'error')),
  error_message TEXT,
  listed_at TIMESTAMPTZ DEFAULT NOW(),
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, platform)
);

-- ==========================================
-- SCRAPED LISTINGS
-- ==========================================

CREATE TABLE public.scraped_listings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_url TEXT UNIQUE NOT NULL,
  source_platform TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  price DECIMAL(12,2),
  images TEXT[] DEFAULT '{}',
  raw_data JSONB,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'imported', 'ignored')),
  product_id UUID REFERENCES public.products(id),
  scraped_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- CART (Session-based, stored in browser)
-- But we'll have a wishlist table
-- ==========================================

CREATE TABLE public.wishlists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, product_id)
);

-- ==========================================
-- INDEXES
-- ==========================================

CREATE INDEX idx_products_category ON public.products(category_id);
CREATE INDEX idx_products_status ON public.products(status);
CREATE INDEX idx_products_listing_type ON public.products(listing_type);
CREATE INDEX idx_products_client ON public.products(client_id);
CREATE INDEX idx_products_metal ON public.products(metal_type);
CREATE INDEX idx_products_created ON public.products(created_at DESC);

CREATE INDEX idx_auctions_status ON public.auctions(status);
CREATE INDEX idx_auctions_end_date ON public.auctions(end_date);

CREATE INDEX idx_orders_user ON public.orders(user_id);
CREATE INDEX idx_orders_status ON public.orders(status);

CREATE INDEX idx_submissions_client ON public.client_submissions(client_id);
CREATE INDEX idx_submissions_status ON public.client_submissions(status);

CREATE INDEX idx_invoices_client ON public.invoices(client_id);
CREATE INDEX idx_invoices_status ON public.invoices(status);

-- ==========================================
-- ROW LEVEL SECURITY
-- ==========================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "Users can read own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- Everyone can read active products
CREATE POLICY "Anyone can read active products" ON public.products
  FOR SELECT USING (status = 'active');

-- Admins can do everything with products
CREATE POLICY "Admins can manage products" ON public.products
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Clients can see their own consignment products
CREATE POLICY "Clients can see own products" ON public.products
  FOR SELECT USING (client_id = auth.uid());

-- Everyone can read categories
CREATE POLICY "Anyone can read categories" ON public.categories
  FOR SELECT USING (true);

-- Everyone can read active auctions
CREATE POLICY "Anyone can read auctions" ON public.auctions
  FOR SELECT USING (true);

-- Users can read and create their own bids
CREATE POLICY "Users can read own bids" ON public.bids
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create bids" ON public.bids
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can read their own orders
CREATE POLICY "Users can read own orders" ON public.orders
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create orders" ON public.orders
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Clients can manage their submissions
CREATE POLICY "Clients can read own submissions" ON public.client_submissions
  FOR SELECT USING (client_id = auth.uid());

CREATE POLICY "Clients can create submissions" ON public.client_submissions
  FOR INSERT WITH CHECK (client_id = auth.uid());

CREATE POLICY "Clients can update own submissions" ON public.client_submissions
  FOR UPDATE USING (client_id = auth.uid() AND status = 'pending');

-- Clients can read their invoices
CREATE POLICY "Clients can read own invoices" ON public.invoices
  FOR SELECT USING (client_id = auth.uid());

-- Users can manage their wishlist
CREATE POLICY "Users can manage wishlist" ON public.wishlists
  FOR ALL USING (user_id = auth.uid());

-- ==========================================
-- FUNCTIONS
-- ==========================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_submissions_updated_at
  BEFORE UPDATE ON public.client_submissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Generate SKU
CREATE OR REPLACE FUNCTION generate_sku()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.sku IS NULL OR NEW.sku = '' THEN
    NEW.sku = 'CV-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
              UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER generate_product_sku
  BEFORE INSERT ON public.products
  FOR EACH ROW EXECUTE FUNCTION generate_sku();

-- Generate order number
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.order_number = 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
                     LPAD((FLOOR(RANDOM() * 10000))::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER generate_order_number
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION generate_order_number();

-- Generate invoice number
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.invoice_number = 'INV-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
                       LPAD((FLOOR(RANDOM() * 10000))::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER generate_invoice_number
  BEFORE INSERT ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION generate_invoice_number();

-- Handle new user creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'customer')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Calculate product melt value based on metal prices
CREATE OR REPLACE FUNCTION calculate_melt_value(
  p_metal_type TEXT,
  p_weight_oz DECIMAL,
  p_purity DECIMAL
)
RETURNS DECIMAL AS $$
DECLARE
  metal_price DECIMAL;
BEGIN
  IF p_metal_type IS NULL OR p_weight_oz IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT
    CASE p_metal_type
      WHEN 'gold' THEN gold
      WHEN 'silver' THEN silver
      WHEN 'platinum' THEN platinum
      WHEN 'palladium' THEN palladium
      ELSE 0
    END INTO metal_price
  FROM public.metal_prices
  ORDER BY created_at DESC
  LIMIT 1;

  RETURN ROUND(metal_price * p_weight_oz * COALESCE(p_purity, 1), 2);
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- VIEWS
-- ==========================================

-- Products with melt value
CREATE OR REPLACE VIEW public.products_with_melt AS
SELECT
  p.*,
  calculate_melt_value(p.metal_type, p.metal_weight_oz, p.metal_purity) as melt_value,
  c.name as category_name,
  c.slug as category_slug,
  (SELECT url FROM public.product_images WHERE product_id = p.id AND is_primary = true LIMIT 1) as primary_image
FROM public.products p
LEFT JOIN public.categories c ON p.category_id = c.id;

-- Active auctions
CREATE OR REPLACE VIEW public.active_auctions AS
SELECT
  a.*,
  p.title,
  p.description,
  (SELECT url FROM public.product_images WHERE product_id = p.id AND is_primary = true LIMIT 1) as image,
  (SELECT COUNT(*) FROM public.bids WHERE auction_id = a.id) as bid_count
FROM public.auctions a
JOIN public.products p ON a.product_id = p.id
WHERE a.status = 'active' AND a.end_date > NOW();
