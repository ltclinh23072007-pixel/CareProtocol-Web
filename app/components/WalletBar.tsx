"use client";

import dynamic from "next/dynamic";
import { useWallet } from "@solana/wallet-adapter-react";

// WalletMultiButton dùng window/localStorage nên phải load client-only (ssr: false)
const WalletMultiButton = dynamic(
  () =>
    import("@solana/wallet-adapter-react-ui").then(
      (mod) => mod.WalletMultiButton
    ),
  { ssr: false }
);

export default function WalletBar() {
  const { publicKey } = useWallet();

  return (
    <div className="flex items-center justify-between w-full max-w-2xl mx-auto py-4">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-care-500 animate-pulse" />
        <span className="text-sm font-medium text-gray-600">
          Solana Devnet
        </span>
      </div>
      <div className="flex items-center gap-3">
        {publicKey && (
          <span className="text-xs font-mono text-gray-400 hidden sm:inline">
            {publicKey.toBase58().slice(0, 4)}…{publicKey.toBase58().slice(-4)}
          </span>
        )}
        <WalletMultiButton className="!bg-care-600 hover:!bg-care-700 !rounded-xl !text-sm" />
      </div>
    </div>
  );
}
