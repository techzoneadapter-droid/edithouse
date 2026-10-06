import { validatePolygons } from "@/lib/masks";
import { NextRequest, NextResponse } from "next/server";
import { splitDataUrl } from "@/lib/image-data";
import { runRole } from "@/lib/ai/provider";
import { failure, localRequest } from "@/lib/ai/http";

export const runtime = "nodejs";
export const maxDuration = 60;

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    buildingType: { type: "string" },
    summary: { type: "string" },
    structures: {
      type: "array",
      minItems: 1,
      maxItems: 40,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          type: { type: "string" },
          description: { type: "string" },
          recommendedMaterials: { type: "array", items: { type: "string" } },
          polygons: { type: "array", items: { type: "array", minItems: 3, items: { type: "array", minItems: 2, maxItems: 2, items: { type: "number", minimum: 0, maximum: 1000 } } } },
          confidence: { type: "number", minimum: 0, maximum: 1 }
        },
        required: ["id", "name", "type", "description", "recommendedMaterials", "confidence", "polygons"]
      }
    }
  },
  required: ["buildingType", "summary", "structures"]
};

export async function POST(request: NextRequest) {
  try {
    localRequest(request);
    const { imageDataUrl } = await request.json();
    if (!imageDataUrl || typeof imageDataUrl !== "string") {
      return NextResponse.json({ error: "Chưa có ảnh công trình." }, { status: 400 });
    }

    splitDataUrl(imageDataUrl);
    const prompt = [
      "Bạn là kiến trúc sư và chuyên gia thi công sơn. Hãy phân tích ảnh công trình thực tế này để phục vụ một phần mềm phối màu.",
      "",
      "YÊU CẦU:",
      "- Nhận diện TẤT CẢ các cấu kiện/bề mặt có thể sơn hoặc hoàn thiện nhìn thấy trong ảnh.",
      "- Tách chi tiết theo đúng ngôn ngữ thi công Việt Nam khi có thể: tường mặt tiền, tường hông, mảng nhấn, chỉ ngang, chỉ đứng, phào, diềm mái, trần ban công, trần sảnh, cột, dầm, chân tường, bệ cửa, khung cửa, lan can, mái, lam, tường rào, cổng, bồn cây...",
      "- Không gộp các khu vực khác vật liệu hoặc khác vai trò kiến trúc nếu có thể phân biệt.",
      "- Chỉ liệt kê cấu kiện thực sự nhìn thấy hoặc có căn cứ mạnh từ ảnh; không bịa thêm.",
      "- id phải ngắn, duy nhất, dạng kebab-case.",
      "- polygons là các đường biên vùng sơn, mỗi điểm [x,y] chuẩn hóa 0..1000 so với toàn ảnh. Tách các vùng rời nhau. Không dùng hộp chữ nhật bao thay mask. Loại trừ cửa, kính, người, cây, xe và vật che khuất. Nếu không xác định được, trả polygons rỗng để vẽ thủ công.",
      "- Lỗ bên trong vùng (ví dụ cửa sổ) cần một đường biên đa giác riêng nằm bên trong đa giác ngoài; các đường biên được tô theo quy tắc even-odd.",
      "- type dùng một trong các nhóm gần nhất: wall, trim, molding, ceiling, column, beam, plinth, window-frame, door-frame, railing, roof, gate, fence, metal, wood, stone, other.",
      "- recommendedMaterials chỉ dùng các mã phù hợp: exterior, interior, waterproof, stone, concrete, stucco, metal, wood.",
      "- confidence là độ tin cậy 0..1.",
      "- summary mô tả ngắn tình trạng tổng thể và các vùng đáng chú ý khi phối màu.",
      "Trả đúng JSON theo schema, không thêm markdown."
    ].join("\n");

    const {result: parsed} = await runRole("VISION_ANALYZE", async (ai, model) => {
      const response = await ai.chat(model.slug, prompt, [imageDataUrl], schema);
      const raw = response.choices?.[0]?.message?.content;
      if (typeof raw !== 'string') throw new Error('Model không trả JSON phân tích.');
      return JSON.parse(raw);
    });

    const structures = Array.isArray(parsed.structures)
      ? parsed.structures.map((item: any, index: number) => ({
          id: "surface-" + (index + 1),
          mask: { polygons: validatePolygons(item.polygons), strokes: [] },
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
    return failure(error);
  }
}
