import { NextRequest, NextResponse } from "next/server";
import { extractText, getGemini, splitDataUrl } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 60;

const schema = {
  type: "object",
  properties: {
    buildingType: { type: "string" },
    summary: { type: "string" },
    structures: {
      type: "array",
      minItems: 1,
      maxItems: 40,
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          type: { type: "string" },
          description: { type: "string" },
          recommendedMaterials: { type: "array", items: { type: "string" } },
          confidence: { type: "number", minimum: 0, maximum: 1 }
        },
        required: ["id", "name", "type", "description", "recommendedMaterials", "confidence"]
      }
    }
  },
  required: ["buildingType", "summary", "structures"]
};

export async function POST(request: NextRequest) {
  try {
    const { imageDataUrl } = await request.json();
    if (!imageDataUrl || typeof imageDataUrl !== "string") {
      return NextResponse.json({ error: "Chưa có ảnh công trình." }, { status: 400 });
    }

    const { mimeType, data } = splitDataUrl(imageDataUrl);
    const ai = getGemini();
    const model = process.env.GEMINI_ANALYZE_MODEL || "gemini-3.1-flash-lite";

    const prompt = [
      "Bạn là kiến trúc sư và chuyên gia thi công sơn. Hãy phân tích ảnh công trình thực tế này để phục vụ một phần mềm phối màu.",
      "",
      "YÊU CẦU:",
      "- Nhận diện TẤT CẢ các cấu kiện/bề mặt có thể sơn hoặc hoàn thiện nhìn thấy trong ảnh.",
      "- Tách chi tiết theo đúng ngôn ngữ thi công Việt Nam khi có thể: tường mặt tiền, tường hông, mảng nhấn, chỉ ngang, chỉ đứng, phào, diềm mái, trần ban công, trần sảnh, cột, dầm, chân tường, bệ cửa, khung cửa, lan can, mái, lam, tường rào, cổng, bồn cây...",
      "- Không gộp các khu vực khác vật liệu hoặc khác vai trò kiến trúc nếu có thể phân biệt.",
      "- Chỉ liệt kê cấu kiện thực sự nhìn thấy hoặc có căn cứ mạnh từ ảnh; không bịa thêm.",
      "- id phải ngắn, duy nhất, dạng kebab-case.",
      "- type dùng một trong các nhóm gần nhất: wall, trim, molding, ceiling, column, beam, plinth, window-frame, door-frame, railing, roof, gate, fence, metal, wood, stone, other.",
      "- recommendedMaterials chỉ dùng các mã phù hợp: exterior, interior, waterproof, stone, concrete, stucco, metal, wood.",
      "- confidence là độ tin cậy 0..1.",
      "- summary mô tả ngắn tình trạng tổng thể và các vùng đáng chú ý khi phối màu.",
      "Trả đúng JSON theo schema, không thêm markdown."
    ].join("\n");

    const interaction = await ai.interactions.create({
      model,
      input: [
        { type: "image", mime_type: mimeType, data },
        { type: "text", text: prompt }
      ],
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema
      }
    } as any);

    const raw = extractText(interaction);
    const parsed = JSON.parse(raw);

    const structures = Array.isArray(parsed.structures)
      ? parsed.structures.map((item: any, index: number) => ({
          id: String(item.id || "surface-" + (index + 1)),
          name: String(item.name || "Bề mặt " + (index + 1)),
          type: String(item.type || "other"),
          description: String(item.description || ""),
          recommendedMaterials: Array.isArray(item.recommendedMaterials)
            ? item.recommendedMaterials.map(String)
            : ["exterior"],
          confidence: Math.max(0, Math.min(1, Number(item.confidence ?? 0.6)))
        }))
      : [];

    return NextResponse.json({
      buildingType: String(parsed.buildingType || "Công trình"),
      summary: String(parsed.summary || ""),
      structures
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Không thể phân tích ảnh." },
      { status: 500 }
    );
  }
}
