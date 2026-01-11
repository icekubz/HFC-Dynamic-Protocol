/*
  # Add stripe_payment_intent_id to orders table

  1. Changes
    - Add stripe_payment_intent_id column to orders table for Stripe integration
    - Add index for faster lookups
*/

DO $$
BEGIN
  -- Add stripe_payment_intent_id if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'stripe_payment_intent_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN stripe_payment_intent_id text;
  END IF;
END $$;

-- Add index for stripe payment intent lookups
CREATE INDEX IF NOT EXISTS idx_orders_stripe_payment_intent 
  ON orders(stripe_payment_intent_id);
