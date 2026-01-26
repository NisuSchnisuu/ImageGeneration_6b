-- RPC Function DEBUG VERSION
-- Shows you WHO you are logged in as if it fails.
CREATE OR REPLACE FUNCTION admin_clear_slot(slot_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_uid UUID;
  current_role TEXT;
BEGIN
  current_uid := auth.uid();
  
  -- Try to find the role
  SELECT role INTO current_role FROM public.profiles WHERE id = current_uid;
  
  -- Check if caller is admin
  IF current_role IS NULL OR current_role != 'admin' THEN
    RAISE EXCEPTION 'Access Denied. You are logged in as: %, Role: %. Expected Role: admin', current_uid, current_role;
  END IF;

  UPDATE public.image_slots
  SET 
    last_image_base64 = NULL,
    history_urls = ARRAY[]::text[],
    updated_at = NOW()
  WHERE id = slot_id;
END;
$$;
