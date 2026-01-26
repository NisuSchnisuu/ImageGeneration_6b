-- Fix slot_number check constraint to allow 16 (Total 17 slots: 0..16)
ALTER TABLE public.image_slots DROP CONSTRAINT IF EXISTS image_slots_slot_number_check;
ALTER TABLE public.image_slots ADD CONSTRAINT image_slots_slot_number_check CHECK (slot_number >= 0 AND slot_number <= 16);
