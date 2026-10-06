export type Point = [number, number];
export type MaskStroke = { points: Point[]; radius: number; erase: boolean };
export type SurfaceMask = { polygons: Point[][]; strokes: MaskStroke[] };

export function validatePolygons(value: unknown): Point[][] {
  if (!Array.isArray(value)) return [];
  return value.filter((polygon) => Array.isArray(polygon) && polygon.length >= 3 && polygon.length <= 2000 && polygon.every((p) => Array.isArray(p) && p.length === 2 && p.every((n) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1000))) as Point[][];
}

// All geometry uses image coordinates normalized to 0..1000, independent of zoom.
export function drawMask(ctx: CanvasRenderingContext2D, mask: SurfaceMask, width: number, height: number) {
  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.scale(width / 1000, height / 1000);
  ctx.fillStyle = 'white';
  ctx.beginPath();
  for (const polygon of mask.polygons) {
    polygon.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.closePath();
  }
  ctx.fill('evenodd');
  for (const stroke of mask.strokes) {
    ctx.globalCompositeOperation = stroke.erase ? 'destination-out' : 'source-over';
    ctx.strokeStyle = 'white';
    ctx.lineWidth = stroke.radius * 2;
    ctx.lineCap = ctx.lineJoin = 'round';
    ctx.beginPath();
    stroke.points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.stroke();
    for (const [x, y] of stroke.points) { ctx.beginPath(); ctx.arc(x, y, stroke.radius, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.restore();
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error('Không đọc được ảnh.')); img.src = src; });
}

export async function rasterizeMask(mask: SurfaceMask, image: string) {
  const img = await loadImage(image);
  const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height;
  drawMask(canvas.getContext('2d')!, mask, canvas.width, canvas.height);
  const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
  if (!pixels.some((v, i) => i % 4 === 3 && v > 0)) throw new Error('Vùng sơn trống. Hãy dùng Brush để xác định vùng.');
  return canvas.toDataURL('image/png');
}
