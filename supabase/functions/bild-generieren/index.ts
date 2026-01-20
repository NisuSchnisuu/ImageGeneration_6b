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
        const guardModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const guardPrompt = `
You are a content safety filter for a strictly visual image generation tool for students.
Analyze the User Prompt: "${prompt}"

Context:
- The user is generating an image in Slot ${slotNumber}.

Rules for "NOT ALLOWED":
1. Safety Violation: Use standard strict safety guidelines (no violence, hate speech, sexual content, self-harm, harassment).
2. Text Restriction: If Slot is NOT 0, the user MUST NOT ask for text, words, letters, signs, labels, or numbers to be visible in the image. (Example: "A dog holding a sign saying hello" -> VIOLATION if Slot != 0. "A dog" -> PERMITTED).

If the prompt violates any rule, you must block it.

Return a JSON object with this structure:
{
  "allowed": boolean,
  "reason": "string" // IF allowed is false: Write a friendly error message in German explaining why. For text violations say something like "Ich erstelle hier keinen Text auf Bildern, das kannst du selbst besser! ;D". For safety violations be clear but polite.
}
`;

        try {
            const result = await guardModel.generateContent(guardPrompt);
            const response = await result.response;
            const text = response.text();
            // Parse JSON (handle potential markdown blocks)
            const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
            const guardResult = JSON.parse(jsonStr);

            if (!guardResult.allowed) {
                return new Response(JSON.stringify({
                    reason: guardResult.reason,
                    isSafetyBlock: true
                }), {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
            }
        } catch (e) {
            console.error("Guardrail check failed:", e);
            // We proceed if guardrail fails to avoid blocking system due to glitch
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

        parts[0].text += arSuffix;


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
