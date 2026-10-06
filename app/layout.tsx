import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EditHouse — AI phối màu công trình",
  description: "Phối màu sơn, vật liệu và hiệu ứng trực tiếp trên ảnh công trình bằng AI."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
