import { NextResponse } from "next/server";
import { getSharedHistoryImages } from "@/lib/server-history";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    return NextResponse.json({ images: await getSharedHistoryImages(id) });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load shared history images.",
      },
      { status: 404 },
    );
  }
}
