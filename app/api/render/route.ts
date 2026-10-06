import { compositeMasked } from "@/lib/composite";
import { recolorPaintSurfaces } from "@/lib/paint-recolor";
import { NextRequest, NextResponse } from "next/server";
import { splitDataUrl } from "@/lib/image-data";
import { runRole } from "@/lib/ai/provider";
import { AIError } from "@/lib/ai/experiential-provider";
import { failure, localRequest } from "@/lib/ai/http";

export const runtime = "nodejs";
export const maxDuration = 180;

type Assignment = {
  maskDataUrl: string;
  structureName: string;
  structureDescription?: string;
  colorName: string;
  colorCode?: string;
  hex: string;
  materialName: string;
  materialId?: string;
  finish?: string;
};

const TEXTURE_FINISHES = [
  "granite",
  "marble",
  "đá hạt",
  "bê tông thô",
  "microcement",
  "stucco",
  "venetian",
  "metallic",
  "hiệu ứng cát",
  "hiệu ứng nhung",
  "sơn kim loại",
  "stain gỗ"
];

function needsGenerativeTexture(assignment: Assignment) {
  const finish = String(assignment.finish || "").toLocaleLowerCase("vi");
  const material = String(assignment.materialId || "").toLocaleLowerCase("vi");
  const materialName = String(assignment.materialName || "").toLocaleLowerCase("vi");
  if (material === "stone" || material === "wood") return true;
  if (materialName.includes("đá") || materialName.includes("gỗ")) return true;
  return TEXTURE_FINISHES.some(value => finish.includes(value));
}

export async function POST(request: NextRequest) {
  try {
    localRequest(request);
    const body = await request.json();
    const imageDataUrl = body.imageDataUrl as string;
    const assignments = (body.assignments || []) as Assignment[];
    const customInstruction = String(body.customInstruction || "").trim();

    if (!imageDataUrl) {
      return NextResponse.json({ error: "Chưa có ảnh công trình." }, { status: 400 });
    }
    if (!assignments.length) {
      return NextResponse.json({ error: "Hãy chọn ít nhất một chi tiết để phối màu." }, { status: 400 });
    }
    if (
      !Array.isArray(assignments) ||
      assignments.length > 80 ||
      assignments.some(a => typeof a.maskDataUrl !== "string" || !/^#[0-9a-f]{6}$/i.test(a.hex))
    ) {
      return NextResponse.json({ error: "Mỗi bề mặt cần mask PNG và màu HEX hợp lệ." }, { status: 400 });
    }

    const { data } = splitDataUrl(imageDataUrl);
    const original = Buffer.from(data, "base64");

    // Validate every mask before any paid AI request.
    await compositeMasked(original, original, assignments.map(a => a.maskDataUrl));

    const paintAssignments = assignments.filter(a => !needsGenerativeTexture(a));
    const textureAssignments = assignments.filter(needsGenerativeTexture);

    // Normal paint is deterministic: recolor only chroma/lightness inside the mask.
    // This keeps perspective, edges, camera noise, shadows and surface texture intact.
    let base = original;
    if (paintAssignments.length) {
      base = await recolorPaintSurfaces(
        original,
        paintAssignments.map(a => ({
          maskDataUrl: a.maskDataUrl,
          hex: a.hex,
          finish: a.finish
        }))
      );
    }

    if (!textureAssignments.length) {
      return NextResponse.json({
        imageDataUrl: "data:image/png;base64," + base.toString("base64"),
        model: "paint-recolor-v2"
      });
    }

    const assignmentText = textureAssignments
      .map((a, i) => {
        const description = a.structureDescription ? " (" + a.structureDescription + ")" : "";
        const code = a.colorCode ? " [" + a.colorCode + "]" : "";
        const finish = a.finish ? ", bề mặt " + a.finish : "";
        return (
          String(i + 1) + ". Mask " + String(i + 1) + ": " + a.structureName + description + ": " +
          a.materialName + ", màu " + a.colorName + code + ", HEX " + a.hex + finish + "."
        );
      })
      .join("\n");

    const prompt = [
      "Đây là ảnh công trình đã được khóa kiến trúc và có thể đã được phối các lớp sơn màu thường.",
      "Chỉ tạo texture/vật liệu cho đúng các mask được cung cấp; tuyệt đối không thay đổi vùng ngoài mask.",
      "",
      "CÁC BỀ MẶT CẦN TẠO VẬT LIỆU:",
      assignmentText,
      "",
      "QUY TẮC BẮT BUỘC:",
      "- Giữ nguyên 100% hình học, tỷ lệ, vị trí, số lượng cửa, kính, mái, cột, chỉ/phào, khe, lan can và mọi vật thể khác.",
      "- Không đổi góc máy, phối cảnh, tiêu cự, thời tiết, bóng đổ hoặc ánh sáng tổng thể.",
      "- Màu phải bám theo HEX chỉ định nhưng phản ứng tự nhiên với ánh sáng hiện hữu.",
      "- Texture phải đúng tỷ lệ thi công thật; không phóng đại vân đá, vân gỗ hoặc hạt hiệu ứng.",
      "- Không thêm chữ, logo, watermark hay vật thể mới.",
      "- Kết quả phải giống ảnh chụp công trình sau thi công, không giống render 3D hoặc tranh AI.",
      customInstruction ? "\nGHI CHÚ THÊM TỪ NGƯỜI DÙNG:\n" + customInstruction : ""
    ].filter(Boolean).join("\n");

    const baseDataUrl = "data:image/png;base64," + base.toString("base64");
    const { result: image, model } = await runRole("IMAGE_RENDER", async (ai, m) => {
      const response = await ai.chat(
        m.slug,
        prompt,
        [baseDataUrl, ...textureAssignments.map(a => a.maskDataUrl)]
      );
      const url = response.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      if (typeof url !== "string" || !url.startsWith("data:image/")) {
        throw new AIError(
          "Route không trả ảnh edit. Model không tương thích IMAGE_RENDER.",
          400,
          "unsupported_capability"
        );
      }
      return splitDataUrl(url);
    });

    const locked = await compositeMasked(
      base,
      Buffer.from(image.data, "base64"),
      textureAssignments.map(a => a.maskDataUrl)
    );

    return NextResponse.json({
      imageDataUrl: "data:image/png;base64," + locked.toString("base64"),
      model: model + "+paint-recolor-v2"
    });
  } catch (error) {
    return failure(error);
  }
}
