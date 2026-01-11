/*
  # Seed Demo Data

  Populate the database with sample categories and products for testing.
  
  1. Categories - Common product categories
  2. Products - Sample products with vendor information
  3. Demo data for marketplace functionality
*/

-- Insert sample categories
INSERT INTO categories (name, description) VALUES
  ('Electronics', 'Electronic devices and gadgets'),
  ('Fashion', 'Clothing, shoes, and accessories'),
  ('Home & Garden', 'Home decor and garden supplies'),
  ('Sports & Outdoors', 'Sports equipment and outdoor gear'),
  ('Books & Media', 'Books, movies, and digital content')
ON CONFLICT (name) DO NOTHING;

-- Insert sample products (will be associated with vendors through the application)
-- These can be created by vendors through the UI
