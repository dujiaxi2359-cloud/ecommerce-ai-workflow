import { NextResponse } from "next/server";
import { createOpenAIClient } from "@/lib/openai";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let prompt = "";

  try {
    const body = (await request.json()) as { prompt?: string };
    prompt = body.prompt?.trim() || "";

    if (!prompt) {
      return NextResponse.json(
        { error: "Please enter a prompt to optimize." },
        { status: 400 },
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ prompt: createLocalOptimizedPrompt(prompt) });
    }

    const openai = createOpenAIClient(60_000);
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content:
            "You are a commercial visual prompt expert. Rewrite the user's short Chinese description into a professional Chinese image-generation prompt. Preserve intent and add subject, composition, lighting, materials, scene, usage, and quality requirements. Output only the optimized prompt.",
        },
        { role: "user", content: prompt },
      ],
    });

    return NextResponse.json({
      prompt:
        completion.choices[0]?.message.content?.trim() ||
        createLocalOptimizedPrompt(prompt),
    });
  } catch {
    return NextResponse.json({ prompt: createLocalOptimizedPrompt(prompt) });
  }
}

function createLocalOptimizedPrompt(prompt: string) {
  return [
    prompt.trim(),
    "Clear main subject, premium commercial photography quality, clean layered composition, soft refined lighting, realistic material detail, uncluttered background, suitable for brand posters, ecommerce hero images, and social media covers.",
    "Avoid watermarks, garbled text, low resolution, product distortion, and messy backgrounds.",
  ]
    .filter(Boolean)
    .join(" ");
}
