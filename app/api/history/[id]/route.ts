import { NextResponse } from "next/server";
import {
  getSharedHistoryImageFile,
  getSharedHistoryImages,
  listSharedHistory,
  normalizeHistoryCustomerId,
} from "@/lib/server-history";
import { verifyLicense } from "@/lib/license/verifyLicense";

export const runtime = "nodejs";

function isAdminHistoryCode(code: string) {
  const normalizedCode = normalizeHistoryCustomerId(code);
  if (!normalizedCode) return false;

  const envAdminCode = normalizeHistoryCustomerId(process.env.COMMERCE_AI_ADMIN_CODE);
  if (envAdminCode && normalizedCode === envAdminCode) return true;

  const license = verifyLicense(normalizedCode);
  return license.valid && license.planId === "studio";
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const url = new URL(request.url);
    const adminCode =
      url.searchParams.get("adminCode") || request.headers.get("x-admin-code") || "";
    const licenseCode =
      url.searchParams.get("licenseCode") || request.headers.get("x-license-code") || "";
    const downloadIndex = url.searchParams.get("downloadIndex");

    if (!isAdminHistoryCode(adminCode)) {
      const customerId = normalizeHistoryCustomerId(licenseCode);
      const history = await listSharedHistory();
      const item = history.find((entry) => entry.id === id);

      if (!item || normalizeHistoryCustomerId(item.customerId) !== customerId) {
        return NextResponse.json({ error: "无权读取这条历史记录。" }, { status: 403 });
      }
    }

    if (downloadIndex !== null) {
      const imageFile = await getSharedHistoryImageFile(id, Number(downloadIndex) || 0);
      if (!imageFile) {
        return NextResponse.json({ error: "历史图片文件不存在。" }, { status: 404 });
      }

      return new NextResponse(new Uint8Array(imageFile.buffer), {
        headers: {
          "Cache-Control": "private, max-age=31536000, immutable",
          "Content-Disposition": `attachment; filename="${encodeURIComponent(imageFile.filename)}"`,
          "Content-Type": imageFile.mimeType,
        },
      });
    }

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
