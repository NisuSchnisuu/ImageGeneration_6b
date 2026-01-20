import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai";

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
        const { prompt, modelType, aspectRatio, referenceImage, slotNumber } = await req.json();

        if (!prompt) {
            return new Response(JSON.stringify({ error: "Prompt is required" }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const apiKey = Deno.env.get('GOOGLE_API_KEY');
        if (!apiKey) {
            return new Response(JSON.stringify({ error: "GOOGLE_API_KEY is not configured" }), {
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
You are a barrier for an image generation tool.
User Prompt: "${prompt}"
Slot: ${slotNumber} (0=Title, others=Content)

Analyze the request based on these rules:

1. TEXT REQUESTS (Only forbidden if Slot != 0):
   - Does the user ask for text, words, letters, signs, or typography to be rendered IN the image?
   - Examples: "Ein Schild auf dem 'Hallo' steht", "The letter A", "Word 'Love'".
   - If Slot == 0, Text is ALLOWED. Ignore this rule.
   - If Slot != 0, Text is FORBIDDEN.

2. SAFETY VIOLATIONS (Always Forbidden):
   - Violence, gore, sexual content, hate speech, harassment, self-harm.

Return JSON in this format:
{
  "allowed": boolean,
  "blockReason": "NONE" | "TEXT_REQUEST" | "SAFETY_VIOLATION",
  "reason": "string" // Optional detail
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
            parts.push({
                inlineData: {
                    data: base64Data,
                    mimeType: "image/png"
                }
            });
            parts[0].text = `Using the attached image as a visual reference, generate a new image based on this prompt: ${prompt}`;
        }

        const arSuffix = aspectRatio ? `\n\nEnsure the generated image has an aspect ratio of ${aspectRatio}.` : "";

        let textRestriction = "";
        // Wenn es NICHT Slot 0 (Titelbild) ist, verbieten wir Text strikt.
        if (slotNumber !== 0) {
            textRestriction = "\n\nIMPORTANT: Do NOT generate any text, letters, words, or numbers in the image. The image must be purely visual. If the user asks for text, ignore that part of the request. Visual Content ONLY.";
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
