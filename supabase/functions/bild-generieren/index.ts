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
        const guardPrompt = `
You are a barrier for an image generation tool.
User Prompt: "${prompt}"
Slot: ${slotNumber} (0=Title, others=Content)

Rules:
1. SAFETY: Strict blocking of violence, hate, sexual content, self-harm.
2. TEXT: If Slot!=0, NO request for text, letters, signs, words.

Return JSON:
{
  "allowed": boolean,
  "reason": "string" // German error message if allowed=false.
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
            // FAIL CLOSED: If the guardrail check crashes (e.g. JSON parse error), 
            // we MUST stop and return an error instead of generating the image.
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
