/*
  # Seed Affiliate Packages

  1. Data
    - Insert default affiliate packages (Bronze, Silver, Gold, Platinum)
    - Each package has different commission rates and tree depths
    - Bronze: 3 levels, lower commissions
    - Silver: 5 levels, moderate commissions
    - Gold: 7 levels, higher commissions  
    - Platinum: Unlimited levels, highest commissions
*/

INSERT INTO affiliate_packages (name, price, max_tree_depth, direct_commission_rate, level_2_commission_rate, level_3_commission_rate, matching_bonus_rate, max_width, status)
VALUES 
  ('Bronze', 100.00, 3, 10.00, 5.00, 2.50, 5.00, 2, 'active'),
  ('Silver', 500.00, 5, 15.00, 7.50, 5.00, 7.50, 2, 'active'),
  ('Gold', 1000.00, 7, 20.00, 10.00, 7.50, 10.00, 2, 'active'),
  ('Platinum', 2500.00, 999, 25.00, 15.00, 10.00, 15.00, 2, 'active')
ON CONFLICT (name) DO UPDATE SET
  price = EXCLUDED.price,
  max_tree_depth = EXCLUDED.max_tree_depth,
  direct_commission_rate = EXCLUDED.direct_commission_rate,
  level_2_commission_rate = EXCLUDED.level_2_commission_rate,
  level_3_commission_rate = EXCLUDED.level_3_commission_rate,
  matching_bonus_rate = EXCLUDED.matching_bonus_rate,
  updated_at = now();
