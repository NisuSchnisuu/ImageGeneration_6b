import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { prompt, modelType, aspectRatio, referenceImage } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "GOOGLE_API_KEY is not configured" }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const selectedModel = modelType === "pro" ? "gemini-3-pro-image-preview" : "imagen-3.0-generate-001";
    const model = genAI.getGenerativeModel({ model: selectedModel });

    // Vorbereitung der Parts für die KI
    const parts: any[] = [{ text: prompt }];

    // Wenn ein Referenzbild vorhanden ist, fügen wir es hinzu
    if (referenceImage) {
      // Wir entfernen den Header (data:image/png;base64,) falls vorhanden
      const base64Data = referenceImage.split(',')[1] || referenceImage;
      parts.push({
        inlineData: {
          data: base64Data,
          mimeType: "image/png" // Oder entsprechend anpassen
        }
      });

      // Wir fügen eine Anweisung hinzu, dass das Bild als Referenz dienen soll
      parts[0].text = `Using the attached image as a visual reference, generate a new image based on this prompt: ${prompt}`;
    }

    // Hinweis: Aspect Ratio wird bei Gemini Image Modellen oft über zusätzliche 
    // Parameter im Model-Aufruf oder direkt im Prompt gesteuert.
    // Hier fügen wir es dem Prompt hinzu, um maximale Kompatibilität zu gewährleisten.
    const arSuffix = aspectRatio ? ` Use aspect ratio ${aspectRatio}.` : "";
    parts[0].text += arSuffix;

    const result = await model.generateContent({ contents: [{ role: "user", parts }] });
    const response = await result.response;

    const candidate = response.candidates?.[0];
    const imagePart = candidate?.content?.parts?.find(part => part.inlineData);

    if (!imagePart || !imagePart.inlineData) {
      return NextResponse.json({ error: "No image generated." }, { status: 500 });
    }

    return NextResponse.json({
      image: `data:${imagePart.inlineData.mimeType || 'image/png'};base64,${imagePart.inlineData.data}`
    });

  } catch (error: any) {
    console.error("Server Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}