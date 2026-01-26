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

    // Wenn wir schon 16 Slots haben (0 bis 15), sind wir fertig
    if (count && count === 16) return;

    // Wir erstellen Slots 0 bis 15.
    // Slot 0 ist das Titelbild.
    const slots = Array.from({ length: 16 }, (_, i) => ({
        user_id: userId,
        slot_number: i, // Startet bei 0
        attempts_used: 0,
        is_locked: false,
        history_urls: [],
        prompt_history: []
    }));

    // Upsert ignoriert existierende via Slot_number Constraint (hoffentlich unique Constraint auf user_id + slot_number)
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
 * Wir archivieren die Bilder:
 * 1. Download Original
 * 2. Komprimieren auf 40%
 * 3. Upload Überschreiben (oder neu)
 * 4. Update DB mit neuen URLs
 * 5. Setze is_locked = true
 */
import { compressImage, urlToBase64 } from './imageUtils';

export async function archiveSlotImages(slot: ImageSlot) {
    const newHistoryUrls: string[] = [];
    const userId = slot.user_id;

    // Archivierungs-Logik für jedes Bild im Verlauf
    for (let i = 0; i < slot.history_urls.length; i++) {
        const originalUrl = slot.history_urls[i];
        try {
            // 1. Download & Conversion to Blob via Helper is tricky because we need Blob for upload
            // We reuse urlToBase64 to get data, then compress
            const base64 = await urlToBase64(originalUrl);

            // 2. Extreme Compression (0.05 = 5%, Max 512px) -> Ziel < 200kb
            const compressedBlob = await compressImage(base64, 0.05, 512);

            // 3. Upload (Overwrite or new name? Same name saves cleanup logic, but cache might be issue. New name is safer.)
            // Let's use a suffix "-archive"
            const fileName = `${userId}/slot-${slot.slot_number}/archive-${Date.now()}-${i}.webp`;

            const { error: uploadError } = await supabase.storage
                .from('images')
                .upload(fileName, compressedBlob, {
                    contentType: 'image/webp',
                    cacheControl: '3600',
                    upsert: true
                });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('images')
                .getPublicUrl(fileName);

            newHistoryUrls.push(publicUrl);

            // 4. Delete Old Original? 
            // Gets path from URL... tough without parsing.
            // Assumption: If we clean up the folder later via "forceDelete", it's fine. 
            // But to save space NOW, we should try to delete the old one if it was ours.
            // Regex to extract path from default supabase public URL
            // URL struct: .../storage/v1/object/public/images/USERID/SLOT/FILE.webp
            const urlObj = new URL(originalUrl);
            const pathParts = urlObj.pathname.split('/images/')[1]; // decodeURI might be needed
            if (pathParts) {
                await supabase.storage.from('images').remove([decodeURI(pathParts)]);
            }

        } catch (e) {
            console.error("Failed to archive image", i, e);
            // Fallback: keep original URL if fail
            newHistoryUrls.push(originalUrl);
        }
    }

    // 5. Update DB
    const { error } = await supabase
        .from('image_slots')
        .update({
            // Wir behalten die (neuen) Bilder!
            history_urls: newHistoryUrls,
            last_image_base64: newHistoryUrls[newHistoryUrls.length - 1] || null, // Preview update
            // is_locked bleibt/wird true
            is_locked: true,
            updated_at: new Date().toISOString()
        })
        .eq('id', slot.id);

    if (error) throw error;
}

/**
 * Admin Feature: Manuelles Löschen der Bilder (ohne Unlock)
 */
export async function forceDeleteSlotImages(slot: ImageSlot) {
    // 1. Storage leeren
    await deleteFilesInStorage(slot.user_id, slot.slot_number);

    // 2. DB: Cleanup via Secure RPC
    const { error } = await supabase.rpc('admin_clear_slot', {
        slot_id: slot.id
    });

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
