/*
  # Add Affiliate Packages and Binary Tree Structure

  1. New Tables
    - `affiliate_packages`
      - `id` (uuid, primary key)
      - `name` (text) - Package name (Bronze, Silver, Gold, etc.)
      - `price` (decimal) - Package price
      - `max_tree_depth` (integer) - Maximum depth for commission earning
      - `direct_commission_rate` (decimal) - Commission rate for direct referrals
      - `level_2_commission_rate` (decimal) - Commission rate for level 2
      - `level_3_commission_rate` (decimal) - Commission rate for level 3
      - `max_width` (integer) - Maximum width (2 for binary)
      - `matching_bonus_rate` (decimal) - Bonus when both legs are balanced
      - `status` (text) - active/inactive
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `affiliate_subscriptions`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `package_id` (uuid, foreign key to affiliate_packages)
      - `status` (text) - active/expired/cancelled
      - `subscribed_at` (timestamptz)
      - `expires_at` (timestamptz)
      - `created_at` (timestamptz)
    
    - `binary_tree_positions`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users) - The affiliate in this position
      - `sponsor_id` (uuid, foreign key to users) - Who referred them
      - `parent_id` (uuid, foreign key to binary_tree_positions) - Parent node in tree
      - `position` (text) - 'left' or 'right'
      - `level` (integer) - Depth level in tree (0 = root)
      - `left_sales_volume` (decimal) - Total sales volume from left leg
      - `right_sales_volume` (decimal) - Total sales volume from right leg
      - `total_sales_volume` (decimal) - Total personal + downline sales
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `commission_transactions`
      - `id` (uuid, primary key)
      - `affiliate_id` (uuid, foreign key to users)
      - `order_id` (uuid, foreign key to orders)
      - `commission_type` (text) - 'direct', 'level_2', 'level_3', 'matching_bonus'
      - `amount` (decimal)
      - `level` (integer) - Which level this commission came from
      - `from_user_id` (uuid) - User who generated the sale
      - `status` (text) - 'pending', 'paid', 'cancelled'
      - `paid_at` (timestamptz)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all new tables
    - Add policies for affiliates to view their own data
    - Add policies for admins to manage everything
*/

-- Create affiliate packages table
CREATE TABLE IF NOT EXISTS affiliate_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  price decimal(10,2) NOT NULL DEFAULT 0,
  max_tree_depth integer NOT NULL DEFAULT 3,
  direct_commission_rate decimal(5,2) NOT NULL DEFAULT 10.00,
  level_2_commission_rate decimal(5,2) NOT NULL DEFAULT 5.00,
  level_3_commission_rate decimal(5,2) NOT NULL DEFAULT 2.50,
  max_width integer NOT NULL DEFAULT 2,
  matching_bonus_rate decimal(5,2) NOT NULL DEFAULT 5.00,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create affiliate subscriptions table
CREATE TABLE IF NOT EXISTS affiliate_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  package_id uuid NOT NULL REFERENCES affiliate_packages(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active',
  subscribed_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, package_id)
);

