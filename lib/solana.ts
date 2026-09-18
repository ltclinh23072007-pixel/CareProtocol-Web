import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  clusterApiUrl,
} from "@solana/web3.js";

/**
 * CareProtocol - Lớp tiện ích tương tác Solana Devnet.
 *
 * Kiến trúc "AI off-chain / Proof on-chain":
 * - MediaPipe Pose (chạy 100% trên trình duyệt bệnh nhân) đếm số lần cử động
 *   và không bao giờ upload video/hình ảnh lên server.
 * - Khi đạt đủ số lần theo phác đồ, client tạo một "Recovery Proof" (JSON đã
 *   được băm SHA-256) rồi bệnh nhân dùng ví Phantom KÝ và GỬI giao dịch chứa
 *   proof đó lên Solana Devnet thông qua SPL Memo Program.
 * - Vì Memo Program là chương trình gốc, không cần deploy on-chain program
 *   riêng vẫn có được: bất biến (immutable), có timestamp trên block,
 *   phí gần như 0đ (~0.000005 SOL / giao dịch), và có thể tra cứu công khai
 *   trên Solana Explorer bằng chữ ký giao dịch (transaction signature).
 * - Bước tiếp theo (roadmap) là thay Memo Program bằng một Anchor Program
 *   riêng lưu trạng thái vào PDA (xem README mục "Tiếp theo").
 */

// Địa chỉ chương trình SPL Memo chính thức trên mọi cluster Solana (mainnet/devnet/testnet)
export const MEMO_PROGRAM_ID = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"
);

export function getConnection(): Connection {
  const endpoint =
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl("devnet");
  return new Connection(endpoint, "confirmed");
}

export interface RecoveryProofPayload {
  patientPublicKey: string;
  exerciseId: string; // ví dụ: "knee-flexion-day-3"
  repsCompleted: number;
  repsTarget: number;
  formQualityScore: number; // 0-100, tính từ góc khớp MediaPipe
  timestampIso: string;
}

/** Băm SHA-256 payload bằng Web Crypto API (chạy trong trình duyệt, không cần thư viện ngoài) */
export async function hashRecoveryProof(
  payload: RecoveryProofPayload
): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(payload));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Xây dựng instruction Memo chứa nội dung Recovery Proof.
 * Memo Program chỉ đơn giản "ghi log" chuỗi UTF-8 đưa vào data của instruction,
 * không cần account nào khác ngoài (tuỳ chọn) signer.
 */
export function buildMemoInstruction(
  memoText: string,
  signerPubkey: PublicKey
): TransactionInstruction {
  return new TransactionInstruction({
    keys: [{ pubkey: signerPubkey, isSigner: true, isWritable: false }],
    programId: MEMO_PROGRAM_ID,
    data: Buffer.from(memoText, "utf-8"),
  });
}

/**
 * Gửi một giao dịch Devnet ghi nhận mốc phục hồi.
 * `signAndSendTransaction` được truyền vào từ hook useWallet() của
 * @solana/wallet-adapter-react (wallet.sendTransaction).
 */
export async function sendRecoveryCheckIn(
  connection: Connection,
  patientPubkey: PublicKey,
  payload: RecoveryProofPayload,
  signAndSendTransaction: (tx: Transaction) => Promise<string>
): Promise<{ signature: string; proofHash: string; explorerUrl: string }> {
  const proofHash = await hashRecoveryProof(payload);
  const memoText = JSON.stringify({
    protocol: "CareProtocol.v1",
    proofHash,
    exerciseId: payload.exerciseId,
    reps: `${payload.repsCompleted}/${payload.repsTarget}`,
    formQuality: payload.formQualityScore,
    ts: payload.timestampIso,
  });

  const instruction = buildMemoInstruction(memoText, patientPubkey);
  const transaction = new Transaction().add(instruction);

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = patientPubkey;

  const signature = await signAndSendTransaction(transaction);

  await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    "confirmed"
  );

  return {
    signature,
    proofHash,
    explorerUrl: `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
  };
}

/** Xin SOL Devnet miễn phí để trả phí giao dịch (chỉ hoạt động trên devnet) */
export async function requestDevnetAirdrop(
  connection: Connection,
  publicKey: PublicKey,
  lamports: number = 1_000_000_000 // 1 SOL
): Promise<string> {
  const signature = await connection.requestAirdrop(publicKey, lamports);
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");
  await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    "confirmed"
  );
  return signature;
}
