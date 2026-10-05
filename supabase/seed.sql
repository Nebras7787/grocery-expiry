-- =============================================
-- Seed data for Grocery Expiry Manager
-- Run AFTER schema.sql
-- =============================================

-- Common grocery products (adjust user_id to match your auth user, or leave NULL for demo)
-- To find your user_id: SELECT id FROM auth.users WHERE email = 'you@example.com';

-- Uncomment and set user_id for your account:
-- DO $$
-- DECLARE my_user_id uuid := 'YOUR_USER_ID_HERE';
-- BEGIN

INSERT INTO public.products (name, category) VALUES
  -- Dairy
  ('Whole Milk 1L', 'Dairy'),
  ('Greek Yogurt 500g', 'Dairy'),
  ('Cheddar Cheese 200g', 'Dairy'),
  ('Butter 250g', 'Dairy'),
  ('Cream Cheese 200g', 'Dairy'),
  ('Mozzarella 150g', 'Dairy'),
  ('Eggs (12 pack)', 'Dairy'),

  -- Bakery
  ('White Bread Loaf', 'Bakery'),
  ('Whole Wheat Bread', 'Bakery'),
  ('Baguette', 'Bakery'),
  ('Croissants (4 pack)', 'Bakery'),
  ('Pita Bread', 'Bakery'),
  ('Tortilla Wraps', 'Bakery'),

  -- Canned Goods
  ('Canned Tuna 185g', 'Canned Goods'),
  ('Canned Corn 340g', 'Canned Goods'),
  ('Canned Beans 400g', 'Canned Goods'),
  ('Canned Tomatoes 400g', 'Canned Goods'),
  ('Canned Soup 400g', 'Canned Goods'),
  ('Canned Coconut Milk', 'Canned Goods'),

  -- Beverages
  ('Orange Juice 1L', 'Beverages'),
  ('Apple Juice 1L', 'Beverages'),
  ('Cola 330ml', 'Beverages'),
  ('Sparkling Water 1.5L', 'Beverages'),
  ('Almond Milk 1L', 'Beverages'),
  ('Coffee Beans 250g', 'Beverages'),

  -- Frozen
  ('Frozen Pizza', 'Frozen'),
  ('Frozen Vegetables Mix', 'Frozen'),
  ('Ice Cream 500ml', 'Frozen'),
  ('Frozen Chicken Nuggets', 'Frozen'),
  ('Frozen French Fries', 'Frozen'),
  ('Frozen Berries Mix', 'Frozen'),

  -- Produce
  ('Bananas (1 bunch)', 'Produce'),
  ('Apples (6 pack)', 'Produce'),
  ('Tomatoes (4 pack)', 'Produce'),
  ('Lettuce Head', 'Produce'),
  ('Onions 1kg', 'Produce'),
  ('Potatoes 2kg', 'Produce'),
  ('Carrots 1kg', 'Produce'),
  ('Bell Peppers (3 pack)', 'Produce'),

  -- Meat
  ('Chicken Breast 500g', 'Meat'),
  ('Ground Beef 500g', 'Meat'),
  ('Pork Chops 400g', 'Meat'),
  ('Salmon Fillet 300g', 'Meat'),
  ('Turkey Deli Slices', 'Meat'),
  ('Bacon 200g', 'Meat'),

  -- Snacks
  ('Potato Chips 150g', 'Snacks'),
  ('Chocolate Bar 100g', 'Snacks'),
  ('Granola Bars (6 pack)', 'Snacks'),
  ('Crackers 200g', 'Snacks'),
  ('Trail Mix 200g', 'Snacks'),
  ('Popcorn 100g', 'Snacks'),

  -- General
  ('Olive Oil 500ml', 'General'),
  ('Pasta 500g', 'General'),
  ('Rice 1kg', 'General'),
  ('Bread Crumbs 200g', 'General'),
  ('Honey 350g', 'General'),
  ('Maple Syrup 250ml', 'General')

ON CONFLICT (name) DO NOTHING;

-- END $$;

-- Insert sample batches with various expiry dates
-- Uncomment and set your user_id:
-- DO $$
-- DECLARE my_user_id uuid := 'YOUR_USER_ID_HERE';
-- DECLARE milk_id uuid;
-- DECLARE bread_id uuid;
-- DECLARE tuna_id uuid;
-- DECLARE yogurt_id uuid;
-- DECLARE eggs_id uuid;
-- BEGIN
--   SELECT id INTO milk_id FROM public.products WHERE name = 'Whole Milk 1L' LIMIT 1;
--   SELECT id INTO bread_id FROM public.products WHERE name = 'White Bread Loaf' LIMIT 1;
--   SELECT id INTO tuna_id FROM public.products WHERE name = 'Canned Tuna 185g' LIMIT 1;
--   SELECT id INTO yogurt_id FROM public.products WHERE name = 'Greek Yogurt 500g' LIMIT 1;
--   SELECT id INTO eggs_id FROM public.products WHERE name = 'Eggs (12 pack)' LIMIT 1;
--
--   INSERT INTO public.product_batches (product_id, quantity, expiry_date, user_id) VALUES
--     (milk_id, 2, current_date + 5, my_user_id),   -- expiring this week
--     (milk_id, 1, current_date - 2, my_user_id),   -- expired
--     (bread_id, 3, current_date + 10, my_user_id),  -- near expiry
--     (bread_id, 1, current_date + 90, my_user_id),  -- valid
--     (tuna_id, 5, current_date + 540, my_user_id),  -- valid (18 months)
--     (yogurt_id, 4, current_date + 14, my_user_id), -- near expiry (2 weeks)
--     (eggs_id, 2, current_date + 21, my_user_id),   -- near expiry (3 weeks)
--     (eggs_id, 1, current_date + 365, my_user_id);  -- valid (1 year)
-- END $$;
