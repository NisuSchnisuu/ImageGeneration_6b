import { supabase } from './supabase';

export interface ImageSlot {
    id: string;
    slot_number: number;
    attempts_used: number;
    last_image_base64: string | null;
    last_prompt: string | null;
    is_locked: boolean;
}

// Initialisiert alle 15 Slots für einen neuen User (falls noch nicht vorhanden)
export async function initializeSlots(userId: string) {
    // Prüfen ob Slots existieren
    const { count } = await supabase
        .from('image_slots')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

    if (count && count === 15) return; // Alles schon da

    // 15 Slots erstellen
    const slots = Array.from({ length: 15 }, (_, i) => ({
        user_id: userId,
        slot_number: i + 1,
        attempts_used: 0,
        is_locked: false
    }));

    const { error } = await supabase.from('image_slots').upsert(slots, { onConflict: 'user_id, slot_number' });
    if (error) console.error("Error initializing slots:", error);
}

// Lädt alle Slots eines Users
export async function getSlots(userId: string) {
    const { data, error } = await supabase
        .from('image_slots')
        .select('*')
        .eq('user_id', userId)
        .order('slot_number', { ascending: true });
    
    if (error) throw error;
    return data as ImageSlot[];
}

// Aktualisiert einen Slot nach Generierung
export async function updateSlot(slotId: string, imageBase64: string, prompt: string, newAttemptsCount: number) {
    const isLocked = newAttemptsCount >= 3;
    
    const { error } = await supabase
        .from('image_slots')
        .update({
            last_image_base64: imageBase64,
            last_prompt: prompt,
            attempts_used: newAttemptsCount,
            is_locked: isLocked,
            updated_at: new Date().toISOString()
        })
        .eq('id', slotId);

    if (error) throw error;
}
