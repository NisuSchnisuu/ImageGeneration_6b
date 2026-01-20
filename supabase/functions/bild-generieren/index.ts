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
        const { prompt, modelType, aspectRatio, referenceImage } = await req.json();

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

        const candidate = response.candidates?.[0];
        const imagePart = candidate?.content?.parts?.find((part: any) => part.inlineData);

        if (!imagePart || !imagePart.inlineData) {
            throw new Error("No image generated.");
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
