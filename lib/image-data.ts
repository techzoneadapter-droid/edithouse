export function splitDataUrl(dataUrl: string) {
  if (typeof dataUrl !== 'string' || dataUrl.length > 35000000) throw new Error('Ảnh quá lớn hoặc không hợp lệ.');
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) throw new Error("Ảnh đầu vào không hợp lệ.");
  if (!['image/png','image/jpeg','image/webp'].includes(match[1])) throw new Error('Chỉ hỗ trợ PNG, JPEG và WEBP.');
  return { mimeType: match[1], data: match[2] };
}
