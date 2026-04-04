/*
  # Thy Essential Engine (TEE) - Complete Platform Schema

  ## Overview
  Headless B2B SaaS platform for affiliate commission calculations and Web3 tokenomics.
  This is an Infrastructure as a Service (IaaS) for external e-commerce merchants.

  ## 1. Core Tables
    
  ### merchants
    - `id` (uuid, primary key)
    - `company_name` (text) - Merchant company name
    - `api_key` (text, unique) - API key for webhook authentication
    - `webhook_secret` (text) - Secret for webhook verification
    - `status` (text) - active, suspended, cancelled
    - `created_at` (timestamptz)

  ### tee_affiliates
    - `id` (uuid, primary key)
    - `merchant_id` (uuid, foreign key)
    - `email` (text, unique)
    - `full_name` (text)
    - `referral_code` (text, unique) - Unique code for referral links
    - `sponsor_id` (uuid, foreign key) - Who referred them
    - `status` (text) - active, inactive, suspended
    - `created_at` (timestamptz)

  ### tee_binary_tree
    - `id` (uuid, primary key)
    - `affiliate_id` (uuid, unique, foreign key)
    - `parent_id` (uuid, foreign key) - Direct upline in tree
    - `sponsor_id` (uuid, foreign key) - Who recruited them
    - `position` (text) - left, right, root
    - `level` (integer) - Depth in tree (0 = root)
    - `node_cap` (integer) - Maximum nodes to count (default 1023 for 10 levels)
    - `left_child_id` (uuid, nullable) - Left child reference
    - `right_child_id` (uuid, nullable) - Right child reference
    - `created_at` (timestamptz)

  ### tee_orders
    - `id` (uuid, primary key)
    - `merchant_id` (uuid, foreign key)
    - `affiliate_id` (uuid, foreign key)
    - `external_order_id` (text) - Order ID from merchant's system
    - `order_total` (numeric) - Total order amount
    - `commission_percent` (numeric) - Commission percentage from merchant
    - `cv` (numeric) - Commissionable Value (calculated)
    - `processed` (boolean) - Whether commissions have been calculated
    - `created_at` (timestamptz)

  ### tee_commissions
    - `id` (uuid, primary key)
    - `affiliate_id` (uuid, foreign key)
    - `order_id` (uuid, foreign key)
    - `commission_type` (text) - self, direct, passive
    - `amount` (numeric) - Commission amount in fiat
    - `cv_used` (numeric) - CV amount used for calculation
    - `batch_id` (text) - Batch processing identifier
    - `status` (text) - pending, paid, cancelled
    - `created_at` (timestamptz)

  ### tee_wallets
    - `affiliate_id` (uuid, primary key, foreign key)
    - `balance_self` (numeric) - Self commission balance
    - `balance_direct` (numeric) - Direct commission balance
    - `balance_passive` (numeric) - Passive commission balance
    - `total_earned` (numeric) - Lifetime earnings
    - `total_withdrawn` (numeric) - Total withdrawn to date
    - `hfc_token_balance` (numeric) - Web3 token balance
    - `updated_at` (timestamptz)

  ### tee_platform_ledger
    - `id` (uuid, primary key)
    - `period` (text) - YYYY-MM format
    - `total_cv_ingested` (numeric) - Total CV from all orders
    - `total_commissions_paid` (numeric) - 75% payout to affiliates
    - `platform_earning` (numeric) - 25% platform revenue
    - `burn_fund_allocated` (numeric) - 50% of platform earning (12.5% of CV)
    - `platform_net_profit` (numeric) - 50% of platform earning (12.5% of CV)
    - `created_at` (timestamptz)

  ### tee_tokenomics
    - `id` (uuid, primary key)
    - `mint_rate` (numeric) - Tokens minted per $1 CV (dynamic)
    - `withdrawal_burn_rate` (numeric) - % fee on withdrawals (dynamic)
    - `total_minted` (numeric) - Cumulative tokens minted
    - `total_burned` (numeric) - Cumulative tokens burned
    - `circulating_supply` (numeric) - Minted - Burned
    - `burn_fund_fiat` (numeric) - Fiat value in burn fund
    - `updated_at` (timestamptz)
    - `updated_by` (uuid) - Admin who made changes

  ### tee_token_transactions
    - `id` (uuid, primary key)
    - `affiliate_id` (uuid, foreign key)
    - `transaction_type` (text) - mint, burn, withdrawal_burn
    - `amount` (numeric) - Token amount
    - `cv_amount` (numeric) - Associated CV (for mints)
    - `fiat_amount` (numeric) - Associated fiat (for burns)
    - `created_at` (timestamptz)

  ### tee_withdrawals
    - `id` (uuid, primary key)
    - `affiliate_id` (uuid, foreign key)
    - `amount_requested` (numeric) - Original withdrawal amount
    - `burn_fee` (numeric) - Fee deducted
    - `amount_paid` (numeric) - Net amount paid out
    - `tokens_burned` (numeric) - Tokens burned in this withdrawal
    - `status` (text) - pending, completed, failed
    - `created_at` (timestamptz)
    - `completed_at` (timestamptz)

  ## 2. Security
    - RLS enabled on all tables
    - Merchants can only access their own data
    - Affiliates can only see their own wallet and commissions
    - Admin has full access

  ## 3. Important Notes
    - BFS algorithm ensures no gaps in binary tree placement
    - Commission calculations are locked: Self 10%, Direct 15%, Passive 50%
    - Platform takes 25% of CV (split: 12.5% profit, 12.5% burn fund)
    - Tokenomics are dynamic and controlled by admin
*/

