import { supabase } from './supabase';

export interface ImageSlot {
    id: string;
    user_id: string;
    slot_number: number;
    attempts_used: number;
    last_image_base64: string | null; // URL des letzten Bildes
    history_urls: string[];
    prompt_history: string[];
    last_prompt: string | null;
    is_locked: boolean;
}

export async function initializeSlots(userId: string) {
    const { count } = await supabase
        .from('image_slots')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

    if (count && count === 15) return;

    const slots = Array.from({ length: 15 }, (_, i) => ({
        user_id: userId,
        slot_number: i + 1,
        attempts_used: 0,
        is_locked: false,
        history_urls: [],
        prompt_history: []
    }));

    await supabase.from('image_slots').upsert(slots, { onConflict: 'user_id, slot_number' });
}

export async function getSlots(userId: string) {
    const { data, error } = await supabase
        .from('image_slots')
        .select('*')
        .eq('user_id', userId)
        .order('slot_number', { ascending: true });

    if (error) throw error;
    return data as ImageSlot[];
}

export async function uploadImage(userId: string, slotNumber: number, blob: Blob): Promise<string> {
    const fileName = `${userId}/slot-${slotNumber}/${Date.now()}.webp`;

    const { data, error } = await supabase.storage
        .from('images')
        .upload(fileName, blob, {
            contentType: 'image/webp',
            cacheControl: '3600'
        });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
        .from('images')
        .getPublicUrl(fileName);

    return publicUrl;
}

/**
 * Löscht physisch alle Bilder eines Slots aus dem Storage
 */
async function deleteFilesInStorage(userId: string, slotNumber: number) {
    const { data: files } = await supabase.storage
        .from('images')
        .list(`${userId}/slot-${slotNumber}`);

    if (files && files.length > 0) {
        const filesToDelete = files.map(f => `${userId}/slot-${slotNumber}/${f.name}`);
        await supabase.storage.from('images').remove(filesToDelete);
    }
}

/**
 * Update nach Generierung: Speichert Bild-URL und Prompt in History
 */
export async function updateSlotWithUrl(
    slotId: string,
    imageUrl: string,
    prompt: string,
    newAttemptsCount: number,
    updatedImageHistory: string[],
    updatedPromptHistory: string[]
) {
    const isLocked = newAttemptsCount >= 3;
    // We expect the fully updated arrays to be passed

    const { error } = await supabase
        .from('image_slots')
        .update({
            last_image_base64: imageUrl,
            last_prompt: prompt,
            attempts_used: newAttemptsCount,
            is_locked: isLocked,
            history_urls: updatedImageHistory,
            prompt_history: updatedPromptHistory,
            updated_at: new Date().toISOString()
        })
        .eq('id', slotId);

    if (error) throw error;
}

/**
 * Szenario A: Slot ist voll und User verlässt ihn.
 * Wir löschen die Bilder (Storage + DB), aber behalten den Locked-Status und Prompts.
 */
export async function clearSlotImagesOnly(slot: ImageSlot) {
    // 1. Storage leeren
    await deleteFilesInStorage(slot.user_id, slot.slot_number);

    // 2. DB: Nur Bild-Infos löschen, Status bleibt locked
    const { error } = await supabase
        .from('image_slots')
        .update({
            last_image_base64: null,
            history_urls: [],
            // prompt_history bleibt erhalten!
            // is_locked bleibt erhalten!
            // attempts_used bleibt erhalten!
        })
        .eq('id', slot.id);

    if (error) throw error;
}

/**
 * Admin Feature: Setzt einen Slot komplett auf Anfang zurück (Unlock).
 */
export async function adminUnlockSlot(slot: ImageSlot) {
    // 1. Storage sicherheitshalber leeren
    await deleteFilesInStorage(slot.user_id, slot.slot_number);

    // 2. DB: Alles auf 0
    const { error } = await supabase
        .from('image_slots')
        .update({
            last_image_base64: null,
            last_prompt: null,
            attempts_used: 0,
            is_locked: false,
            history_urls: [],
            prompt_history: [], // Auch Prompts weg für frischen Start? Ja.
            updated_at: new Date().toISOString()
        })
        .eq('id', slot.id);

    if (error) throw error;
}
