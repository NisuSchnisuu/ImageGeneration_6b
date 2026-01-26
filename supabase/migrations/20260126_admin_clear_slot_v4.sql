-- RPC Function V4 (Datatype Fix)
-- FIXES: 42804 Datatype Mismatch (JSONB vs TEXT[])
-- The 'history_urls' column is JSONB, not TEXT ARRAYS.

CREATE OR REPLACE FUNCTION admin_clear_slot(slot_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_uid UUID;
  is_admin BOOLEAN;
BEGIN
  -- 1. Get User ID
  current_uid := auth.uid();
  
  -- 2. Check Admin Status (Simplified & Robust)
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = current_uid 
    AND role = 'admin'
  ) INTO is_admin;
  
  -- Fallback for specific Admin if needed
  IF current_uid = '43250705-a215-4c47-8620-d0f45bbb84f8'::uuid THEN
     is_admin := TRUE;
  END IF;

  IF NOT is_admin THEN
    RAISE EXCEPTION 'Access Denied V4. User: %', current_uid;
  END IF;

  -- 3. Execute Update (Fixing Type Mismatch)
  UPDATE public.image_slots
  SET 
    last_image_base64 = NULL,
    history_urls = '[]'::jsonb, -- FIX: Assign JSONB empty array, NOT text array
    is_locked = TRUE,
    updated_at = NOW()
  WHERE id = slot_id;
  
END;
$$;

GRANT EXECUTE ON FUNCTION admin_clear_slot TO authenticated;
GRANT EXECUTE ON FUNCTION admin_clear_slot TO service_role;
