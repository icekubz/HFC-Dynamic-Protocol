/*
  # Seed Test Data for TEE Platform

  ## Overview
  Creates test data for the Thy Essential Engine platform to enable immediate testing

  ## 1. Test Merchant
    - Creates a demo merchant company

  ## 2. Test Affiliates
    - Creates 10 test affiliates in a binary tree structure
    - Affiliate 1 is root
    - Others are placed using BFS logic

  ## 3. Test Orders
    - Creates sample orders to test commission calculations

  ## 4. Important Notes
    - This is test data only
    - All data can be safely deleted in production
    - Passwords for test users should be changed immediately
*/

-- Insert test merchant
INSERT INTO tee_merchants (id, company_name, status)
VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Demo Merchant Store',
  'active'
) ON CONFLICT (id) DO NOTHING;

-- Insert test affiliates
INSERT INTO tee_affiliates (id, merchant_id, email, full_name, referral_code, sponsor_id, status)
VALUES
  ('10000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'affiliate1@test.com', 'John Doe', 'REF001', NULL, 'active'),
  ('10000000-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'affiliate2@test.com', 'Jane Smith', 'REF002', '10000000-0000-0000-0000-000000000001'::uuid, 'active'),
  ('10000000-0000-0000-0000-000000000003'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'affiliate3@test.com', 'Bob Johnson', 'REF003', '10000000-0000-0000-0000-000000000001'::uuid, 'active'),
  ('10000000-0000-0000-0000-000000000004'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'affiliate4@test.com', 'Alice Williams', 'REF004', '10000000-0000-0000-0000-000000000002'::uuid, 'active'),
  ('10000000-0000-0000-0000-000000000005'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'affiliate5@test.com', 'Charlie Brown', 'REF005', '10000000-0000-0000-0000-000000000002'::uuid, 'active'),
  ('10000000-0000-0000-0000-000000000006'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'affiliate6@test.com', 'Diana Prince', 'REF006', '10000000-0000-0000-0000-000000000003'::uuid, 'active'),
  ('10000000-0000-0000-0000-000000000007'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'affiliate7@test.com', 'Ethan Hunt', 'REF007', '10000000-0000-0000-0000-000000000003'::uuid, 'active'),
  ('10000000-0000-0000-0000-000000000008'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'affiliate8@test.com', 'Fiona Green', 'REF008', '10000000-0000-0000-0000-000000000004'::uuid, 'active'),
  ('10000000-0000-0000-0000-000000000009'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'affiliate9@test.com', 'George Lucas', 'REF009', '10000000-0000-0000-0000-000000000004'::uuid, 'active'),
  ('10000000-0000-0000-0000-000000000010'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'affiliate10@test.com', 'Hannah Montana', 'REF010', '10000000-0000-0000-0000-000000000005'::uuid, 'active')
ON CONFLICT (id) DO NOTHING;

-- Insert binary tree structure (BFS placement)
INSERT INTO tee_binary_tree (affiliate_id, parent_id, sponsor_id, position, level, node_cap)
VALUES
  ('10000000-0000-0000-0000-000000000001'::uuid, NULL, NULL, 'root', 0, 1023),
  ('10000000-0000-0000-0000-000000000002'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, 'left', 1, 1023),
  ('10000000-0000-0000-0000-000000000003'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, 'right', 1, 1023),
  ('10000000-0000-0000-0000-000000000004'::uuid, '10000000-0000-0000-0000-000000000002'::uuid, '10000000-0000-0000-0000-000000000002'::uuid, 'left', 2, 1023),
  ('10000000-0000-0000-0000-000000000005'::uuid, '10000000-0000-0000-0000-000000000002'::uuid, '10000000-0000-0000-0000-000000000002'::uuid, 'right', 2, 1023),
  ('10000000-0000-0000-0000-000000000006'::uuid, '10000000-0000-0000-0000-000000000003'::uuid, '10000000-0000-0000-0000-000000000003'::uuid, 'left', 2, 1023),
  ('10000000-0000-0000-0000-000000000007'::uuid, '10000000-0000-0000-0000-000000000003'::uuid, '10000000-0000-0000-0000-000000000003'::uuid, 'right', 2, 1023),
  ('10000000-0000-0000-0000-000000000008'::uuid, '10000000-0000-0000-0000-000000000004'::uuid, '10000000-0000-0000-0000-000000000004'::uuid, 'left', 3, 1023),
  ('10000000-0000-0000-0000-000000000009'::uuid, '10000000-0000-0000-0000-000000000004'::uuid, '10000000-0000-0000-0000-000000000004'::uuid, 'right', 3, 1023),
  ('10000000-0000-0000-0000-000000000010'::uuid, '10000000-0000-0000-0000-000000000005'::uuid, '10000000-0000-0000-0000-000000000005'::uuid, 'left', 3, 1023)
ON CONFLICT (affiliate_id) DO NOTHING;

-- Update parent child references
UPDATE tee_binary_tree SET left_child_id = '10000000-0000-0000-0000-000000000002'::uuid, right_child_id = '10000000-0000-0000-0000-000000000003'::uuid WHERE affiliate_id = '10000000-0000-0000-0000-000000000001'::uuid;
UPDATE tee_binary_tree SET left_child_id = '10000000-0000-0000-0000-000000000004'::uuid, right_child_id = '10000000-0000-0000-0000-000000000005'::uuid WHERE affiliate_id = '10000000-0000-0000-0000-000000000002'::uuid;
UPDATE tee_binary_tree SET left_child_id = '10000000-0000-0000-0000-000000000006'::uuid, right_child_id = '10000000-0000-0000-0000-000000000007'::uuid WHERE affiliate_id = '10000000-0000-0000-0000-000000000003'::uuid;
UPDATE tee_binary_tree SET left_child_id = '10000000-0000-0000-0000-000000000008'::uuid, right_child_id = '10000000-0000-0000-0000-000000000009'::uuid WHERE affiliate_id = '10000000-0000-0000-0000-000000000004'::uuid;
UPDATE tee_binary_tree SET left_child_id = '10000000-0000-0000-0000-000000000010'::uuid WHERE affiliate_id = '10000000-0000-0000-0000-000000000005'::uuid;

-- Create wallets for all affiliates
INSERT INTO tee_wallets (affiliate_id, balance_self, balance_direct, balance_passive, total_earned, total_withdrawn, hfc_token_balance)
SELECT id, 0, 0, 0, 0, 0, 0 FROM tee_affiliates
ON CONFLICT (affiliate_id) DO NOTHING;

-- Insert test orders (unprocessed)
INSERT INTO tee_orders (merchant_id, affiliate_id, external_order_id, order_total, commission_percent, cv, processed)
VALUES
  ('00000000-0000-0000-0000-000000000001'::uuid, '10000000-0000-0000-0000-000000000002'::uuid, 'ORD001', 500.00, 20, 100.00, false),
  ('00000000-0000-0000-0000-000000000001'::uuid, '10000000-0000-0000-0000-000000000004'::uuid, 'ORD002', 750.00, 20, 150.00, false),
  ('00000000-0000-0000-0000-000000000001'::uuid, '10000000-0000-0000-0000-000000000005'::uuid, 'ORD003', 1000.00, 20, 200.00, false),
  ('00000000-0000-0000-0000-000000000001'::uuid, '10000000-0000-0000-0000-000000000008'::uuid, 'ORD004', 600.00, 20, 120.00, false),
  ('00000000-0000-0000-0000-000000000001'::uuid, '10000000-0000-0000-0000-000000000010'::uuid, 'ORD005', 450.00, 20, 90.00, false);
