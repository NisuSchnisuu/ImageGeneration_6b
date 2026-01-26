-- RPC Function to forcefuly clear a slot (Admin only)
-- Uses SECURITY DEFINER to bypass RLS restrictions on the UPDATE
CREATE OR REPLACE FUNCTION admin_clear_slot(slot_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if caller is admin (Double check for safety)
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access Denied: You are not an admin.';
  END IF;

  UPDATE public.image_slots
  SET 
    last_image_base64 = NULL,
    history_urls = ARRAY[]::text[],
    updated_at = NOW()
  WHERE id = slot_id;
END;
$$;
