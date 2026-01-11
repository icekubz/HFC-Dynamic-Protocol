/*
  # Assign Admin Role to Primary User

  1. Changes
    - Assign admin role to harjjeet.kohli@gmail.com
    - Ensure all other roles are also assigned for full access
    
  2. Notes
    - This ensures the primary user has access to all dashboards
    - Uses DO block to safely handle the operation
*/

-- Assign all roles to the primary user
DO $$
DECLARE
  primary_user_id uuid;
BEGIN
  -- Get the user ID for harjjeet.kohli@gmail.com
  SELECT id INTO primary_user_id 
  FROM auth.users 
  WHERE email = 'harjjeet.kohli@gmail.com' 
  LIMIT 1;
  
  -- If user exists, ensure they're in the users table
  IF primary_user_id IS NOT NULL THEN
    INSERT INTO users (id, email, full_name, created_at, updated_at)
    VALUES (
      primary_user_id,
      'harjjeet.kohli@gmail.com',
      'Admin User',
      now(),
      now()
    )
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email;
    
    -- Assign all roles
    INSERT INTO user_roles (user_id, role, status)
    VALUES 
      (primary_user_id, 'admin', 'active'),
      (primary_user_id, 'vendor', 'active'),
      (primary_user_id, 'affiliate', 'active'),
      (primary_user_id, 'consumer', 'active')
    ON CONFLICT (user_id, role) 
    DO UPDATE SET status = 'active';
  END IF;
END $$;
