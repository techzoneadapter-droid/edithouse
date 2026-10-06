import { compositeMasked } from "@/lib/composite";
import { NextRequest, NextResponse } from "next/server";
import { extractImage, getGemini, splitDataUrl } from "@/lib/gemini";

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
  finish?: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const imageDataUrl = body.imageDataUrl as string;
    const assignments = (body.assignments || []) as Assignment[];
    const quality = body.quality === "pro" ? "pro" : "fast";
    const preserveArchitecture = true;
    const customInstruction = String(body.customInstruction || "").trim();

    if (!imageDataUrl) {
      return NextResponse.json({ error: "Chưa có ảnh công trình." }, { status: 400 });
    }
    if (!assignments.length) {
      return NextResponse.json({ error: "Hãy chọn ít nhất một chi tiết để phối màu." }, { status: 400 });
    }

    if (!Array.isArray(assignments) || assignments.length > 80 || assignments.some(a => typeof a.maskDataUrl !== 'string' || !/^#[0-9a-f]{6}$/i.test(a.hex))) {
      return NextResponse.json({error: "Mỗi bề mặt cần mask PNG và màu HEX hợp lệ."}, {status: 400});
    }
    const { mimeType, data } = splitDataUrl(imageDataUrl);
    // Validate dimensions and empty masks before making a paid AI request.
    await compositeMasked(Buffer.from(data,'base64'),Buffer.from(data,'base64'),assignments.map(a=>a.maskDataUrl));
    const ai = getGemini();
    const model =
      quality === "pro"
        ? process.env.GEMINI_RENDER_PRO_MODEL || "gemini-3-pro-image"
        : process.env.GEMINI_RENDER_MODEL || "gemini-3.1-flash-image";

    const assignmentText = assignments
      .map((a, i) => {
        const description = a.structureDescription ? " (" + a.structureDescription + ")" : "";
        const code = a.colorCode ? " [" + a.colorCode + "]" : "";
        const finish = a.finish ? ", bề mặt " + a.finish : "";
        return (
          String(i + 1) + ". Mask " + String(i+1) + ": " + a.structureName + description + ": " +
          a.materialName + ", màu " + a.colorName + code + ", HEX " + a.hex + finish + "."
        );
      })
      .join("\n");

    const rules = preserveArchitecture
      ? "KHÓA TOÀN BỘ KIẾN TRÚC: giữ nguyên 100% hình học, tỷ lệ, vị trí, số lượng cửa, kính, mái, cột, đường chỉ/phào, khe, lan can, máy lạnh, ống, đèn, xe, người, cây cối, nền sân và mọi vật thể khác."
      : "Giữ bố cục và kiến trúc gần như nguyên bản.";

    const prompt = [
      "Đây là một ảnh chụp công trình thực tế. Hãy tạo một bản PHỐI MÀU KIẾN TRÚC SIÊU THỰC dựa trực tiếp trên ảnh gốc.",
      "",
      "CÁC BỀ MẶT PHẢI THAY ĐỔI:",
      assignmentText,
      "",
      "QUY TẮC BẮT BUỘC:",
      "- Chỉ thay màu / vật liệu hoàn thiện của đúng các bề mặt được liệt kê.",
      "- " + rules,
      "- Không tự thêm cửa, không xóa cửa, không đổi hình dáng tòa nhà, không sửa phối cảnh, không làm sạch hoặc tái thiết kế công trình.",
      "- Giữ nguyên góc máy, tiêu cự, thời tiết, ánh sáng, bóng đổ, độ sâu, độ nhiễu và cảm giác camera của ảnh gốc.",
      "- Màu phải bám theo HEX được chỉ định nhưng phải phản ứng tự nhiên với ánh sáng thực tế; vùng tối vẫn tối, vùng sáng vẫn sáng.",
      "- Sơn nước phải thể hiện đúng độ phủ và chất liệu thật, không biến thành lớp nhựa phẳng.",
      "- Giả đá / marble / granite / bê tông / stucco / metallic phải có texture đúng tỷ lệ thi công thật, không phóng đại.",
      "- Bề mặt kính, cửa sổ, cửa đi, kim loại không được đổi màu trừ khi chúng nằm trong danh sách.",
      "- Không thêm chữ, logo, watermark, biển hiệu hoặc hiệu ứng đồ họa.",
      "- Kết quả phải giống ảnh chụp sau khi công trình đã được thi công sơn thật, không giống render 3D, không giống tranh AI.",
      customInstruction ? "\nGHI CHÚ THÊM TỪ NGƯỜI DÙNG:\n" + customInstruction : ""
    ].filter(Boolean).join("\n");

    const interaction = await ai.interactions.create({
      model,
      input: [
        { type: "image", mime_type: mimeType, data },
        ...assignments.flatMap((a, i) => { const mask = splitDataUrl(a.maskDataUrl); return [{type: "text", text: "Mask " + (i+1) + ": vùng trắng là vùng cần sơn; phần trong suốt phải giữ nguyên."}, {type: "image", mime_type: mask.mimeType, data: mask.data}]; }),
        { type: "text", text: prompt }
      ],
      response_format: {
        type: "image",
        mime_type: "image/jpeg",
        image_size: quality === "pro" ? "2K" : "1K"
      }
    } as any);

    const image = extractImage(interaction);
    const locked = await compositeMasked(Buffer.from(data, "base64"), Buffer.from(image.data, "base64"), assignments.map(a=>a.maskDataUrl));
    return NextResponse.json({
      imageDataUrl: "data:image/png;base64," + locked.toString("base64"),
      model
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Không thể tạo ảnh phối màu." },
      { status: 500 }
    );
  }
}
