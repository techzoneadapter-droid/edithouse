import sharp from "sharp";
import { splitDataUrl } from "./image-data";

export type PaintRecolorAssignment = {
  maskDataUrl: string;
  hex: string;
  finish?: string;
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) throw new Error("Màu HEX không hợp lệ.");
  return [
    parseInt(normalized.slice(0, 2), 16),
    parseInt(normalized.slice(2, 4), 16),
    parseInt(normalized.slice(4, 6), 16)
  ];
}

function srgbToLinear(v: number) {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function linearToSrgb(v: number) {
  const c = clamp01(v);
  const s = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return Math.round(clamp01(s) * 255);
}

function rgbToOklab(r8: number, g8: number, b8: number): [number, number, number] {
  const r = srgbToLinear(r8), g = srgbToLinear(g8), b = srgbToLinear(b8);
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const l3 = Math.cbrt(Math.max(0, l)), m3 = Math.cbrt(Math.max(0, m)), s3 = Math.cbrt(Math.max(0, s));
  return [
    0.2104542553 * l3 + 0.793617785 * m3 - 0.0040720468 * s3,
    1.9779984951 * l3 - 2.428592205 * m3 + 0.4505937099 * s3,
    0.0259040371 * l3 + 0.7827717662 * m3 - 0.808675766 * s3
  ];
}

function oklabToRgb(L: number, a: number, b: number): [number, number, number] {
  const l3 = L + 0.3963377774 * a + 0.2158037573 * b;
  const m3 = L - 0.1055613458 * a - 0.0638541728 * b;
  const s3 = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l3 * l3 * l3, m = m3 * m3 * m3, s = s3 * s3 * s3;
  return [
    linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)
  ];
}

function finishProfile(finish = "") {
  const value = finish.toLocaleLowerCase("vi");
  if (value.includes("bóng")) return { contrast: 1.02, chroma: 0.98 };
  if (value.includes("satin")) return { contrast: 0.96, chroma: 1 };
  if (value.includes("mờ")) return { contrast: 0.88, chroma: 0.98 };
  return { contrast: 0.93, chroma: 1 };
}

async function maskAlpha(maskDataUrl: string, width: number, height: number) {
  const { data, mimeType } = splitDataUrl(maskDataUrl);
  if (mimeType !== "image/png") throw new Error("Mask phải là PNG.");
  const alpha = await sharp(Buffer.from(data, "base64"), { limitInputPixels: 25000000 })
    .resize(width, height, { fit: "fill" })
    .ensureAlpha()
    .extractChannel(3)
    .blur(0.7)
    .raw()
    .toBuffer();
  if (!alpha.some(v => v > 8)) throw new Error("Mask trống.");
  return alpha;
}

export async function recolorPaintSurfaces(original: Buffer, assignments: PaintRecolorAssignment[]) {
  const source = await sharp(original, { limitInputPixels: 25000000 })
    .toColourspace("srgb")
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = source.info;
  const base = Buffer.from(source.data);
  const output = Buffer.from(source.data);

  for (const assignment of assignments) {
    const alpha = await maskAlpha(assignment.maskDataUrl, width, height);
    const [tr, tg, tb] = hexToRgb(assignment.hex);
    const [targetL, targetA, targetB] = rgbToOklab(tr, tg, tb);
    const profile = finishProfile(assignment.finish);

    let weight = 0, sumL = 0, sumL2 = 0;
    for (let i = 0; i < width * height; i++) {
      const w = alpha[i] / 255;
      if (w < 0.08) continue;
      const o = i * 4;
      const [L] = rgbToOklab(base[o], base[o + 1], base[o + 2]);
      weight += w;
      sumL += L * w;
      sumL2 += L * L * w;
    }
    if (weight < 1) throw new Error("Mask trống.");

    const meanL = sumL / weight;
    const variance = Math.max(0, sumL2 / weight - meanL * meanL);
    const sigma = Math.sqrt(variance);

    for (let i = 0; i < width * height; i++) {
      const mask = alpha[i] / 255;
      if (mask <= 0.002) continue;
      const o = i * 4;
      const [srcL] = rgbToOklab(base[o], base[o + 1], base[o + 2]);

      const deviation = Math.max(-2.25 * sigma, Math.min(2.25 * sigma, srcL - meanL));
      const mappedL = clamp01(targetL + deviation * profile.contrast);

      const highlight = clamp01((srcL - meanL - 0.08) / 0.3);
      const shadow = clamp01((meanL - srcL - 0.2) / 0.35);
      const localChroma = profile.chroma * (1 - 0.35 * highlight - 0.12 * shadow);
      const [nr, ng, nb] = oklabToRgb(mappedL, targetA * localChroma, targetB * localChroma);

      output[o] = Math.round(output[o] * (1 - mask) + nr * mask);
      output[o + 1] = Math.round(output[o + 1] * (1 - mask) + ng * mask);
      output[o + 2] = Math.round(output[o + 2] * (1 - mask) + nb * mask);
    }
  }

  return sharp(output, { raw: { width, height, channels: 4 } }).png().toBuffer();
}
