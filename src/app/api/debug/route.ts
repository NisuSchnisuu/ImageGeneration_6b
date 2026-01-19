import { NextResponse } from "next/server";

export async function GET() {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "No API Key found" }, { status: 500 });
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );
    
    if (!response.ok) {
        throw new Error(await response.text());
    }

    const data = await response.json();
    // Filtere nur Modelle, die interessant sein könnten
    const models = data.models || [];
    
    return NextResponse.json({ 
        count: models.length,
        models: models.map((m: any) => ({
            name: m.name,
            supportedGenerationMethods: m.supportedGenerationMethods,
            displayName: m.displayName
        })) 
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
