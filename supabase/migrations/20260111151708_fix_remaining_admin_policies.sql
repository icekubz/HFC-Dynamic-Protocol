/*
  # Fix Remaining Admin Policies with Recursion

  1. Changes
    - Drop "Admins can read all users" policy that queries user_roles
    - This causes infinite recursion when checking admin access
    
  2. Security
    - Users can still read and update their own data
    - Admin operations should use service role
*/

-- Drop the problematic admin policy
DROP POLICY IF EXISTS "Admins can read all users" ON users;
