import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { prompt, modelType, aspectRatio } = await req.json();

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GOOGLE_API_KEY is not configured" },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Auswahl des Modells basierend auf der Nutzerentscheidung
    const selectedModel = modelType === "pro" 
      ? "gemini-3-pro-image-preview" 
      : "gemini-2.5-flash-image";

    const model = genAI.getGenerativeModel({ model: selectedModel });

    // Wir rufen generateContent auf. 
    // Hinweis: Die genauen Parameter-Strukturen für Seitenverhältnisse 
    // können sich bei experimentellen Modellen noch ändern.
    const result = await model.generateContent(prompt);
    const response = await result.response;
    
    const candidate = response.candidates?.[0];
    const parts = candidate?.content?.parts || [];
    const imagePart = parts.find(part => part.inlineData);

    if (!imagePart || !imagePart.inlineData) {
        return NextResponse.json(
            { error: "No image data found. The model might have refused the prompt or is currently unavailable." },
            { status: 500 }
        );
    }

    const imageBase64 = imagePart.inlineData.data;
    const mimeType = imagePart.inlineData.mimeType || "image/png";

    return NextResponse.json({ 
        image: `data:${mimeType};base64,${imageBase64}` 
    });

  } catch (error: any) {
    console.error("Server Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
