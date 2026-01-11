/*
  # HFC Protocol System Schema

  1. New Tables
    - `profiles` - User profiles with sponsor relationships
    - `packages` - Affiliate packages with depth and cap settings
    - `binary_tree` - Binary tree structure for placement
    - `wallets` - User wallet balances (self, direct, passive)
    - `orders` - Purchase orders with CV tracking
    - `products` - Marketplace products
    - `payout_history` - Payout tracking

  2. Key Features
    - Depth-based passive commission formula
    - Binary tree auto-placement
    - Monthly batch processing support
    - Self (10%), Direct (15%), Passive (50% pool) commissions
*/

-- Drop existing tables that conflict
DROP TABLE IF EXISTS payout_history CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS wallets CASCADE;
DROP TABLE IF EXISTS binary_tree CASCADE;
DROP TABLE IF EXISTS packages CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- Profiles table
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  roles text[] DEFAULT ARRAY['consumer'],
  sponsor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  current_package_id uuid,
  vendor_name text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Packages table
CREATE TABLE packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  price decimal(10,2) NOT NULL,
  cv_value decimal(10,2) NOT NULL,
  cap_limit integer DEFAULT 10,
  min_depth integer DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

-- Binary tree table
CREATE TABLE binary_tree (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  upline_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  position text CHECK (position IN ('left', 'right', 'root')),
  created_at timestamptz DEFAULT now()
);

-- Wallets table
CREATE TABLE wallets (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance_self decimal(12,2) DEFAULT 0,
  balance_direct decimal(12,2) DEFAULT 0,
  balance_passive decimal(12,2) DEFAULT 0,
  total_earnings decimal(12,2) DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

-- Orders table
CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  package_id uuid REFERENCES packages(id) ON DELETE SET NULL,
  product_id uuid,
  amount decimal(10,2) NOT NULL,
  cv_snapshot decimal(10,2) NOT NULL,
  type text CHECK (type IN ('package', 'renewal', 'product')),
  period text,
  created_at timestamptz DEFAULT now()
);

-- Products table
CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price decimal(10,2) NOT NULL,
  cv_value decimal(10,2) NOT NULL,
  final_price decimal(10,2) NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Payout history table
CREATE TABLE payout_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount decimal(10,2) NOT NULL,
  type text,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

-- Add foreign key after profiles table exists
ALTER TABLE profiles ADD CONSTRAINT fk_package FOREIGN KEY (current_package_id) REFERENCES packages(id) ON DELETE SET NULL;
ALTER TABLE orders ADD CONSTRAINT fk_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX idx_profiles_sponsor ON profiles(sponsor_id);
CREATE INDEX idx_binary_tree_upline ON binary_tree(upline_id);
CREATE INDEX idx_orders_buyer ON orders(buyer_id);
CREATE INDEX idx_orders_period ON orders(period);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE binary_tree ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies (Allow service role full access)
CREATE POLICY "Service role full access profiles" ON profiles FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access packages" ON packages FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access binary_tree" ON binary_tree FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access wallets" ON wallets FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access orders" ON orders FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access products" ON products FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access payout_history" ON payout_history FOR ALL TO service_role USING (true) WITH CHECK (true);

-- User policies
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "Users can view packages" ON packages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can view own wallet" ON wallets FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can view own orders" ON orders FOR SELECT TO authenticated USING (buyer_id = auth.uid());
CREATE POLICY "Users can view products" ON products FOR SELECT TO authenticated USING (true);
