# EditHouse

EditHouse là web app phối màu sơn và vật liệu trực tiếp trên ảnh công trình thực tế.

## Luồng chính

1. Tải ảnh công trình.
2. Gemini Vision tự nhận diện và liệt kê các cấu kiện có thể sơn: tường, mảng nhấn, chỉ, phào, trần, cột, dầm, chân tường, khung cửa, lan can, mái, kim loại, gỗ...
3. Chọn từng cấu kiện, hệ sơn/vật liệu, màu, mã màu hãng hoặc màu HEX tùy chỉnh.
4. Chọn Nhanh hoặc Pro 2K.
5. Bấm Phối màu AI.
6. So sánh trước/sau bằng thanh kéo và tải ảnh kết quả.

## Hệ vật liệu đã có

- Sơn ngoại thất
- Sơn nội thất
- Sơn chống thấm
- Giả đá granite / marble
- Hiệu ứng bê tông / microcement
- Stucco / Venetian / metallic
- Sơn kim loại
- Sơn gỗ

App có danh sách các hãng phổ biến để gắn catalogue: Dulux, Jotun, Nippon Paint, KOVA, Mykolor, SPEC, Kansai Paint, TOA, Joton, Expo, TNANO và màu tùy chỉnh.

Bộ màu đi kèm repo là bảng màu mô phỏng của EditHouse để app chạy ngay. Mã màu chính thức của từng hãng nên được nhập từ catalogue/CSV chính hãng để tránh sai màu thương mại. Giao diện đã hỗ trợ nhập HEX + mã hãng cho từng bề mặt.

## AI models

Mặc định:

- Nhận diện kết cấu: gemini-3.1-flash-lite
- Render nhanh: gemini-3.1-flash-image
- Render Pro: gemini-3-pro-image

Có thể đổi bằng biến môi trường.

## Chạy local

npm install

Sao chép .env.example thành .env.local, điền GEMINI_API_KEY rồi chạy:

npm run dev

Mở http://localhost:3000

Biến môi trường:

GEMINI_API_KEY=YOUR_GOOGLE_AI_STUDIO_KEY
GEMINI_ANALYZE_MODEL=gemini-3.1-flash-lite
GEMINI_RENDER_MODEL=gemini-3.1-flash-image
GEMINI_RENDER_PRO_MODEL=gemini-3-pro-image

API key chỉ chạy ở server route, không gửi xuống trình duyệt.

## Cấu trúc

- app/page.tsx: editor chính.
- app/api/analyze/route.ts: nhận diện kết cấu công trình.
- app/api/render/route.ts: chỉnh ảnh / phối màu siêu thực.
- lib/catalog.ts: hệ sơn, hiệu ứng, bảng màu.
- lib/gemini.ts: helper Gemini.
- app/globals.css: giao diện editor 4 vùng: rail, sidebar trái, canvas, sidebar phải + bottom bar.

## Mục tiêu chất lượng render

Prompt render khóa kiến trúc và yêu cầu AI giữ nguyên phối cảnh, hình học, cửa, kính, mái, cột, xe, người, ánh sáng và nền; chỉ đổi đúng các bề mặt được chọn. Với công trình khó, dùng Pro 2K và ghi rõ yêu cầu bổ sung ở ô dưới cùng.
