"use client";

import { useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL, Transaction } from "@solana/web3.js";
import {
  requestDevnetAirdrop,
  sendRecoveryCheckIn,
  type RecoveryProofPayload,
} from "@/lib/solana";
import type { RepResult } from "./PoseRehabTracker";

interface Props {
  exerciseId: string;
  result: RepResult;
  onReset: () => void;
}

type Status = "idle" | "airdropping" | "signing" | "confirmed" | "error";

export default function RecoveryCheckIn({ exerciseId, result, onReset }: Props) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected } = useWallet();

  const [status, setStatus] = useState<Status>("idle");
  const [signature, setSignature] = useState<string | null>(null);
  const [explorerUrl, setExplorerUrl] = useState<string | null>(null);
  const [balanceSol, setBalanceSol] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleAirdrop() {
    if (!publicKey) return;
    setStatus("airdropping");
    setErrorMsg(null);
    try {
      await requestDevnetAirdrop(connection, publicKey, 1 * LAMPORTS_PER_SOL);
      const lamports = await connection.getBalance(publicKey, "confirmed");
      setBalanceSol(lamports / LAMPORTS_PER_SOL);
      setStatus("idle");
    } catch (e) {
      console.error(e);
      setErrorMsg(
        "Airdrop thất bại (Devnet có thể đang giới hạn tần suất). Thử lại sau ít phút hoặc dùng https://faucet.solana.com."
      );
      setStatus("error");
    }
  }

  async function handleSignAndSend() {
    if (!publicKey) return;
    setStatus("signing");
    setErrorMsg(null);
    try {
      const payload: RecoveryProofPayload = {
        patientPublicKey: publicKey.toBase58(),
        exerciseId,
        repsCompleted: result.reps,
        repsTarget: result.targetReps,
        formQualityScore: result.formQualityScore,
        timestampIso: new Date().toISOString(),
      };

      const signAndSend = async (tx: Transaction) =>
        sendTransaction(tx, connection);

      const { signature, explorerUrl } = await sendRecoveryCheckIn(
        connection,
        publicKey,
        payload,
        signAndSend
      );

      setSignature(signature);
      setExplorerUrl(explorerUrl);
      setStatus("confirmed");
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e?.message || "Giao dịch thất bại. Vui lòng thử lại.");
      setStatus("error");
    }
  }

  if (!connected || !publicKey) {
    return (
      <div className="text-center text-sm text-gray-500 mt-4">
        Kết nối ví Phantom (Devnet) ở trên để ghi nhận mốc phục hồi lên blockchain.
      </div>
    );
  }

  return (
    <div className="mt-6 border-t pt-6 flex flex-col items-center gap-3">
      <div className="text-center">
        <p className="font-semibold text-care-700">
          ✅ Hoàn thành bài tập: {result.reps}/{result.targetReps} lần
        </p>
        <p className="text-sm text-gray-500">
          Điểm chất lượng động tác (AI chấm theo góc gối): {result.formQualityScore}/100
        </p>
      </div>

      {balanceSol !== null && (
        <p className="text-xs text-gray-400">Số dư Devnet: {balanceSol.toFixed(3)} SOL</p>
      )}

      <div className="flex flex-wrap justify-center gap-2">
        <button
          onClick={handleAirdrop}
          disabled={status === "airdropping" || status === "signing"}
          className="px-4 py-2 rounded-lg border border-care-500 text-care-700 text-sm font-medium hover:bg-care-50 disabled:opacity-50"
        >
          {status === "airdropping" ? "Đang xin SOL Devnet…" : "1. Xin 1 SOL Devnet (miễn phí)"}
        </button>

        <button
          onClick={handleSignAndSend}
          disabled={status === "signing" || status === "confirmed"}
          className="px-4 py-2 rounded-lg bg-care-600 text-white text-sm font-medium hover:bg-care-700 disabled:opacity-50"
        >
          {status === "signing"
            ? "Chờ ký trên Phantom…"
            : status === "confirmed"
            ? "Đã ghi nhận on-chain ✓"
            : "2. Ký & ghi nhận lên Solana Devnet"}
        </button>
      </div>

      {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}

      {status === "confirmed" && signature && (
        <div className="mt-2 w-full max-w-md bg-care-50 rounded-xl p-3 text-center">
          <p className="text-xs text-gray-600 break-all">
            Chữ ký giao dịch: <span className="font-mono">{signature}</span>
          </p>
          <a
            href={explorerUrl!}
            target="_blank"
            rel="noreferrer"
            className="text-care-700 underline text-sm font-medium"
          >
            Xem trên Solana Explorer (Devnet) →
          </a>
        </div>
      )}

      <button
        onClick={onReset}
        className="text-sm text-gray-400 underline mt-2"
      >
        Tập lại bài khác
      </button>
    </div>
  );
}
