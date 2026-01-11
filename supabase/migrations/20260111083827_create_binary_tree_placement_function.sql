/*
  # Binary Tree Placement Function

  Creates a PostgreSQL function to automatically place new affiliates
  in the binary tree structure using breadth-first search.
*/

CREATE OR REPLACE FUNCTION place_affiliate(
  new_user_id uuid,
  sponsor_id uuid
) RETURNS void AS $$
DECLARE
  parent_id uuid;
  new_position text;
BEGIN
  -- If no sponsor (admin/root), create root node
  IF sponsor_id IS NULL THEN
    INSERT INTO binary_tree (user_id, upline_id, position)
    VALUES (new_user_id, NULL, 'root')
    ON CONFLICT (user_id) DO NOTHING;
    RETURN;
  END IF;

  -- Find next available position using breadth-first search
  WITH RECURSIVE tree_search AS (
    -- Start with sponsor
    SELECT id, user_id, 0 as level
    FROM binary_tree
    WHERE user_id = sponsor_id
    
    UNION ALL
    
    -- Traverse children
    SELECT bt.id, bt.user_id, ts.level + 1
    FROM binary_tree bt
    INNER JOIN tree_search ts ON bt.upline_id = ts.user_id
    WHERE ts.level < 10
  )
  SELECT ts.user_id INTO parent_id
  FROM tree_search ts
  WHERE NOT EXISTS (
    SELECT 1 FROM binary_tree
    WHERE upline_id = ts.user_id AND position = 'left'
  )
  ORDER BY ts.level, ts.id
  LIMIT 1;

  -- If no left position found, find right position
  IF parent_id IS NOT NULL THEN
    -- Check if left is available
    IF NOT EXISTS (
      SELECT 1 FROM binary_tree
      WHERE upline_id = parent_id AND position = 'left'
    ) THEN
      new_position := 'left';
    ELSE
      new_position := 'right';
    END IF;
  ELSE
    -- Fallback to sponsor as parent
    parent_id := sponsor_id;
    new_position := 'left';
  END IF;

  -- Insert new node
  INSERT INTO binary_tree (user_id, upline_id, position)
  VALUES (new_user_id, parent_id, new_position)
  ON CONFLICT (user_id) DO NOTHING;
  
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
