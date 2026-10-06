import { validatePolygons } from "@/lib/masks";
import { NextRequest, NextResponse } from "next/server";
import { splitDataUrl } from "@/lib/image-data";
import { runRole } from "@/lib/ai/provider";
import { failure, localRequest } from "@/lib/ai/http";

export const runtime = "nodejs";
export const maxDuration = 60;

const ROLE_NAMES = {
  "main-wall": "Tường chính",
  "secondary-wall": "Tường phụ",
  "accent-wall": "Mảng nhấn",
  "trim-molding": "Phào / chỉ",
  "column-beam": "Cột / dầm",
  "plinth": "Chân tường",
  "frames": "Khung cửa",
  "roof-canopy": "Mái / mái che",
  "metal-railing": "Kim loại / lan can",
  "fence-gate": "Tường rào / cổng",
  "other": "Vùng khác"
} as const;

type SurfaceRole = keyof typeof ROLE_NAMES;

const ROLE_TYPE: Record<SurfaceRole, string> = {
  "main-wall": "wall",
  "secondary-wall": "wall",
  "accent-wall": "wall",
  "trim-molding": "molding",
  "column-beam": "column",
  "plinth": "plinth",
  "frames": "window-frame",
  "roof-canopy": "roof",
  "metal-railing": "metal",
  "fence-gate": "fence",
  "other": "other"
};

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    buildingType: { type: "string" },
    summary: { type: "string" },
    structures: {
      type: "array",
      minItems: 1,
      maxItems: 16,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          role: {
            type: "string",
            enum: Object.keys(ROLE_NAMES)
          },
          description: { type: "string" },
          recommendedMaterials: {
            type: "array",
            items: {
              type: "string",
              enum: ["exterior", "interior", "waterproof", "stone", "concrete", "stucco", "metal", "wood"]
            }
          },
          polygons: {
            type: "array",
            items: {
              type: "array",
              minItems: 3,
              items: {
                type: "array",
                minItems: 2,
                maxItems: 2,
                items: { type: "number", minimum: 0, maximum: 1000 }
              }
            }
          },
          confidence: { type: "number", minimum: 0, maximum: 1 }
        },
        required: ["role", "description", "recommendedMaterials", "confidence", "polygons"]
      }
    }
  },
  required: ["buildingType", "summary", "structures"]
};

