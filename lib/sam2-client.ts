"use client";

import type { MaskStroke, Point } from "./masks";

type ModelPoint = { x: number; y: number; label: 0 | 1 };
type Transform = {
  drawW: number;
  drawH: number;
  padX: number;
  padY: number;
};

type WorkerResponse = {
  id: number;
  ok: boolean;
  data?: any;
  error?: string;
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Không đọc được ảnh cho SAM2."));
    image.src = src;
  });
}

function imageTensor(image: HTMLImageElement) {
  const size = 1024;
  const scale = size / Math.max(image.naturalWidth, image.naturalHeight);
  const drawW = image.naturalWidth * scale;
  const drawH = image.naturalHeight * scale;
  const padX = (size - drawW) / 2;
  const padY = (size - drawH) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Trình duyệt không hỗ trợ Canvas.");
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(image, padX, padY, drawW, drawH);

  const rgba = ctx.getImageData(0, 0, size, size).data;
  const pixels = size * size;
  const tensor = new Float32Array(pixels * 3);
  for (let i = 0; i < pixels; i++) {
    const p = i * 4;
    tensor[i] = rgba[p] / 255;
    tensor[pixels + i] = rgba[p + 1] / 255;
    tensor[pixels * 2 + i] = rgba[p + 2] / 255;
  }

  return {
    tensor,
    shape: [1, 3, size, size],
    transform: { drawW, drawH, padX, padY } satisfies Transform
  };
}

function toModelPoint(point: Point, transform: Transform, label: 0 | 1): ModelPoint {
  return {
    x: transform.padX + (point[0] / 1000) * transform.drawW,
    y: transform.padY + (point[1] / 1000) * transform.drawH,
    label
  };
}

function maskToStrokes(
  logits: Float32Array,
  width: number,
  height: number,
  transform: Transform
): MaskStroke[] {
  const strokes: MaskStroke[] = [];
  const cellW = 1024 / width;
  const cellH = 1024 / height;
  const minX = transform.padX;
  const maxX = transform.padX + transform.drawW;
  const minY = transform.padY;
  const maxY = transform.padY + transform.drawH;
  const radius = Math.max(1, Math.min(8, (cellH * 0.56 / transform.drawH) * 1000));

  const normalizeX = (x: number) =>
    Math.max(0, Math.min(1000, ((x - transform.padX) / transform.drawW) * 1000));
  const normalizeY = (y: number) =>
    Math.max(0, Math.min(1000, ((y - transform.padY) / transform.drawH) * 1000));

  for (let y = 0; y < height; y++) {
    const cy = (y + 0.5) * cellH;
    if (cy < minY || cy > maxY) continue;

    let runStart = -1;
    const flush = (endExclusive: number) => {
      if (runStart < 0) return;
      const startModelX = Math.max(minX, runStart * cellW);
      const endModelX = Math.min(maxX, endExclusive * cellW);
      if (endModelX > startModelX) {
        strokes.push({
          points: [
            [normalizeX(startModelX), normalizeY(cy)],
            [normalizeX(endModelX), normalizeY(cy)]
          ],
          radius,
          erase: false
        });
      }
      runStart = -1;
    };

    for (let x = 0; x <= width; x++) {
      const cx = (x + 0.5) * cellW;
      const insideImage = x < width && cx >= minX && cx <= maxX;
      const foreground = insideImage && logits[y * width + x] > 0;
      if (foreground && runStart < 0) runStart = x;
      if (!foreground) flush(x);
    }
  }

  if (!strokes.length) throw new Error("SAM2 chưa tìm thấy vùng phù hợp. Hãy bấm vào giữa bề mặt cần sơn.");
  return strokes;
}

class Sam2Client {
  private worker: Worker | null = null;
  private requestId = 0;
  private pending = new Map<number, {
    resolve: (data: any) => void;
    reject: (error: Error) => void;
  }>();
  private readyPromise: Promise<any> | null = null;
  private imageKey = "";
  private transform: Transform | null = null;
  private points: ModelPoint[] = [];
  private previousMask: ArrayBuffer | null = null;
  private previousMaskShape: number[] | null = null;

  private ensureWorker() {
    if (this.worker) return this.worker;
    this.worker = new Worker("/sam2-worker.js");
    this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const message = event.data;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.ok) pending.resolve(message.data);
      else pending.reject(new Error(message.error || "SAM2 gặp lỗi."));
    };
    this.worker.onerror = () => {
      const error = new Error("Không khởi động được SAM2 trong trình duyệt.");
      for (const pending of this.pending.values()) pending.reject(error);
      this.pending.clear();
      this.readyPromise = null;
    };
    return this.worker;
  }

  private request(type: string, data?: any, transfer: Transferable[] = []) {
    const worker = this.ensureWorker();
    const id = ++this.requestId;
    return new Promise<any>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      worker.postMessage({ id, type, data }, transfer);
    });
  }

  private ready() {
    if (!this.readyPromise) this.readyPromise = this.request("init");
    return this.readyPromise;
  }

  resetPrompts() {
    this.points = [];
    this.previousMask = null;
    this.previousMaskShape = null;
  }

  async prepare(imageSrc: string) {
    await this.ready();
    if (this.imageKey === imageSrc && this.transform) return;
    const image = await loadImage(imageSrc);
    const prepared = imageTensor(image);
    const buffer = prepared.tensor.buffer;
    await this.request("encode", { buffer, shape: prepared.shape }, [buffer]);
    this.imageKey = imageSrc;
    this.transform = prepared.transform;
    this.resetPrompts();
  }

  async segment(imageSrc: string, point: Point, label: 0 | 1) {
    await this.prepare(imageSrc);
    if (!this.transform) throw new Error("SAM2 chưa sẵn sàng.");

    this.points.push(toModelPoint(point, this.transform, label));

    const previousMask = this.previousMask;
    this.previousMask = null;
    const payload = {
      points: this.points,
      previousMask,
      previousMaskShape: this.previousMaskShape
    };
    const transfer = previousMask ? [previousMask] : [];
    const result = await this.request("decode", payload, transfer);
    const mask = result.mask as ArrayBuffer;
    const width = Number(result.width);
    const height = Number(result.height);

    this.previousMask = mask;
    this.previousMaskShape = [1, 1, height, width];
    return {
      strokes: maskToStrokes(new Float32Array(mask), width, height, this.transform),
      device: String(result.device || "SAM2")
    };
  }
}

let singleton: Sam2Client | null = null;

export function getSam2Client() {
  if (!singleton) singleton = new Sam2Client();
  return singleton;
}
