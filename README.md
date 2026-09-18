HEAD
# CareProtocol — AI Rehab Tracker x Solana Devnet

MVP hackathon: đếm cử động phục hồi hậu phẫu bằng MediaPipe Pose ngay trên trình duyệt,
sau đó ký giao dịch Solana Devnet (qua ví Phantom) để ghi nhận bằng chứng tuân thủ điều trị
một cách bất biến, chi phí gần như 0đ.

## 0. Yêu cầu trước khi bắt đầu

- Máy tính có Node.js **≥ 18** (kiểm tra: `node -v`).
- Trình duyệt Chrome hoặc Edge (để MediaPipe dùng được GPU delegate) có webcam.
- Tiện ích mở rộng ví **Phantom Wallet** (cài từ https://phantom.app).

---

## A. Hướng dẫn bấm máy từng bước — Cài đặt & chạy dự án

1. **Mở Terminal** (Windows: PowerShell; macOS: Terminal) tại thư mục chứa mã nguồn `careprotocol/`.
2. Gõ lệnh sau rồi bấm **Enter** để cài thư viện:
   ```
   npm install
   ```
   Chờ đến khi terminal hiện lại dấu nhắc lệnh (không còn chạy).
3. (Tuỳ chọn) Sao chép file cấu hình mạng:
   ```
   cp .env.example .env.local
   ```
4. Khởi chạy server phát triển:
   ```
   npm run dev
   ```
5. Terminal sẽ hiện dòng `Local: http://localhost:3000`. Mở trình duyệt, gõ địa chỉ đó và bấm **Enter**.

---

## B. Hướng dẫn bấm máy từng bước — Cấu hình ví Phantom sang Devnet

1. Bấm vào **icon Phantom** trên thanh công cụ trình duyệt (góc trên bên phải).
2. Bấm **icon bánh răng (Settings)** ở góc dưới bên phải cửa sổ Phantom.
3. Chọn mục **"Developer Settings"**.
4. Bật công tắc **"Testnet Mode"**.
5. Quay lại màn hình chính Phantom, bấm vào tên mạng ở trên cùng (mặc định "Mainnet"), chọn **"Devnet"** trong danh sách xổ xuống.
6. (Nếu ví chưa có SOL) Copy địa chỉ ví (bấm vào tên tài khoản để copy), mở tab mới vào `https://faucet.solana.com`, dán địa chỉ, chọn mạng **Devnet**, bấm **Confirm Airdrop** — hoặc dùng nút "Xin 1 SOL Devnet" ngay trong app CareProtocol ở bước D.4 dưới đây.

---

## C. Hướng dẫn bấm máy từng bước — Demo chức năng AI đếm cử động

1. Trên trang `http://localhost:3000`, bấm nút **"Bắt đầu tập"**.
2. Trình duyệt hiện hộp thoại xin quyền camera → bấm **"Allow" / "Cho phép"**.
3. Lùi người ra sau để camera thấy trọn thân người (đặc biệt là chân phải: hông – gối – cổ chân).
4. Thực hiện động tác **gập gối lên rồi duỗi thẳng chân trở lại** — lặp lại đủ 10 lần.
5. Quan sát góc số ở góc trên bên trái video ("Góc gối: …°") và bộ đếm ở giữa màn hình tự tăng lên sau mỗi lần gập–duỗi hoàn chỉnh.
6. Khi đạt đủ **10/10 lần**, camera tự tắt và màn hình chuyển sang bước ghi nhận on-chain.

---

## D. Hướng dẫn bấm máy từng bước — Ký & ghi nhận on-chain

1. Bấm nút **"Connect Wallet"** ở góc trên bên phải trang web.
2. Trong popup Phantom hiện ra, bấm **"Connect"**.
3. Kiểm tra dòng chữ "Solana Devnet" ở góc trên bên trái đang có chấm xanh nhấp nháy (đúng mạng thử nghiệm).
4. Nếu số dư Devnet = 0, bấm nút **"1. Xin 1 SOL Devnet (miễn phí)"**, chờ vài giây tới khi số dư hiển thị.
5. Bấm nút **"2. Ký & ghi nhận lên Solana Devnet"**.
6. Phantom hiện popup yêu cầu ký giao dịch → xem qua nội dung → bấm **"Confirm" / "Approve"**.
7. Chờ 1–2 giây, trang hiển thị dòng chữ ký giao dịch (transaction signature) và nút **"Xem trên Solana Explorer (Devnet) →"**.
8. Bấm vào nút đó để mở Solana Explorer, cho Ban Giám khảo thấy giao dịch thật đã được xác nhận trên blockchain kèm timestamp block.

---

## Kiến trúc kỹ thuật (tóm tắt)

```
Trình duyệt bệnh nhân
 ├─ MediaPipe Pose (chạy 100% client, WASM/GPU) → đếm rep + chấm điểm form
 ├─ SHA-256 hash bằng chứng phục hồi (Web Crypto API)
 └─ Ví Phantom ký giao dịch chứa memo (proofHash, reps, timestamp)
        │
        ▼
   Solana Devnet — SPL Memo Program
   (bất biến, có thể tra cứu công khai qua chữ ký giao dịch)
```

- Không video/hình ảnh nào rời khỏi trình duyệt — chỉ có **hash + số liệu tổng hợp** được ghi on-chain.
- Dùng SPL Memo Program (đã có sẵn trên mọi cluster Solana) để MVP chạy được ngay trong thời gian hackathon mà không cần viết/deploy chương trình Anchor riêng.
- Roadmap: thay Memo Program bằng Anchor Program tự viết, lưu `RecoveryPlan` vào PDA (Program Derived Address) theo mã ca phẫu thuật, và phát hành SBT (Non-Transferable Token, dùng Token-2022 `NonTransferable` extension trên Solana) làm "Hồ sơ phục hồi" cho bệnh nhân.

## Khắc phục sự cố thường gặp

| Vấn đề | Cách xử lý |
|---|---|
| Camera không mở được | Kiểm tra trình duyệt đã cấp quyền Camera trong `Settings > Privacy`. |
| AI không đếm được rep | Đứng lùi xa hơn, đảm bảo đủ ánh sáng và chân phải nằm trọn trong khung hình. |
| Airdrop báo lỗi "429 rate limited" | Devnet giới hạn tần suất công khai — chờ 1-2 phút hoặc dùng `https://faucet.solana.com`. |
| Phantom không hiện nút Connect | Đảm bảo đã cài extension Phantom và tải lại trang (F5). |

# CareProtocol-Web
>>>>>>> 6bf4ee3b86bca87f16c9c550099b8bf521ce74e0
