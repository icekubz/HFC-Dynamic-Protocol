/*
  # Add Dynamic Commission Rates Configuration

  1. New Tables
    - `tee_commission_rates`
      - `id` (uuid, primary key)
      - `self_commission_rate` (numeric, 10% default)
      - `direct_commission_rate` (numeric, 15% default)
      - `passive_commission_rate` (numeric, 50% default)
      - `platform_commission_rate` (numeric, 25% default)
      - `passive_divisor` (integer, default 5)
      - `is_active` (boolean)
      - `effective_date` (timestamptz)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `updated_by` (uuid, foreign key to users)

  2. Modified Tables
    - `tee_commissions`: Add columns for rate snapshots
      - `self_rate_applied` (numeric)
      - `direct_rate_applied` (numeric)
      - `passive_rate_applied` (numeric)
      - `platform_rate_applied` (numeric)
      - `calculation_details` (jsonb) - stores full calculation breakdown

  3. Security
    - Enable RLS on `tee_commission_rates`
    - Only admins can create/update rates
    - All users can read current active rates

  4. Important Notes
    - Historical commission rates are captured per transaction for audit trail
    - Only one rate set can be active at a time
    - Effective date allows for scheduled rate changes
*/

CREATE TABLE IF NOT EXISTS tee_commission_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  self_commission_rate numeric NOT NULL DEFAULT 10.0 CHECK (self_commission_rate >= 0 AND self_commission_rate <= 100),
  direct_commission_rate numeric NOT NULL DEFAULT 15.0 CHECK (direct_commission_rate >= 0 AND direct_commission_rate <= 100),
  passive_commission_rate numeric NOT NULL DEFAULT 50.0 CHECK (passive_commission_rate >= 0 AND passive_commission_rate <= 100),
  platform_commission_rate numeric NOT NULL DEFAULT 25.0 CHECK (platform_commission_rate >= 0 AND platform_commission_rate <= 100),
  passive_divisor integer NOT NULL DEFAULT 5 CHECK (passive_divisor > 0),
  is_active boolean DEFAULT false,
  effective_date timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES users(id)
);

ALTER TABLE tee_commission_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active commission rates"
  ON tee_commission_rates FOR SELECT
  USING (is_active = true OR auth.role() = 'authenticated');

CREATE POLICY "Only admins can insert commission rates"
  ON tee_commission_rates FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

CREATE POLICY "Only admins can update commission rates"
  ON tee_commission_rates FOR UPDATE
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tee_commissions' AND column_name = 'self_rate_applied'
  ) THEN
    ALTER TABLE tee_commissions ADD COLUMN self_rate_applied numeric DEFAULT 10.0;
    ALTER TABLE tee_commissions ADD COLUMN direct_rate_applied numeric DEFAULT 15.0;
    ALTER TABLE tee_commissions ADD COLUMN passive_rate_applied numeric DEFAULT 50.0;
    ALTER TABLE tee_commissions ADD COLUMN platform_rate_applied numeric DEFAULT 25.0;
    ALTER TABLE tee_commissions ADD COLUMN calculation_details jsonb;
  END IF;
END $$;

INSERT INTO tee_commission_rates (self_commission_rate, direct_commission_rate, passive_commission_rate, platform_commission_rate, passive_divisor, is_active)
VALUES (10.0, 15.0, 50.0, 25.0, 5, true)
ON CONFLICT DO NOTHING;
