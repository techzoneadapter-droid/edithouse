import { NextResponse } from "next/server";
import { runArchitectureRefine } from "@/lib/ai/architecture-provider";
import { splitDataUrl } from "@/lib/image-data";
import { validatePolygons } from "@/lib/masks";
import {
  ARCHITECTURE_PARTS,
  ARCHITECTURE_REASONING_RULES,
  NON_BUILDING_OCCLUDERS
} from "@/lib/architecture-knowledge";
import { failure, localRequest } from "@/lib/ai/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    localRequest(request);
    const { imageDataUrl, surface } = await request.json();
    splitDataUrl(imageDataUrl);

    const surfaceName=String(surface||"bề mặt kiến trúc");
    const matching=ARCHITECTURE_PARTS.find(part=>
      surfaceName.toLocaleLowerCase("vi").includes(part.label.toLocaleLowerCase("vi"))
    );

    const schema = {
      type:"object",
      properties:{
        polygons:{
          type:"array",
          maxItems:40,
          items:{
            type:"array",
            minItems:3,
            maxItems:500,
            items:{
              type:"array",
              minItems:2,
              maxItems:2,
              items:{type:"number",minimum:0,maximum:1000}
            }
          }
        }
      },
      required:["polygons"],
      additionalProperties:false
    };

    const prompt=[
      `Tinh chỉnh vùng chọn cho layer kiến trúc: ${surfaceName}.`,
      "Đây là thao tác refine selection trong một trình chỉnh ảnh công trình, không phải tạo ảnh.",
      matching ? `Định nghĩa: ${matching.label}; dấu hiệu: ${matching.cues.join(", ")}; quan hệ: ${matching.relations.join(", ")}.` : "",
      "",
      "Suy luận hình học như kiến trúc sư:",
      ...ARCHITECTURE_REASONING_RULES.map(rule=>"- "+rule),
      "",
      "Bắt buộc:",
      "- Tọa độ polygon chuẩn hóa 0..1000.",
      "- Bám sát biên thật của cấu kiện, theo phối cảnh và mặt phẳng 3D.",
      "- Không dùng bounding box lớn thay cho biên cấu kiện.",
      "- Không lấy vết bẩn, bóng, mảng vá, chữ trên ảnh thành một phần cấu kiện.",
      "- Trừ toàn bộ opening/vật thể nằm phía trước nếu chúng không thuộc layer này.",
      "- Loại khỏi vùng chọn: "+NON_BUILDING_OCCLUDERS.map(x=>x.label).join(", ")+".",
      "- Kính phải loại khỏi layer tường/khung cần sơn nếu kính không phải chính layer đang chọn.",
      "- Nếu layer có nhiều phần rời nhau cùng hệ, trả nhiều polygon.",
      "- Nếu không đủ chắc chắn, trả mask bảo thủ thay vì lấn sang cấu kiện khác.",
      "Trả JSON đúng schema."
    ].filter(Boolean).join("\n");

    const response=await runArchitectureRefine(prompt,imageDataUrl,schema,5000);
    const raw=response.response.choices?.[0]?.message?.content;
    if(typeof raw!=="string")throw new Error("Bộ tách vùng không trả dữ liệu.");
    const polygons=validatePolygons(JSON.parse(raw).polygons);

    return NextResponse.json({
      polygons,
      model:response.model,
      engine:response.provider==="openai"?"ChatGPT / OpenAI":"Experiential Labs"
    });
  }catch(e){
    return failure(e);
  }
}