function cleanVietnameseText(value: unknown, fallback: string, max = 110) {
  const raw = String(value || "")
    .replace(/[\u0000-\u001f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!raw) return fallback;
  // Reject obvious OCR/model garbage: long symbol runs, CJK/Korean/Cyrillic, code fragments.
  if (/[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af\u0400-\u04ff]/u.test(raw)) return fallback;
  if ((raw.match(/[{}<>\\|_=]/g) || []).length >= 2) return fallback;
  return raw.slice(0, max);
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
      "Bạn là kiến trúc sư chuyên phối màu sơn công trình thực tế.",
      "Mục tiêu KHÔNG phải bóc tách mọi vật thể. Mục tiêu là tạo một danh sách NGẮN, dễ dùng cho người thợ sơn.",
      "",
      "NGUYÊN TẮC BẮT BUỘC:",
      "- Chỉ nhận diện những VÙNG LỚN, THỰC SỰ CẦN CHỌN MÀU/VẬT LIỆU.",
      "- Mục tiêu 4-8 nhóm. Tuyệt đối không vượt quá 10 nhóm có ý nghĩa.",
      "- Các mảng rời nhau nhưng cùng vai trò và cùng cách sơn phải GỘP chung một role, dùng nhiều polygon trong cùng item.",
      "- KHÔNG tách từng tầng, từng ô cửa, từng vết bẩn, khe nứt, mảng bê tông loang hay vật thể nhỏ thành một cấu kiện riêng.",
      "- KHÔNG đọc hoặc chép chữ/biển hiệu/OCR trong ảnh vào tên hay mô tả.",
      "- KHÔNG sử dụng tiếng Anh, tiếng Trung, tiếng Hàn hoặc chuỗi ký tự lạ trong description. Viết tiếng Việt ngắn gọn.",
      "- Bỏ qua người, xe, cây, nền sân, bầu trời, máy lạnh, ống nhỏ, dây điện và vật che.",
      "",
      "ROLE ĐƯỢC PHÉP:",
      "- main-wall: diện tường mặt tiền/chính lớn nhất.",
      "- secondary-wall: tường hông hoặc mảng tường phụ khác vai trò.",
      "- accent-wall: mảng kiến trúc dùng để tạo điểm nhấn màu.",
      "- trim-molding: phào, chỉ, đường viền kiến trúc đáng sơn riêng.",
      "- column-beam: cột/dầm nổi đáng sơn riêng.",
      "- plinth: chân tường, đế công trình.",
      "- frames: khung cửa/cửa đi nếu thực sự cần phối màu.",
      "- roof-canopy: mái, diềm mái, mái che.",
      "- metal-railing: lan can hoặc kết cấu kim loại lớn.",
      "- fence-gate: tường rào/cổng.",
      "- other: chỉ dùng khi thật sự không thuộc nhóm trên.",
      "",
      "MASK:",
      "- polygons là biên vùng sơn, tọa độ [x,y] chuẩn hóa 0..1000.",
      "- Loại trừ cửa kính, người, xe, cây và vùng không được sơn.",
      "- Một role có thể chứa nhiều polygon rời nhau.",
      "- Không chắc biên thì để polygons rỗng để người dùng dùng SAM2/Brush chỉnh sau; KHÔNG bịa bounding box thô.",
      "",
      "buildingType và summary phải là tiếng Việt ngắn gọn.",
      "Trả đúng JSON schema, không markdown."
    ].join("\n");

    const { result: parsed } = await runRole("VISION_ANALYZE", async (ai, model) => {
      const response = await ai.chat(model.slug, prompt, [imageDataUrl], schema, 5000);
      const raw = response.choices?.[0]?.message?.content;
      if (typeof raw !== "string") throw new Error("Model không trả JSON phân tích.");
      return JSON.parse(raw);
    });

    const grouped = new Map<SurfaceRole, {
      role: SurfaceRole;
      polygons: ReturnType<typeof validatePolygons>;
      descriptions: string[];
      materials: Set<string>;
      confidence: number;
      count: number;
    }>();

    for (const item of Array.isArray(parsed.structures) ? parsed.structures : []) {
      const role = Object.prototype.hasOwnProperty.call(ROLE_NAMES, item.role)
        ? (item.role as SurfaceRole)
        : "other";
      const polygons = validatePolygons(item.polygons);
      const current = grouped.get(role) || {
        role,
        polygons: [],
        descriptions: [],
        materials: new Set<string>(),
        confidence: 0,
        count: 0
      };

      current.polygons.push(...polygons);
      const description = cleanVietnameseText(item.description, "");
      if (description && !current.descriptions.includes(description)) current.descriptions.push(description);
      for (const material of Array.isArray(item.recommendedMaterials) ? item.recommendedMaterials : []) {
        if (["exterior","interior","waterproof","stone","concrete","stucco","metal","wood"].includes(String(material))) {
          current.materials.add(String(material));
        }
      }
      current.confidence += Math.max(0, Math.min(1, Number(item.confidence ?? 0.6)));
      current.count += 1;
      grouped.set(role, current);
    }

    const order: SurfaceRole[] = [
      "main-wall","secondary-wall","accent-wall","trim-molding","column-beam",
      "plinth","frames","roof-canopy","metal-railing","fence-gate","other"
    ];

    const structures = order
      .filter(role => grouped.has(role))
      .map((role, index) => {
        const group = grouped.get(role)!;
        const defaultMaterial = role === "metal-railing" ? "metal" : "exterior";
        return {
          id: "surface-" + (index + 1),
          mask: { polygons: group.polygons, strokes: [] },
          name: ROLE_NAMES[role],
          type: ROLE_TYPE[role],
          description: cleanVietnameseText(
            group.descriptions[0],
            role === "main-wall" ? "Mảng tường lớn dùng làm màu nền chính." : "Nhóm bề mặt cùng vai trò để phối màu."
          ),
          recommendedMaterials: group.materials.size ? [...group.materials] : [defaultMaterial],
          confidence: group.count ? group.confidence / group.count : 0.6
        };
      })
      .slice(0, 10);

    return NextResponse.json({
      buildingType: cleanVietnameseText(parsed.buildingType, "Công trình", 50),
      summary: cleanVietnameseText(
        parsed.summary,
        "Đã gộp các bề mặt theo nhóm thực tế để phối màu dễ hơn.",
        150
      ),
      structures
    });
  } catch (error) {
    return failure(error);
  }
}
