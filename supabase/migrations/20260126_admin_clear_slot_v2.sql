-- RPC Function V2 (Robust & Safe)
-- Fixes potential "search_path" and "RLS" issues.

CREATE OR REPLACE FUNCTION admin_clear_slot(slot_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions -- SAFETY: Force search path
AS $$
DECLARE
  current_uid UUID;
  user_role TEXT;
BEGIN
  current_uid := auth.uid();
  
  -- 1. Direct Lookup with no RLS interference (Function Owner Privileges)
  SELECT role INTO user_role 
  FROM public.profiles 
  WHERE id = current_uid;
  
  -- 2. Validate
  -- Uses TRIM to be safe against 'admin ' vs 'admin'
  IF user_role IS NULL OR TRIM(user_role) != 'admin' THEN
    RAISE EXCEPTION 'Access Denied. UID: %, Found Role: % (Must be admin)', current_uid, user_role;
  END IF;

  -- 3. Execute Update
  UPDATE public.image_slots
  SET 
    last_image_base64 = NULL,
    history_urls = ARRAY[]::text[],
    is_locked = TRUE, -- Ensure it stays locked validly? Or Reset? Logic says 'Archive' implies Locked.
    updated_at = NOW()
  WHERE id = slot_id;
  
END;
$$;

-- Grant Execution explicitly
GRANT EXECUTE ON FUNCTION admin_clear_slot TO authenticated;
GRANT EXECUTE ON FUNCTION admin_clear_slot TO service_role;
