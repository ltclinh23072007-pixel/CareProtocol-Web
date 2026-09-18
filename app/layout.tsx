import type { Metadata } from "next";
import "./globals.css";
import WalletContextProvider from "./providers/WalletContextProvider";

export const metadata: Metadata = {
  title: "CareProtocol – Phục hồi hậu phẫu AI x Solana",
  description:
    "Đếm cử động phục hồi bằng AI (MediaPipe) trên trình duyệt, xác thực tuân thủ điều trị on-chain trên Solana Devnet.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body>
        <WalletContextProvider>{children}</WalletContextProvider>
      </body>
    </html>
  );
}
