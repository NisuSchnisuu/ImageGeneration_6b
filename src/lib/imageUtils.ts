/**
 * Utility für die Bildverarbeitung im Browser
 */

export async function compressImage(base64Str: string, quality: number = 0.8, maxWidth: number = 2048): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = base64Str;
        img.crossOrigin = "Anonymous"; // Wichtig für Canvas Export bei externen Bildern
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            // Zielgröße (default 2048, or custom like 800 for archive)
            let width = img.width;
            let height = img.height;
            const maxDim = maxWidth;

            if (width > maxDim || height > maxDim) {
                if (width > height) {
                    height *= maxDim / width;
                    width = maxDim;
                } else {
                    width *= maxDim / height;
                    height = maxDim;
                }
            }

            canvas.width = width;
            canvas.height = height;

            ctx?.drawImage(img, 0, 0, width, height);

            canvas.toBlob(
                (blob) => {
                    if (blob) resolve(blob);
                    else reject(new Error('Kompression fehlgeschlagen'));
                },
                'image/webp',
                quality
            );
        };
        img.onerror = (err) => reject(err);
    });
}

export async function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
}

/**
 * Lädt ein Bild von einer URL und konvertiert es zu Base64
 * Wichtig für Image-to-Image mit Supabase URLs
 */
export async function urlToBase64(url: string): Promise<string> {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch image');
        const blob = await response.blob();

        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error("URL to Base64 failed:", error);
        throw error;
    }
}