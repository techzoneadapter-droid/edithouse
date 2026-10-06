import { validatePolygons, type Point } from "@/lib/masks";
import {
  ARCHITECTURE_PARTS,
  ARCHITECTURE_REASONING_RULES,
  NON_BUILDING_OCCLUDERS,
  architectureTaxonomyForPrompt,
  type ArchitecturePartDefinition
} from "@/lib/architecture-knowledge";
import { NextRequest, NextResponse } from "next/server";
import { splitDataUrl } from "@/lib/image-data";
import { runRole } from "@/lib/ai/provider";
import { failure, localRequest } from "@/lib/ai/http";

export const runtime = "nodejs";
export const maxDuration = 75;

const partKeys = ARCHITECTURE_PARTS.map(part => part.key);
const exclusionKeys = NON_BUILDING_OCCLUDERS.map(item => item.key);

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    buildingType: { type: "string" },
    summary: { type: "string" },
    parts: {
      type: "array",
      maxItems: 36,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          partKey: { type: "string", enum: partKeys },
          plane: { type: "string" },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          polygons: {
            type: "array",
            maxItems: 40,
            items: {
              type: "array",
              minItems: 3,
              maxItems: 400,
              items: {
                type: "array",
                minItems: 2,
                maxItems: 2,
                items: { type: "number", minimum: 0, maximum: 1000 }
              }
            }
          }
        },
        required: ["partKey", "plane", "confidence", "polygons"]
      }
    },
    excludedRegions: {
      type: "array",
      maxItems: 50,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          category: { type: "string", enum: exclusionKeys },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          polygons: {
            type: "array",
            maxItems: 30,
            items: {
              type: "array",
              minItems: 3,
              maxItems: 300,
              items: {
                type: "array",
                minItems: 2,
                maxItems: 2,
                items: { type: "number", minimum: 0, maximum: 1000 }
              }
            }
          }
        },
        required: ["category", "confidence", "polygons"]
      }
    }
  },
  required: ["buildingType", "summary", "parts", "excludedRegions"]
};

function polygonArea(polygon: Point[]) {
  let area = 0;
  for (let i = 0; i < polygon.length; i++) {
    const [x1, y1] = polygon[i];
    const [x2, y2] = polygon[(i + 1) % polygon.length];
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area) / 2;
}

function polygonsAreaRatio(polygons: Point[][]) {
  return polygons.reduce((sum, polygon) => sum + polygonArea(polygon), 0) / 1_000_000;
}