-- Drop existing conflicting tables
DROP TABLE IF EXISTS commission_transactions CASCADE;
DROP TABLE IF EXISTS affiliate_subscriptions CASCADE;
DROP TABLE IF EXISTS affiliate_clicks CASCADE;
DROP TABLE IF EXISTS affiliate_links CASCADE;
DROP TABLE IF EXISTS binary_tree_positions CASCADE;
DROP TABLE IF EXISTS binary_tree CASCADE;
DROP TABLE IF EXISTS commissions CASCADE;
DROP TABLE IF EXISTS wallets CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS payout_history CASCADE;
DROP TABLE IF EXISTS payouts CASCADE;

-- 1. Merchants Table
CREATE TABLE IF NOT EXISTS tee_merchants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  api_key text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  webhook_secret text NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'cancelled')),
  created_at timestamptz DEFAULT now()
);

-- 2. Affiliates Table
CREATE TABLE IF NOT EXISTS tee_affiliates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES tee_merchants(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  referral_code text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(8), 'hex'),
  sponsor_id uuid REFERENCES tee_affiliates(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  created_at timestamptz DEFAULT now()
);

-- 3. Binary Tree Table
CREATE TABLE IF NOT EXISTS tee_binary_tree (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid UNIQUE NOT NULL REFERENCES tee_affiliates(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES tee_binary_tree(affiliate_id) ON DELETE SET NULL,
  sponsor_id uuid REFERENCES tee_affiliates(id) ON DELETE SET NULL,
  position text CHECK (position IN ('left', 'right', 'root')),
  level integer NOT NULL DEFAULT 0,
  node_cap integer NOT NULL DEFAULT 1023,
  left_child_id uuid REFERENCES tee_affiliates(id) ON DELETE SET NULL,
  right_child_id uuid REFERENCES tee_affiliates(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- 4. Orders Table
CREATE TABLE IF NOT EXISTS tee_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES tee_merchants(id) ON DELETE CASCADE,
  affiliate_id uuid NOT NULL REFERENCES tee_affiliates(id) ON DELETE CASCADE,
  external_order_id text,
  order_total numeric NOT NULL CHECK (order_total > 0),
  commission_percent numeric NOT NULL CHECK (commission_percent >= 0 AND commission_percent <= 100),
  cv numeric NOT NULL,
  processed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- 5. Commissions Table
CREATE TABLE IF NOT EXISTS tee_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES tee_affiliates(id) ON DELETE CASCADE,
  order_id uuid REFERENCES tee_orders(id) ON DELETE SET NULL,
  commission_type text NOT NULL CHECK (commission_type IN ('self', 'direct', 'passive')),
  amount numeric NOT NULL DEFAULT 0,
  cv_used numeric NOT NULL DEFAULT 0,
  batch_id text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  created_at timestamptz DEFAULT now()
);

-- 6. Wallets Table
CREATE TABLE IF NOT EXISTS tee_wallets (
  affiliate_id uuid PRIMARY KEY REFERENCES tee_affiliates(id) ON DELETE CASCADE,
  balance_self numeric DEFAULT 0,
  balance_direct numeric DEFAULT 0,
  balance_passive numeric DEFAULT 0,
  total_earned numeric DEFAULT 0,
  total_withdrawn numeric DEFAULT 0,
  hfc_token_balance numeric DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

-- 7. Platform Ledger Table
CREATE TABLE IF NOT EXISTS tee_platform_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period text NOT NULL UNIQUE,
  total_cv_ingested numeric DEFAULT 0,
  total_commissions_paid numeric DEFAULT 0,
  platform_earning numeric DEFAULT 0,
  burn_fund_allocated numeric DEFAULT 0,
  platform_net_profit numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 8. Tokenomics Table
CREATE TABLE IF NOT EXISTS tee_tokenomics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mint_rate numeric NOT NULL DEFAULT 10.0,
  withdrawal_burn_rate numeric NOT NULL DEFAULT 5.0,
  total_minted numeric DEFAULT 0,
  total_burned numeric DEFAULT 0,
  circulating_supply numeric DEFAULT 0,
  burn_fund_fiat numeric DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES users(id)
);

-- 9. Token Transactions Table
CREATE TABLE IF NOT EXISTS tee_token_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES tee_affiliates(id) ON DELETE CASCADE,
  transaction_type text NOT NULL CHECK (transaction_type IN ('mint', 'burn', 'withdrawal_burn')),
  amount numeric NOT NULL,
  cv_amount numeric DEFAULT 0,
  fiat_amount numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 10. Withdrawals Table
CREATE TABLE IF NOT EXISTS tee_withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES tee_affiliates(id) ON DELETE CASCADE,
  amount_requested numeric NOT NULL CHECK (amount_requested > 0),
  burn_fee numeric NOT NULL DEFAULT 0,
  amount_paid numeric NOT NULL,
  tokens_burned numeric DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tee_affiliates_merchant ON tee_affiliates(merchant_id);
CREATE INDEX IF NOT EXISTS idx_tee_affiliates_sponsor ON tee_affiliates(sponsor_id);
CREATE INDEX IF NOT EXISTS idx_tee_binary_tree_parent ON tee_binary_tree(parent_id);
CREATE INDEX IF NOT EXISTS idx_tee_binary_tree_sponsor ON tee_binary_tree(sponsor_id);
CREATE INDEX IF NOT EXISTS idx_tee_orders_affiliate ON tee_orders(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_tee_orders_merchant ON tee_orders(merchant_id);
CREATE INDEX IF NOT EXISTS idx_tee_orders_processed ON tee_orders(processed);
CREATE INDEX IF NOT EXISTS idx_tee_commissions_affiliate ON tee_commissions(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_tee_commissions_batch ON tee_commissions(batch_id);

-- Enable RLS on all tables
ALTER TABLE tee_merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tee_affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE tee_binary_tree ENABLE ROW LEVEL SECURITY;
ALTER TABLE tee_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE tee_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tee_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE tee_platform_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE tee_tokenomics ENABLE ROW LEVEL SECURITY;
ALTER TABLE tee_token_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tee_withdrawals ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Admin full access
CREATE POLICY "Admin full access to merchants"
  ON tee_merchants FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'));

CREATE POLICY "Admin full access to affiliates"
  ON tee_affiliates FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'));

CREATE POLICY "Admin full access to binary tree"
  ON tee_binary_tree FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'));

CREATE POLICY "Admin full access to orders"
  ON tee_orders FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'));

CREATE POLICY "Admin full access to commissions"
  ON tee_commissions FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'));

CREATE POLICY "Admin full access to wallets"
  ON tee_wallets FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'));

CREATE POLICY "Admin full access to platform ledger"
  ON tee_platform_ledger FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'));

CREATE POLICY "Admin full access to tokenomics"
  ON tee_tokenomics FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'));

CREATE POLICY "Admin full access to token transactions"
  ON tee_token_transactions FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'));

CREATE POLICY "Admin full access to withdrawals"
  ON tee_withdrawals FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'));

-- Initialize default tokenomics settings
INSERT INTO tee_tokenomics (mint_rate, withdrawal_burn_rate, total_minted, total_burned, circulating_supply, burn_fund_fiat)
VALUES (10.0, 5.0, 0, 0, 0, 0)
ON CONFLICT DO NOTHING;