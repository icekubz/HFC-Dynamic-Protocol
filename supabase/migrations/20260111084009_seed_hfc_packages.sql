/*
  # Seed HFC Protocol Packages

  1. Starter Package - $100
    - 3 depth cap
    - 1 minimum depth for passive calculation
  
  2. Professional Package - $300
    - 5 depth cap
    - 2 minimum depth

  3. Business Package - $500
    - 7 depth cap
    - 3 minimum depth

  4. Enterprise Package - $1000
    - 10 depth cap
    - 4 minimum depth
*/

INSERT INTO packages (name, price, cv_value, cap_limit, min_depth)
VALUES 
  ('Starter', 100.00, 100.00, 3, 1),
  ('Professional', 300.00, 300.00, 5, 2),
  ('Business', 500.00, 500.00, 7, 3),
  ('Enterprise', 1000.00, 1000.00, 10, 4)
ON CONFLICT DO NOTHING;
