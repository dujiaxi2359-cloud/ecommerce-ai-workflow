import { NextResponse } from "next/server";
import { listSharedHistory, saveSharedHistory } from "@/lib/server-history";
import type { SharedHistoryItem } from "@/lib/server-history";
import type { GeneratedImage } from "@/lib/image-generation";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ history: await listSharedHistory() });
}

export async function POST(request: Request) {
  let payload: { item?: Partial<SharedHistoryItem>; images?: unknown[] } | null = null;

  try {
    payload = await request.json();

    if (!payload?.item?.id) {
      return NextResponse.json({ error: "History item id is required." }, { status: 400 });
    }

    const item = await saveSharedHistory(
      payload.item as SharedHistoryItem,
      (payload.images || []) as GeneratedImage[],
    );
    return NextResponse.json({ item });
  } catch (error) {
    return NextResponse.json({
      item: payload?.item || null,
      warning:
        error instanceof Error
          ? `共享历史保存失败，但图片生成不受影响：${error.message}`
          : "共享历史保存失败，但图片生成不受影响。",
    });
  }
}
