# EditHouse

## Editor vùng sơn

- Mỗi cấu kiện có mask gồm đường biên AI và nét Brush/Eraser riêng. Click/hover tên cấu kiện để xem vùng; bật/tắt overlay, zoom, pan, Undo/Redo mask.
- AI chỉ đề xuất đường biên. Kiểm tra và sửa mask trước khi bật bề mặt cần sơn. Có thể thêm vùng thủ công khi chưa cấu hình AI.
- Render gửi ảnh gốc và mask từng bề mặt. Server kiểm tra mask trước khi gọi AI, sau đó ghép kết quả trong hợp mask và xuất PNG. Pixel ngoài mask giữ nguyên so với ảnh đầu vào đã được tối ưu ở trình duyệt (cạnh dài tối đa 2200px). AI vẫn cần được kiểm tra về texture và hình học bên trong vùng chọn.
- Mỗi bề mặt có màu, hệ sơn và hiệu ứng riêng. Một lần render áp dụng tất cả bề mặt đang bật.
- Dự án hiện tại tự lưu trong IndexedDB: ảnh, cấu kiện, mask, lựa chọn, lịch sử mask, catalogue và phương án. Mỗi render thành công tạo một phiên bản. Có lưu/nhân bản/đổi tên/xóa/mở phương án, so sánh hai phương án đã render và trước/sau ảnh gốc. Dữ liệu gắn với trình duyệt và origin; chưa đồng bộ cloud.

## Nhập catalogue

Nhập CSV UTF-8 hoặc XLSX (worksheet đầu), tối đa 25 MB / 100.000 màu. Các cột:

```csv
brand,collection,color_name,color_code,hex,rgb,category,finish,material
```

`brand`, `color_name`, `color_code` bắt buộc; cần `hex` hoặc `rgb`. HEX sáu chữ số, RGB dạng `"12,34,56"`. `material` nhận `exterior`, `interior`, `waterproof`, `stone`, `concrete`, `stucco`, `metal`, `wood` (mặc định exterior). Mã màu nhập được giữ nguyên; app không tự tạo mã chính hãng. Màu sẵn có thuộc EditHouse. Có lọc hãng/collection/tone, tìm kiếm, yêu thích, gần đây và phân trang.

## Kiểm tra

```sh
npm test
npm run lint
npm run build
```

Test kiểm tra giữ pixel ngoài mask, phối nhiều mask, từ chối mask trống, nhập CSV/XLSX và loại bỏ tọa độ không hợp lệ. Để kiểm tra AI thực tế, nhập key tại dòng `GEMINI_API_KEY=` trong `.env.local`, rồi chạy `npm run dev`. Không đưa key vào Git.

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
