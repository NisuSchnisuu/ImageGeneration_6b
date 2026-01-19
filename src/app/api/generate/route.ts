import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

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

    // ACHTUNG: Die Imagen-Generierung über die 'google-genai' Lib funktioniert etwas anders
    // als Text. Aktuell ist der direkteste Weg für Bilder oft noch REST oder spezifische Beta-Endpunkte.
    // Aber wir versuchen es mit dem Standard-Modell-Aufruf, wie er für Multimodal gedacht ist.
    // Falls das Modell 'imagen-3.0-generate-001' hier nicht direkt über generateContent
    // Bilder zurückgibt (sondern nur Text), müssen wir den REST-Fallback nutzen.
    
    // Wir nutzen hier einen REST-Fallback, da die JS-SDK Unterstützung für Imagen
    // manchmal hinterherhinkt oder spezifische Methoden braucht.
    
    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${apiKey}`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                instances: [
                    {
                        prompt: prompt,
                    }
                ],
                parameters: {
                    sampleCount: 1,
                    // aspectRatio: "1:1" // Optional
                }
            })
        }
    );

    if (!response.ok) {
        const errorText = await response.text();
        console.error("Google API Error:", errorText);
        return NextResponse.json(
            { error: `Google API Error: ${response.statusText}`, details: errorText },
            { status: response.status }
        );
    }

    const data = await response.json();
    
    // Die Struktur der Antwort für Imagen variiert je nach API Version.
    // Wir extrahieren das Base64 Bild.
    const predictions = data.predictions;
    if (!predictions || predictions.length === 0) {
         return NextResponse.json(
            { error: "No image generated" },
            { status: 500 }
        );
    }

    // Imagen gibt oft bytesBase64Encoded zurück
    const imageBase64 = predictions[0].bytesBase64Encoded;

    return NextResponse.json({ image: `data:image/png;base64,${imageBase64}` });

  } catch (error: any) {
    console.error("Server Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
