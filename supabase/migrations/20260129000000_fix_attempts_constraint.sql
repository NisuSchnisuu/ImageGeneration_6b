ALTER TABLE "public"."image_slots" DROP CONSTRAINT IF EXISTS "image_slots_attempts_used_check";

ALTER TABLE "public"."image_slots" 
ADD CONSTRAINT "image_slots_attempts_used_check" 
CHECK (
  attempts_used >= 0 AND 
  (
    (slot_number = 1 AND attempts_used <= 5) OR 
    (slot_number <> 1 AND attempts_used <= 3)
  )
);
