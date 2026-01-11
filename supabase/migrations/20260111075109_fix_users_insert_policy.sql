/*
  # Fix Users Table RLS - Add INSERT Policy
  
  1. Changes
    - Add INSERT policy for users table to allow new user registration
    - Add INSERT policy for user_roles table to allow role assignment during registration
  
  2. Security
    - Users can only create their own profile (auth.uid() must match user id)
    - Users can only assign roles to themselves during registration
*/

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can insert own data" ON users;
DROP POLICY IF EXISTS "Users can insert own roles" ON user_roles;

-- Allow users to insert their own profile during registration
CREATE POLICY "Users can insert own data"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Allow users to insert their own roles during registration
CREATE POLICY "Users can insert own roles"
  ON user_roles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