-- Create binary tree positions table
CREATE TABLE IF NOT EXISTS binary_tree_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  sponsor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  parent_id uuid REFERENCES binary_tree_positions(id) ON DELETE SET NULL,
  position text CHECK (position IN ('left', 'right', 'root')),
  level integer NOT NULL DEFAULT 0,
  left_sales_volume decimal(12,2) NOT NULL DEFAULT 0,
  right_sales_volume decimal(12,2) NOT NULL DEFAULT 0,
  total_sales_volume decimal(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create commission transactions table
CREATE TABLE IF NOT EXISTS commission_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  commission_type text NOT NULL CHECK (commission_type IN ('direct', 'level_2', 'level_3', 'matching_bonus', 'vendor')),
  amount decimal(10,2) NOT NULL DEFAULT 0,
  level integer NOT NULL DEFAULT 1,
  from_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  paid_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_binary_tree_parent ON binary_tree_positions(parent_id);
CREATE INDEX IF NOT EXISTS idx_binary_tree_sponsor ON binary_tree_positions(sponsor_id);
CREATE INDEX IF NOT EXISTS idx_binary_tree_user ON binary_tree_positions(user_id);
CREATE INDEX IF NOT EXISTS idx_commission_affiliate ON commission_transactions(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_commission_order ON commission_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_sub_user ON affiliate_subscriptions(user_id);

-- Enable RLS
ALTER TABLE affiliate_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE binary_tree_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_transactions ENABLE ROW LEVEL SECURITY;

-- Policies for affiliate_packages (public read, admin manage)
CREATE POLICY "Anyone can view active packages"
  ON affiliate_packages FOR SELECT
  TO authenticated
  USING (status = 'active');

CREATE POLICY "Admins can manage packages"
  ON affiliate_packages FOR ALL
  TO authenticated
  USING ((SELECT role FROM user_roles WHERE user_id = auth.uid() AND role = 'admin' AND status = 'active' LIMIT 1) = 'admin')
  WITH CHECK ((SELECT role FROM user_roles WHERE user_id = auth.uid() AND role = 'admin' AND status = 'active' LIMIT 1) = 'admin');

-- Policies for affiliate_subscriptions
CREATE POLICY "Users can view their own subscriptions"
  ON affiliate_subscriptions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create their own subscriptions"
  ON affiliate_subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all subscriptions"
  ON affiliate_subscriptions FOR SELECT
  TO authenticated
  USING ((SELECT role FROM user_roles WHERE user_id = auth.uid() AND role = 'admin' AND status = 'active' LIMIT 1) = 'admin');

CREATE POLICY "Admins can manage all subscriptions"
  ON affiliate_subscriptions FOR ALL
  TO authenticated
  USING ((SELECT role FROM user_roles WHERE user_id = auth.uid() AND role = 'admin' AND status = 'active' LIMIT 1) = 'admin')
  WITH CHECK ((SELECT role FROM user_roles WHERE user_id = auth.uid() AND role = 'admin' AND status = 'active' LIMIT 1) = 'admin');

-- Policies for binary_tree_positions
CREATE POLICY "Users can view their own tree position"
  ON binary_tree_positions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can view their downline positions"
  ON binary_tree_positions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM binary_tree_positions parent
      WHERE parent.user_id = auth.uid()
      AND (
        binary_tree_positions.parent_id = parent.id
        OR binary_tree_positions.sponsor_id = auth.uid()
      )
    )
  );

CREATE POLICY "Admins can view all positions"
  ON binary_tree_positions FOR SELECT
  TO authenticated
  USING ((SELECT role FROM user_roles WHERE user_id = auth.uid() AND role = 'admin' AND status = 'active' LIMIT 1) = 'admin');

CREATE POLICY "Admins can manage positions"
  ON binary_tree_positions FOR ALL
  TO authenticated
  USING ((SELECT role FROM user_roles WHERE user_id = auth.uid() AND role = 'admin' AND status = 'active' LIMIT 1) = 'admin')
  WITH CHECK ((SELECT role FROM user_roles WHERE user_id = auth.uid() AND role = 'admin' AND status = 'active' LIMIT 1) = 'admin');

-- Policies for commission_transactions
CREATE POLICY "Affiliates can view their own commissions"
  ON commission_transactions FOR SELECT
  TO authenticated
  USING (affiliate_id = auth.uid());

CREATE POLICY "Admins can view all commissions"
  ON commission_transactions FOR SELECT
  TO authenticated
  USING ((SELECT role FROM user_roles WHERE user_id = auth.uid() AND role = 'admin' AND status = 'active' LIMIT 1) = 'admin');

CREATE POLICY "Admins can manage commissions"
  ON commission_transactions FOR ALL
  TO authenticated
  USING ((SELECT role FROM user_roles WHERE user_id = auth.uid() AND role = 'admin' AND status = 'active' LIMIT 1) = 'admin')
  WITH CHECK ((SELECT role FROM user_roles WHERE user_id = auth.uid() AND role = 'admin' AND status = 'active' LIMIT 1) = 'admin');
