import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.12.0";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { prompt, modelType, aspectRatio, referenceImage, characterReferences, slotNumber } = await req.json();


        if (!prompt) {
            return new Response(JSON.stringify({ error: "Prompt is required" }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const apiKey = Deno.env.get('GOOGLE_API_KEY');
        if (!apiKey) {
            return new Response(JSON.stringify({
                error: "GOOGLE_API_KEY is not configured"
            }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Initialize Gemini (using same logic as before but with Deno imports)
        const genAI = new GoogleGenerativeAI(apiKey);

        // --- GUARDRAIL CHECK STARTS HERE ---
        const guardModel = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            generationConfig: { responseMimeType: "application/json" }
        });

        // "Text Request" means: User wants letters, words, signs, typography inside the image.
        // "Safety Violation" means: Violence, hate, sexual content, self-harm, harassment.
        const guardPrompt = `
You are a barrier and classifier for an image generation tool.
User Prompt: "${prompt}"
Slot: ${slotNumber} (0=Title, 1=Character, others=Content)

Analyze the request based on these rules:

1. TEXT REQUESTS (Forbidden if Slot != 0):
   - Does the user ask for text, words, letters, signs, or typography to be rendered IN the image?
   - If Slot == 0, Text is ALLOWED.
   - If Slot != 0, Text is FORBIDDEN.

2. CHARACTER CHECK (Required if Slot == 1):
   - If Slot == 1, the user MUST describe a living or fictional character (person, animal, creature, robot).
   - If they describe a landscape, object, vehicle, building, or abstract concept WITHOUT a main character, it is INVALID.
   - If Slot != 1, this rule is ignored.

3. SAFETY VIOLATIONS (Always Forbidden):
   - Violence, gore, sexual content, hate speech, harassment, self-harm.

Return JSON in this format:
{
  "allowed": boolean,
  "blockReason": "NONE" | "TEXT_REQUEST" | "SAFETY_VIOLATION" | "NOT_A_CHARACTER",
  "reason": "string"
}
`;

        try {
            const result = await guardModel.generateContent(guardPrompt);
            const response = await result.response;
            let text = response.text();
            console.log("Raw Guardrail Output:", text);

            // Robust JSON Cleaning: Remove markdown code blocks if present
            text = text.replace(/```json/g, "").replace(/```/g, "").trim();

            const guardResult = JSON.parse(text);

            if (!guardResult.allowed) {
                // Map the block reason to the specific messages requested
                let clientMessage = "Ich kann das nicht erstellen.";
                let clientBlockType = "SAFETY"; // Default

                if (guardResult.blockReason === "TEXT_REQUEST") {
                    // Specific message for Text Requests
                    clientMessage = "Ich erstelle dir keinen Text auf dem Bild, das kannst du selbst besser. Wenn dir das nicht passt, kannst du bei Herrn Maurer motzen 😉.";
                    clientBlockType = "TEXT";
                } else if (guardResult.blockReason === "NOT_A_CHARACTER") {
                    clientMessage = "Diese Mappe ist nur für Charaktere reserviert. Bitte beschreibe eine Person, ein Tier oder eine Fantasiefigur.";
                    clientBlockType = "SAFETY";
                } else {
                    // Default / Safety
                    clientMessage = "Ich kann das nicht erstellen, das verstösst gegen meine Nutzunsrichtlinien.";
                }

                return new Response(JSON.stringify({
                    error: clientMessage, // Supabase/Client often looks at 'error'
                    reason: clientMessage,
                    blockType: clientBlockType,
                    isSafetyBlock: true
                }), {
                    status: 200, // Return 200 so client receives 'data' with our custom fields instead of throwing
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
            }
        } catch (e) {
            console.error("Guardrail check failed:", e);
            // FAIL CLOSED
            return new Response(JSON.stringify({ error: "Guardrail Validation Failed (Internal System Error)" }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
        // --- GUARDRAIL CHECK ENDS ---

        // Always use Gemini 3 Pro
        const selectedModel = "gemini-3-pro-image-preview";
        const model = genAI.getGenerativeModel({ model: selectedModel });

        const parts: any[] = [{ text: prompt }];

        if (referenceImage) {
            const base64Data = referenceImage.split(',')[1] || referenceImage;
            // Standard Reference Image (Style/Composition)
            parts.push({
                inlineData: {
                    data: base64Data,
                    mimeType: "image/png"
                }
            });
            parts[0].text = `Using the LAST attached image as a visual style reference, generate a new image based on this prompt: ${prompt}`;
        }

        // --- CHARACTER REFERENCES ---
        if (characterReferences && Array.isArray(characterReferences) && characterReferences.length > 0) {
            let charRefText = "\n\nSPECIFIC CHARACTER REFERENCES:\nThe following images are specific character designs that MUST be used in the generated image according to their labels.\n";

            // First, append all char images
            characterReferences.forEach((char: any, index: number) => {
                const base64Data = char.data.split(',')[1] || char.data;

                // Push Image
                parts.push({
                    inlineData: {
                        data: base64Data,
                        mimeType: "image/png"
                    }
                });

                // Add text label for this image
                // Note: Gemini 1.5/2.5 Pro usually associates the previous image with the text following it or preceding it.
                // Best strategy for multi-image: "Image [X] represents Character [X]".
                // Since 'parts' is an ordered array, we can just append text.
                charRefText += `- Image #${index + 1 + (referenceImage ? 1 : 0)} provided above is 'Charakter ${index + 1}' (${char.label}). Use this specific visual design when the prompt refers to 'Charakter ${index + 1}'.\n`;
            });

            parts[0].text += charRefText;
        }

        const arSuffix = aspectRatio ? `\n\nEnsure the generated image has an aspect ratio of ${aspectRatio}.` : "";

        let textRestriction = "";
        // Wenn es NICHT Slot 0 (Titelbild) ist, verbieten wir Text strikt.
        if (slotNumber !== 0) {
            textRestriction = "\n\nIMPORTANT: Do NOT generate any text, letters, words, or numbers in the image. The image must be purely visual. If the user asks for text, ignore that part of the request. Visual Content ONLY.";
        }

        if (slotNumber === 1) {
            textRestriction += "\n\nIMPORTANT: Generate the described character ISOLATED on a simple, solid color background. The character MUST be in a full-body standing pose, facing forward (front view), with a neutral expression and arms at the sides. Do NOT generate any action, running, or dynamic poses. Do NOT generate complex scenes, landscapes, or detailed backgrounds. The focus must be 100% on the character design as a reference sheet.";
        }

        parts[0].text += arSuffix + textRestriction;


        const result = await model.generateContent({ contents: [{ role: "user", parts }] });
        const response = await result.response;

        // Check for Safety Blocks
        if (response.promptFeedback?.blockReason) {
            return new Response(JSON.stringify({ error: `BLOCKED: ${response.promptFeedback.blockReason}` }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200, // Return 200 so frontend can parse JSON easily, but with error field
            });
        }

        const candidate = response.candidates?.[0];

        if (candidate?.finishReason === 'SAFETY') {
            return new Response(JSON.stringify({ error: "BLOCKED: SAFETY_VIOLATION" }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            });
        }

        if (candidate?.finishReason === 'RECITATION') {
            return new Response(JSON.stringify({ error: "BLOCKED: RECITATION" }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            });
        }

        const imagePart = candidate?.content?.parts?.find((part: any) => part.inlineData);

        if (!imagePart || !imagePart.inlineData) {
            throw new Error("No image generated (Unknown Reason).");
        }

        const imageBase64 = `data:${imagePart.inlineData.mimeType || 'image/png'};base64,${imagePart.inlineData.data}`;

        return new Response(JSON.stringify({ image: imageBase64 }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error: any) {
        console.error(error);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        });
    }
});
