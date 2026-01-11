/*
  # Seed Categories and Sample Products

  1. Data Seeding
    - Add categories for the marketplace
    - Add sample products across different categories
    - Add vendor role to admin user for demo purposes
    
  2. Notes
    - Uses admin user as vendor for demo products
    - Products include image URLs from Pexels
    - All products are active and have stock
*/

-- Add vendor role to admin user (if not exists)
DO $$
DECLARE
  admin_user_id uuid;
BEGIN
  SELECT id INTO admin_user_id FROM users WHERE email = 'harjjeet.kohli@gmail.com';
  
  IF admin_user_id IS NOT NULL THEN
    INSERT INTO user_roles (user_id, role, status)
    VALUES (admin_user_id, 'vendor', 'active')
    ON CONFLICT (user_id, role) DO NOTHING;
    
    INSERT INTO user_roles (user_id, role, status)
    VALUES (admin_user_id, 'affiliate', 'active')
    ON CONFLICT (user_id, role) DO NOTHING;
    
    INSERT INTO user_roles (user_id, role, status)
    VALUES (admin_user_id, 'consumer', 'active')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END $$;

-- Insert categories
INSERT INTO categories (name, description) VALUES
  ('Electronics', 'Phones, computers, and electronic devices'),
  ('Fashion', 'Clothing, shoes, and accessories'),
  ('Home & Garden', 'Furniture, decor, and garden supplies'),
  ('Sports & Outdoors', 'Sports equipment and outdoor gear'),
  ('Books & Media', 'Books, movies, music, and games'),
  ('Health & Beauty', 'Skincare, makeup, and wellness products')
ON CONFLICT (name) DO NOTHING;

-- Insert sample products
DO $$
DECLARE
  admin_user_id uuid;
  electronics_cat_id uuid;
  fashion_cat_id uuid;
  home_cat_id uuid;
  sports_cat_id uuid;
  books_cat_id uuid;
  health_cat_id uuid;
BEGIN
  SELECT id INTO admin_user_id FROM users WHERE email = 'harjjeet.kohli@gmail.com';
  SELECT id INTO electronics_cat_id FROM categories WHERE name = 'Electronics';
  SELECT id INTO fashion_cat_id FROM categories WHERE name = 'Fashion';
  SELECT id INTO home_cat_id FROM categories WHERE name = 'Home & Garden';
  SELECT id INTO sports_cat_id FROM categories WHERE name = 'Sports & Outdoors';
  SELECT id INTO books_cat_id FROM categories WHERE name = 'Books & Media';
  SELECT id INTO health_cat_id FROM categories WHERE name = 'Health & Beauty';
  
  IF admin_user_id IS NOT NULL THEN
    INSERT INTO products (vendor_id, category_id, name, description, price, image_url, stock_quantity, is_active) VALUES
      (admin_user_id, electronics_cat_id, 'Wireless Bluetooth Headphones', 'Premium noise-canceling headphones with 30-hour battery life', 149.99, 'https://images.pexels.com/photos/3394650/pexels-photo-3394650.jpeg?auto=compress&cs=tinysrgb&w=800', 50, true),
      (admin_user_id, electronics_cat_id, 'Smart Watch Pro', 'Fitness tracking, heart rate monitor, and notifications', 299.99, 'https://images.pexels.com/photos/437037/pexels-photo-437037.jpeg?auto=compress&cs=tinysrgb&w=800', 30, true),
      (admin_user_id, electronics_cat_id, 'Wireless Keyboard & Mouse Combo', 'Ergonomic design with long battery life', 79.99, 'https://images.pexels.com/photos/2115256/pexels-photo-2115256.jpeg?auto=compress&cs=tinysrgb&w=800', 75, true),
      (admin_user_id, fashion_cat_id, 'Classic Leather Jacket', 'Genuine leather jacket with modern fit', 249.99, 'https://images.pexels.com/photos/1124468/pexels-photo-1124468.jpeg?auto=compress&cs=tinysrgb&w=800', 25, true),
      (admin_user_id, fashion_cat_id, 'Running Shoes', 'Lightweight and breathable athletic shoes', 89.99, 'https://images.pexels.com/photos/2529148/pexels-photo-2529148.jpeg?auto=compress&cs=tinysrgb&w=800', 100, true),
      (admin_user_id, fashion_cat_id, 'Designer Sunglasses', 'UV protection with polarized lenses', 129.99, 'https://images.pexels.com/photos/701877/pexels-photo-701877.jpeg?auto=compress&cs=tinysrgb&w=800', 40, true),
      (admin_user_id, home_cat_id, 'Modern Table Lamp', 'LED desk lamp with adjustable brightness', 49.99, 'https://images.pexels.com/photos/1112598/pexels-photo-1112598.jpeg?auto=compress&cs=tinysrgb&w=800', 60, true),
      (admin_user_id, home_cat_id, 'Decorative Wall Art Set', 'Set of 3 canvas prints for living room', 119.99, 'https://images.pexels.com/photos/1579708/pexels-photo-1579708.jpeg?auto=compress&cs=tinysrgb&w=800', 35, true),
      (admin_user_id, home_cat_id, 'Ceramic Plant Pot Set', 'Set of 4 modern ceramic planters', 39.99, 'https://images.pexels.com/photos/6208086/pexels-photo-6208086.jpeg?auto=compress&cs=tinysrgb&w=800', 80, true),
      (admin_user_id, sports_cat_id, 'Yoga Mat Premium', 'Non-slip exercise mat with carrying strap', 34.99, 'https://images.pexels.com/photos/4325476/pexels-photo-4325476.jpeg?auto=compress&cs=tinysrgb&w=800', 90, true),
      (admin_user_id, sports_cat_id, 'Adjustable Dumbbells Set', 'Space-saving home gym equipment', 199.99, 'https://images.pexels.com/photos/4162449/pexels-photo-4162449.jpeg?auto=compress&cs=tinysrgb&w=800', 45, true),
      (admin_user_id, sports_cat_id, 'Camping Backpack 50L', 'Waterproof hiking backpack with rain cover', 89.99, 'https://images.pexels.com/photos/2387873/pexels-photo-2387873.jpeg?auto=compress&cs=tinysrgb&w=800', 55, true),
      (admin_user_id, books_cat_id, 'Best Seller Book Bundle', 'Collection of 5 popular fiction books', 59.99, 'https://images.pexels.com/photos/1907785/pexels-photo-1907785.jpeg?auto=compress&cs=tinysrgb&w=800', 70, true),
      (admin_user_id, books_cat_id, 'Premium Vinyl Record', 'Classic album on high-quality vinyl', 29.99, 'https://images.pexels.com/photos/1389429/pexels-photo-1389429.jpeg?auto=compress&cs=tinysrgb&w=800', 40, true),
      (admin_user_id, health_cat_id, 'Skincare Gift Set', 'Complete skincare routine in luxury packaging', 79.99, 'https://images.pexels.com/photos/3685538/pexels-photo-3685538.jpeg?auto=compress&cs=tinysrgb&w=800', 50, true),
      (admin_user_id, health_cat_id, 'Essential Oil Diffuser', 'Ultrasonic aromatherapy diffuser with LED lights', 44.99, 'https://images.pexels.com/photos/4202919/pexels-photo-4202919.jpeg?auto=compress&cs=tinysrgb&w=800', 65, true)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
