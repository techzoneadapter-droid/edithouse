import { NextResponse } from "next/server";
import { runRole } from "@/lib/ai/provider";
import { splitDataUrl } from "@/lib/image-data";
import { failure, localRequest } from "@/lib/ai/http";
import sharp from "sharp";
import { sampleSwatchColor, type SwatchBox } from "@/lib/catalog/color-sampler";
import { AIError } from "@/lib/ai/experiential-provider";

export const runtime = "nodejs";
export const maxDuration = 90;

export async function POST(request: Request) {
  try {
    localRequest(request);

    const { imageDataUrl } = await request.json();
    const { data } = splitDataUrl(imageDataUrl);
    const sourceBuffer = Buffer.from(data, "base64");

    // Keep a full-quality decoded image for sampling swatch pixels.
    const decoded = await sharp(sourceBuffer, { limitInputPixels: 40000000 })
      .rotate()
      .toColourspace("srgb")
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const pixels = {
      data: decoded.data,
      width: decoded.info.width,
      height: decoded.info.height
    };

    // OCR sees a smaller image. Coordinates remain normalized 0..1000,
    // so sampling can still use the original-resolution image.
    const ocrImage = await sharp(sourceBuffer, { limitInputPixels: 40000000 })
      .rotate()
      .resize({ width: 2200, height: 2200, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 90, chromaSubsampling: "4:4:4" })
      .toBuffer();
    const ocrDataUrl = "data:image/jpeg;base64," + ocrImage.toString("base64");

    const schema = {
      type: "object",
      additionalProperties: false,
      properties: {
        brand: { type: "string" },
        collection: { type: "string" },
        pageTitle: { type: "string" },
        swatches: {
          type: "array",
          maxItems: 1000,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              name: { type: "string" },
              code: { type: "string" },
              confidence: { type: "number", minimum: 0, maximum: 1 },
              box: {
                type: "array",
                minItems: 4,
                maxItems: 4,
                items: { type: "number", minimum: 0, maximum: 1000 }
              }
            },
            required: ["name", "code", "confidence", "box"]
          }
        }
      },
      required: ["brand", "collection", "pageTitle", "swatches"]
    };

    const response = await runRole("CATALOG_OCR", async (ai, m) => {
      const result = await ai.chat(
        m.slug,
        [
          "Bạn đang đọc một trang bảng màu sơn chụp bằng điện thoại.",
          "Chỉ chép chính xác chữ in nhìn thấy: hãng, collection, tiêu đề trang, code và name.",
          "KHÔNG suy diễn, KHÔNG tự sửa format mã, KHÔNG thêm prefix/suffix.",
          "Giữ nguyên chữ, số, dấu /, dấu -, khoảng trắng trong mã.",
          "Không thấy name thì name rỗng; không đọc được code thì code rỗng và confidence thấp.",
          "Không chắc hãng thì brand rỗng; không tự đặt hãng.",
          "box là [left, top, width, height] theo hệ tọa độ CHUẨN HÓA 0..1000 của toàn ảnh.",
          "Box phải nằm BÊN TRONG phần màu của từng swatch, tránh chữ code, nền giấy, viền và vùng phản sáng nếu có thể.",
          "Không trả RGB/HEX; phần mềm sẽ tự lấy pixel từ ảnh gốc.",
          "Bỏ qua ảnh minh họa nội thất/nhà và mọi ô không phải swatch màu.",
          "Trả JSON đúng schema, không markdown."
        ].join("\n"),
        [ocrDataUrl],
        schema,
        6000
      );

      if (result.choices?.[0]?.finish_reason === "length") {
        throw new Error("Ảnh có quá nhiều ô màu; hãy chia thành nhiều ảnh nhỏ rồi nhập lại.");
      }

      const raw = result.choices?.[0]?.message?.content;
      if (typeof raw !== "string") {
        throw new AIError("OCR không trả JSON.", 502, "malformed_ocr_output");
      }

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed.swatches)) {
        throw new AIError("OCR không trả danh sách swatch hợp lệ.", 502, "malformed_ocr_output");
      }

      if (
        parsed.swatches.some(
          (s: any) =>
            !Array.isArray(s.box) ||
            s.box.length !== 4 ||
            s.box.some((v: any) => typeof v !== "number" || !Number.isFinite(v) || v < 0) ||
            s.box[2] <= 0 ||
            s.box[3] <= 0 ||
            s.box[0] + s.box[2] > 1000.5 ||
            s.box[1] + s.box[3] > 1000.5
        )
      ) {
        throw new AIError(
          "Model OCR trả tọa độ ô màu không hợp lệ.",
          502,
          "ocr_geometry_error"
        );
      }

      return parsed;
    });

    const parsed = response.result;
    const swatches = parsed.swatches.slice(0, 1000).map((swatch: any) => {
      const base = {
        code: typeof swatch.code === "string" ? swatch.code.trim() : "",
        name: typeof swatch.name === "string" ? swatch.name.trim() : "",
        box: swatch.box as SwatchBox,
        confidence: Math.max(0, Math.min(1, Number(swatch.confidence) || 0))
      };

      try {
        return {
          ...base,
          ...sampleSwatchColor(pixels, base.box),
          samplingError: null
        };
      } catch (e) {
        return {
          ...base,
          hex: "",
          rgb: null,
          samplingError: e instanceof Error ? e.message : "Không lấy được pixel."
        };
      }
    });

    return NextResponse.json({
      brand: typeof parsed.brand === "string" ? parsed.brand.trim() : "",
      collection: typeof parsed.collection === "string" ? parsed.collection.trim() : "",
      pageTitle: typeof parsed.pageTitle === "string" ? parsed.pageTitle.trim() : "",
      swatches,
      model: response.model
    });
  } catch (e) {
    return failure(e);
  }
}
