/*
  # Fix Infinite Recursion in user_roles Table

  1. Changes
    - Drop the problematic "Admins can read all user roles" policy
    - Drop the problematic "Admins can insert user roles" policy
    - These policies cause infinite recursion by checking user_roles while querying user_roles
    
  2. Security
    - Users can still read their own roles via existing policy
    - Admin operations will need to use service role or different approach
*/

-- Drop the problematic policies that cause infinite recursion
DROP POLICY IF EXISTS "Admins can read all user roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can insert user roles" ON user_roles;
