# EditHouse

Editor phối màu sơn và vật liệu trên ảnh công trình. Chạy `npm install`, `npm run dev`, mở http://localhost:3000.

## Cấu hình AI

Settings → AI Provider → Experiential Labs → nhập key → Kiểm tra kết nối & lưu key. Không cần restart hoặc Gemini key. Biến EXPLABS_API_KEY trong .env.local là tùy chọn; key đã lưu được ưu tiên.

Key được lưu AES-256-GCM trong .edithouse/settings.enc, khóa riêng .edithouse/secret.key. Git ignore cả thư mục. Browser chỉ nhận preview, không lưu key trong localStorage/IndexedDB. Settings và AI endpoints chỉ chấp nhận localhost cùng origin.

Ba chế độ: Tiết kiệm, Cân bằng, Chất lượng cao. Override riêng cho Vision, Mask, OCR, Render, Text, top ba fallback, refresh và test nhỏ. Catalog phân trang và intersect với /v1/models, cache 20 phút. Capability UNKNOWN không đủ điều kiện cho Vision/Render. Giá chưa biết không được coi là miễn phí.

Inference dùng HTTP OpenAI-compatible tại https://api.experientiallabs.ai/v1. Render cần metadata image input/output, ưu tiên editing đã xác nhận. Route phải trả ảnh inline thực tế; nếu không model bị đánh dấu không tương thích và thử fallback. Không tự test render khi mở Settings. Cần key hợp lệ để kiểm chứng inference, giá theo tài khoản và regional eligibility thực tế.

Tài liệu: [Models](https://platform.experientiallabs.ai/docs/models), [OpenAI compatibility](https://platform.experientiallabs.ai/docs/openai-compatibility).

## Editor vùng sơn

Tải ảnh, nhận diện cấu kiện hoặc thêm vùng thủ công khi chưa cấu hình AI. Mỗi cấu kiện có polygon và Brush/Eraser, overlay, zoom, pan, Undo/Redo. Kiểm tra mask trước khi bật bề mặt.

Render gửi ảnh gốc và mask từng bề mặt. Server kiểm tra mask trước khi gọi AI, ghép kết quả trong hợp mask và xuất PNG. Pixel ngoài mask giữ nguyên so với ảnh đầu vào đã tối ưu ở browser (cạnh dài tối đa 2200px). Mỗi bề mặt có màu, hệ sơn và hiệu ứng riêng.

Dự án tự lưu trong IndexedDB: ảnh, cấu kiện, mask, lựa chọn, lịch sử và phương án. Có lưu/nhân bản/đổi tên/xóa/mở phương án và so sánh ảnh. Dữ liệu gắn với browser/origin, chưa đồng bộ cloud.

## Catalog

Nhập CSV UTF-8 hoặc XLSX (worksheet đầu), tối đa 25 MB / 100.000 màu. Các cột:

```csv
brand,collection,color_name,color_code,hex,rgb,category,finish,material
```

brand, color_name, color_code bắt buộc; cần hex hoặc rgb. HEX sáu chữ số, RGB dạng "12,34,56". Material: exterior, interior, waterproof, stone, concrete, stucco, metal, wood. Mã nhập được giữ nguyên, không tự tạo mã chính hãng. Màu sẵn có là màu mô phỏng EditHouse. Có lọc hãng/collection/tone, tìm kiếm, yêu thích, gần đây, phân trang. Bảng màu lưu độc lập trong IndexedDB `edithouse-catalog`. Palette mở quản lý kể cả chưa có ảnh công trình. Luồng chính nhập nhiều ảnh: Experiential CATALOG_OCR đọc hãng, collection, mã nguyên bản, tên và bounding box; code sample pixel trong ô màu để lấy RGB/HEX. Preview cho sửa OCR và chọn màu trước khi lưu; mã giữ nguyên cả dấu cách, / và -. Reset project không xóa bảng màu.

## Kiểm tra

```
npm test
npm run lint
npm run build
```

Test kiểm tra mask, CSV/XLSX, capability gates, pagination, cache/refresh, override, lỗi fallback và lưu config mã hóa. Phản hồi gateway giả lập không chứng minh inference thực tế.

## Cấu trúc

- lib/ai/: provider, capabilities, selector, secure config.
- app/api/settings/ai/: kết nối và lưu cài đặt.
- app/api/ai/: status, models, test, text helper.
- app/api/analyze, app/api/mask/analyze, app/api/catalog/analyze, app/api/render: inference theo vai trò.
- components/AISettings.tsx: cấu hình trực tiếp.
- lib/composite.ts: ghép ảnh chỉ trong mask.

## Engine phối màu v2

EditHouse dùng hai lớp xử lý tách biệt để tránh hiện tượng AI vẽ lại công trình:

- **Sơn màu thường:** server recolor trực tiếp trong không gian màu OKLab bên trong mask, giữ ánh sáng cục bộ, bóng đổ, nhiễu camera và texture gốc. Không gọi image-generation AI cho sơn nước thông thường.
- **Vật liệu/hiệu ứng:** marble, granite, đá hạt, microcement, stucco, metallic, gỗ... mới đi qua IMAGE_RENDER. Kết quả vẫn được composite khóa cứng trong mask.
- **SAM2:** trong Mask Editor chọn công cụ **SAM2**, bấm vào giữa tường/cột/mái để bám biên. Bấm thêm để mở rộng; Shift+click hoặc chuột phải để loại cửa, kính, cây hoặc vật che. Sau đó vẫn có thể Brush/Eraser thủ công.

SAM2 chạy ở browser bằng ONNX Runtime Web, ưu tiên WebGPU và fallback WASM. Model được tải/cache ở browser khi dùng lần đầu; ảnh không cần gửi sang một server segmentation riêng.

### Nguồn kỹ thuật / giấy phép

- Meta Segment Anything 2 (SAM2), Apache-2.0.
- ONNX Runtime Web, MIT.
- Kiến trúc browser SAM2 tham khảo geronimi73/next-sam, MIT; model ONNX tiny tương thích được tải từ g-ronimo/sam2-tiny.

Các thành phần trên chỉ phục vụ segmentation. Engine recolor OKLab và luồng khóa kiến trúc của EditHouse nằm trong mã nguồn dự án này.
