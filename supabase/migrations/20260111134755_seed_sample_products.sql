/*
  # Seed Sample Products

  1. New Data
    - Add 20+ sample products across all categories
    - Include varied prices and descriptions
    - Set realistic stock quantities
    
  2. Product Details
    - Electronics: Laptops, phones, accessories
    - Fashion: Clothing, shoes, accessories
    - Home & Garden: Furniture, decor, tools
    - Sports & Outdoors: Equipment, apparel
    - Books & Media: Books, movies, games
    - Health & Beauty: Skincare, supplements, cosmetics
*/

-- Get category IDs
DO $$
DECLARE
  cat_electronics uuid;
  cat_fashion uuid;
  cat_home uuid;
  cat_sports uuid;
  cat_books uuid;
  cat_health uuid;
BEGIN
  -- Fetch category IDs
  SELECT id INTO cat_electronics FROM categories WHERE name = 'Electronics';
  SELECT id INTO cat_fashion FROM categories WHERE name = 'Fashion';
  SELECT id INTO cat_home FROM categories WHERE name = 'Home & Garden';
  SELECT id INTO cat_sports FROM categories WHERE name = 'Sports & Outdoors';
  SELECT id INTO cat_books FROM categories WHERE name = 'Books & Media';
  SELECT id INTO cat_health FROM categories WHERE name = 'Health & Beauty';

  -- Insert Electronics products
  INSERT INTO products (name, description, price, cv_value, final_price, category_id, is_active, stock_quantity, sku) VALUES
  ('Wireless Bluetooth Headphones', 'Premium noise-cancelling headphones with 30-hour battery life', 149.99, 150, 149.99, cat_electronics, true, 45, 'ELEC-HEAD-001'),
  ('Smart Watch Pro', 'Fitness tracker with heart rate monitor and GPS', 299.99, 300, 299.99, cat_electronics, true, 30, 'ELEC-WATCH-001'),
  ('Portable Power Bank 20000mAh', 'Fast charging power bank with dual USB ports', 49.99, 50, 49.99, cat_electronics, true, 100, 'ELEC-POWER-001'),
  ('4K Webcam', 'Ultra HD webcam with built-in microphone for streaming', 89.99, 90, 89.99, cat_electronics, true, 60, 'ELEC-CAM-001')
  ON CONFLICT (sku) DO NOTHING;

  -- Insert Fashion products
  INSERT INTO products (name, description, price, cv_value, final_price, category_id, is_active, stock_quantity, sku) VALUES
  ('Premium Cotton T-Shirt', 'Comfortable everyday wear in multiple colors', 29.99, 30, 29.99, cat_fashion, true, 150, 'FASH-SHIRT-001'),
  ('Classic Denim Jeans', 'Slim fit jeans with stretch fabric', 79.99, 80, 79.99, cat_fashion, true, 80, 'FASH-JEANS-001'),
  ('Leather Crossbody Bag', 'Genuine leather bag with adjustable strap', 129.99, 130, 129.99, cat_fashion, true, 40, 'FASH-BAG-001'),
  ('Running Sneakers', 'Lightweight athletic shoes with cushioned sole', 99.99, 100, 99.99, cat_fashion, true, 75, 'FASH-SHOES-001')
  ON CONFLICT (sku) DO NOTHING;

  -- Insert Home & Garden products
  INSERT INTO products (name, description, price, cv_value, final_price, category_id, is_active, stock_quantity, sku) VALUES
  ('Memory Foam Pillow Set', 'Set of 2 ergonomic pillows for better sleep', 59.99, 60, 59.99, cat_home, true, 90, 'HOME-PILLOW-001'),
  ('LED Desk Lamp', 'Adjustable brightness lamp with USB charging port', 39.99, 40, 39.99, cat_home, true, 120, 'HOME-LAMP-001'),
  ('Indoor Plant Collection', 'Set of 3 air-purifying plants with decorative pots', 69.99, 70, 69.99, cat_home, true, 50, 'HOME-PLANT-001'),
  ('Kitchen Knife Set', 'Professional 8-piece stainless steel knife set', 119.99, 120, 119.99, cat_home, true, 35, 'HOME-KNIFE-001')
  ON CONFLICT (sku) DO NOTHING;

  -- Insert Sports & Outdoors products
  INSERT INTO products (name, description, price, cv_value, final_price, category_id, is_active, stock_quantity, sku) VALUES
  ('Yoga Mat Premium', 'Extra thick non-slip yoga mat with carrying strap', 44.99, 45, 44.99, cat_sports, true, 110, 'SPORT-YOGA-001'),
  ('Resistance Bands Set', 'Set of 5 bands for strength training', 34.99, 35, 34.99, cat_sports, true, 140, 'SPORT-BANDS-001'),
  ('Camping Tent 4-Person', 'Waterproof tent with easy setup system', 189.99, 190, 189.99, cat_sports, true, 25, 'SPORT-TENT-001'),
  ('Stainless Steel Water Bottle', 'Insulated 32oz bottle keeps drinks cold for 24 hours', 29.99, 30, 29.99, cat_sports, true, 200, 'SPORT-BOTTLE-001')
  ON CONFLICT (sku) DO NOTHING;

  -- Insert Books & Media products
  INSERT INTO products (name, description, price, cv_value, final_price, category_id, is_active, stock_quantity, sku) VALUES
  ('Digital Marketing Mastery', 'Complete guide to modern digital marketing strategies', 39.99, 40, 39.99, cat_books, true, 85, 'BOOK-MARKET-001'),
  ('Productivity Planner 2026', 'Daily planner with goal-setting templates', 24.99, 25, 24.99, cat_books, true, 150, 'BOOK-PLAN-001'),
  ('Photography Basics Course', 'Online video course for beginner photographers', 79.99, 80, 79.99, cat_books, true, 999, 'BOOK-PHOTO-001'),
  ('Meditation & Mindfulness Guide', 'Practical guide to daily meditation practice', 19.99, 20, 19.99, cat_books, true, 120, 'BOOK-MEDITATE-001')
  ON CONFLICT (sku) DO NOTHING;

  -- Insert Health & Beauty products
  INSERT INTO products (name, description, price, cv_value, final_price, category_id, is_active, stock_quantity, sku) VALUES
  ('Vitamin C Serum', 'Anti-aging serum with hyaluronic acid', 34.99, 35, 34.99, cat_health, true, 95, 'HEALTH-SERUM-001'),
  ('Protein Powder Chocolate', '2lb whey protein isolate for muscle recovery', 49.99, 50, 49.99, cat_health, true, 70, 'HEALTH-PROTEIN-001'),
  ('Essential Oil Diffuser', 'Ultrasonic aromatherapy diffuser with LED lights', 39.99, 40, 39.99, cat_health, true, 110, 'HEALTH-DIFF-001'),
  ('Collagen Supplement', '30-day supply of hydrolyzed collagen peptides', 44.99, 45, 44.99, cat_health, true, 80, 'HEALTH-COLL-001')
  ON CONFLICT (sku) DO NOTHING;

END $$;