function cleanText(value: unknown, fallback: string, maxLength = 160) {
  const text = String(value || "")
    .replace(/[\u0000-\u001f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return fallback;
  if (/[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af\u0400-\u04ff]/u.test(text)) return fallback;
  return text.slice(0, maxLength);
}

function occlusionRank(definition: ArchitecturePartDefinition) {
  if (!definition.paintable) return 120;
  switch (definition.family) {
    case "opening": return 110;
    case "trim": return 100;
    case "cladding": return 95;
    case "balcony": return 90;
    case "boundary": return 85;
    case "structure": return 80;
    case "roof": return 75;
    case "service": return 70;
    case "other": return 65;
    case "envelope": return 20;
    default: return 10;
  }
}

export async function POST(request: NextRequest) {
  try {
    localRequest(request);
    const { imageDataUrl } = await request.json();
    if (!imageDataUrl || typeof imageDataUrl !== "string") {
      return NextResponse.json({ error: "Chưa có ảnh công trình." }, { status: 400 });
    }
    splitDataUrl(imageDataUrl);

    const prompt = [
      "Bạn là hệ thống đọc ảnh kiến trúc cho một trình chỉnh màu công trình kiểu Photoshop.",
      "Không tạo ảnh. Không thiết kế lại. Nhiệm vụ duy nhất là phân rã ngôi nhà thành các vùng chọn/layer hình học chính xác.",
      "",
      "CÁCH SUY LUẬN NHƯ KIẾN TRÚC SƯ 3D:",
      "- Đầu tiên xác định khối nhà, các mặt phẳng theo phối cảnh, hướng mặt tiền/mặt hông, độ lồi lõm và quan hệ che khuất.",
      "- Sau đó nhận diện envelope, kết cấu, ô mở, lớp ốp, mái, ban công, chi tiết trang trí và ranh giới khu đất.",
      "- Xem cửa/cửa sổ/kính là opening cắt vào tường; không tô tường xuyên qua opening.",
      "- Nhìn ánh sáng, bóng đổ và vết bẩn như thuộc tính bề mặt, KHÔNG coi chúng là cấu kiện.",
      "- Một layer có thể chứa nhiều polygon rời nhau nếu chúng là cùng một hệ chi tiết và thường được đổi cùng màu.",
      "- Nếu hai mặt phẳng khác hướng phối cảnh hoặc khác vật liệu rõ ràng, phải tách thành layer khác.",
      "",
      "KIẾN THỨC HÌNH HỌC/XÂY DỰNG:",
      ...ARCHITECTURE_REASONING_RULES.map(rule => "- " + rule),
      "",
      "TAXONOMY CẤU KIỆN ĐƯỢC PHÉP:",
      architectureTaxonomyForPrompt(),
      "",
      "VẬT THỂ PHẢI LOẠI KHỎI MỌI VÙNG SƠN:",
      NON_BUILDING_OCCLUDERS.map(item => `- ${item.key}: ${item.label} (${item.cues.join(", ")})`).join("\n"),
      "- Kính cũng là vùng không sơn: vẫn có thể nhận diện glass trong parts để làm mask loại trừ.",
      "",
      "QUY TẮC LAYER:",
      "- Chỉ trả các phần nhìn thấy đủ để người dùng có thể chỉnh màu; tránh chi tiết cực nhỏ vô nghĩa.",
      "- Mục tiêu khoảng 6-20 layer cho một căn nhà thông thường; công trình phức tạp có thể nhiều hơn nhưng tối đa 36.",
      "- Tên layer KHÔNG được tự sáng tác: chỉ trả partKey; phần mềm sẽ tự đặt tên tiếng Việt.",
      "- plane mô tả rất ngắn vị trí/mặt phẳng bằng tiếng Việt như 'mặt tiền', 'hông phải', 'tầng 2', 'cụm cửa chính'.",
      "- Các cửa sổ cùng hệ khung có thể gộp thành một layer với nhiều polygon.",
      "- Các cột cùng hệ có thể gộp nếu chắc chắn cùng vật liệu/màu; nếu khác mặt phẳng hoặc kiểu hoàn thiện thì tách.",
      "",
      "QUY TẮC MASK:",
      "- polygon [x,y] dùng tọa độ 0..1000 theo toàn ảnh.",
      "- Bám sát biên nhìn thấy. Không dùng một hộp chữ nhật lớn thay cho biên thật.",
      "- Không lấn vào người, xe, cây, động vật, thiết bị, kính, bầu trời, sân/đường hoặc vật che.",
      "- Khi vật cản che trước bề mặt, vẫn nhận diện bề mặt phía sau nhưng excludedRegions phải chứa vật cản để phần mềm tự khoét nó khỏi mask.",
      "- Nếu ranh giới không chắc, mask bảo thủ nhỏ hơn một chút tốt hơn là lấn sang cấu kiện khác.",
      "- excludedRegions phải liệt kê các vật thể không thuộc bề mặt công trình đang che ảnh.",
      "",
      "Trả JSON đúng schema, không markdown, không giải thích."
    ].join("\n");

    const { result: parsed } = await runRole("VISION_ANALYZE", async (ai, model) => {
      const response = await ai.chat(model.slug, prompt, [imageDataUrl], schema, 7000);
      const raw = response.choices?.[0]?.message?.content;
      if (typeof raw !== "string") throw new Error("Model không trả dữ liệu phân vùng.");
      return JSON.parse(raw);
    });

    const recognized = (Array.isArray(parsed.parts) ? parsed.parts : [])
      .map((item: any) => {
        const definition = ARCHITECTURE_PARTS.find(part => part.key === item.partKey);
        if (!definition) return null;
        const polygons = validatePolygons(item.polygons);
        if (!polygons.length) return null;
        const areaRatio = polygonsAreaRatio(polygons);
        const threshold = definition.minAreaRatio ?? 0.0004;
        if (areaRatio < threshold) return null;
        return {
          definition,
          polygons,
          plane: cleanText(item.plane, "", 42),
          confidence: Math.max(0, Math.min(1, Number(item.confidence ?? 0.6))),
          areaRatio
        };
      })
      .filter(Boolean) as Array<{
        definition: ArchitecturePartDefinition;
        polygons: Point[][];
        plane: string;
        confidence: number;
        areaRatio: number;
      }>;

    const globalExclusions = (Array.isArray(parsed.excludedRegions) ? parsed.excludedRegions : [])
      .flatMap((item: any) => validatePolygons(item.polygons));

    const nonPaintablePolygons = recognized
      .filter(item => !item.definition.paintable)
      .flatMap(item => item.polygons);

    const paintable = recognized
      .filter(item => item.definition.paintable)
      .sort((a, b) => b.definition.priority - a.definition.priority || b.areaRatio - a.areaRatio);

    const keyCounts = new Map<string, number>();
    for (const item of paintable) {
      keyCounts.set(item.definition.key, (keyCounts.get(item.definition.key) || 0) + 1);
    }
    const seen = new Map<string, number>();

    const structures = paintable.slice(0, 30).map((item, index) => {
      const count = (seen.get(item.definition.key) || 0) + 1;
      seen.set(item.definition.key, count);
      const total = keyCounts.get(item.definition.key) || 1;
      const suffix = item.plane
        ? " · " + item.plane
        : total > 1
          ? " " + count
          : "";

      const rank = occlusionRank(item.definition);
      const higherPriorityParts = recognized
        .filter(other => other !== item && occlusionRank(other.definition) > rank)
        .flatMap(other => other.polygons);

      return {
        id: "surface-" + (index + 1),
        partKey: item.definition.key,
        family: item.definition.family,
        mask: {
          polygons: item.polygons,
          excludePolygons: [
            ...globalExclusions,
            ...nonPaintablePolygons,
            ...higherPriorityParts
          ],
          strokes: []
        },
        name: item.definition.label + suffix,
        type: item.definition.family,
        description: `Vùng chọn ${item.definition.label.toLowerCase()}${item.plane ? " ở " + item.plane : ""}.`,
        recommendedMaterials: item.definition.materials,
        confidence: item.confidence
      };
    });

    if (!structures.length) {
      throw new Error("Chưa tách được bề mặt công trình đủ tin cậy. Hãy thử ảnh rõ mặt tiền hơn.");
    }

    return NextResponse.json({
      buildingType: cleanText(parsed.buildingType, "Công trình", 60),
      summary: cleanText(
        parsed.summary,
        `Đã tạo ${structures.length} vùng chọn kiến trúc và tự loại vật thể không thuộc công trình.`,
        180
      ),
      structures
    });
  } catch (error) {
    return failure(error);
  }
}
