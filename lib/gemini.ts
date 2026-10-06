import { GoogleGenAI } from "@google/genai";

export function getGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Thiếu GEMINI_API_KEY. Hãy thêm key vào .env.local.");
  }
  return new GoogleGenAI({ apiKey });
}

export function splitDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) throw new Error("Ảnh đầu vào không hợp lệ.");
  return { mimeType: match[1], data: match[2] };
}

function walkForText(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = walkForText(item);
      if (found) return found;
    }
    return null;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj.output_text === "string") return obj.output_text;
    if (obj.type === "text" && typeof obj.text === "string") return obj.text;
    for (const key of ["output", "steps", "content", "parts", "result"]) {
      if (key in obj) {
        const found = walkForText(obj[key]);
        if (found) return found;
      }
    }
  }
  return null;
}

function walkForImage(value: unknown): { data: string; mimeType: string } | null {
  if (!value) return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = walkForImage(item);
      if (found) return found;
    }
    return null;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const direct = obj.output_image as Record<string, unknown> | undefined;
    if (direct && typeof direct.data === "string") {
      return {
        data: direct.data,
        mimeType: typeof direct.mime_type === "string" ? direct.mime_type : "image/jpeg"
      };
    }
    if (obj.type === "image" && typeof obj.data === "string") {
      return {
        data: obj.data,
        mimeType: typeof obj.mime_type === "string" ? obj.mime_type : "image/jpeg"
      };
    }
    for (const key of ["output", "steps", "content", "parts", "result"]) {
      if (key in obj) {
        const found = walkForImage(obj[key]);
        if (found) return found;
      }
    }
  }
  return null;
}

export function extractText(interaction: unknown) {
  const text = walkForText(interaction);
  if (!text) throw new Error("Gemini không trả về nội dung phân tích.");
  return text.replace(/^\s*```(?:json)?/i, "").replace(/```\s*$/i, "").trim();
}

export function extractImage(interaction: unknown) {
  const image = walkForImage(interaction);
  if (!image) throw new Error("Gemini không trả về ảnh kết quả.");
  return image;
}
