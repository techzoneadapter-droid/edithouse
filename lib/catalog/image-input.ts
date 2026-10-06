export async function readCatalogImage(file: File): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Chỉ nhận ảnh JPG, PNG hoặc WEBP.");
  }
  if (file.size > 25 * 1024 * 1024) {
    throw new Error("Ảnh bảng màu tối đa 25 MB.");
  }

  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    // Catalogue OCR does not need a 4K PNG. Large PNG data URLs make local/API
    // requests unnecessarily slow and can make a single page appear to hang.
    // 3000px JPEG keeps printed paint codes legible while cutting payload size heavily.
    const maxSide = 3000;
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));

    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Không đọc được ảnh trong trình duyệt.");

    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const data = canvas.toDataURL("image/jpeg", 0.94);
    if (data.length > 12_000_000) {
      throw new Error("Ảnh vẫn quá lớn sau tối ưu; hãy chụp gần hơn hoặc chia trang.");
    }
    return data;
  } finally {
    bitmap.close();
  }
}
