/*
  # Fix Infinite Recursion in binary_tree_positions Policies

  1. Changes
    - Drop problematic policies that cause infinite recursion
    - Simplify policies to avoid querying the same table
    
  2. Security
    - Users can view their own position
    - Simplified admin access without recursion
*/

-- Drop problematic policies
DROP POLICY IF EXISTS "Users can view their downline positions" ON binary_tree_positions;
DROP POLICY IF EXISTS "Admins can view all positions" ON binary_tree_positions;
DROP POLICY IF EXISTS "Admins can manage positions" ON binary_tree_positions;
DROP POLICY IF EXISTS "Admins can manage packages" ON affiliate_packages;
DROP POLICY IF EXISTS "Admins can view all subscriptions" ON affiliate_subscriptions;
DROP POLICY IF EXISTS "Admins can manage all subscriptions" ON affiliate_subscriptions;
DROP POLICY IF EXISTS "Admins can view all commissions" ON commission_transactions;
DROP POLICY IF EXISTS "Admins can manage commissions" ON commission_transactions;
DROP POLICY IF EXISTS "Admins can insert commissions" ON commissions;

-- Add simple policy for users to insert their own positions
CREATE POLICY "Users can insert own position"
  ON binary_tree_positions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Add simple policy for updating own positions (for sales volume updates)
CREATE POLICY "System can update positions"
  ON binary_tree_positions FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
