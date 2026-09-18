"use client";

import { useState } from "react";
import WalletBar from "./components/WalletBar";
import PoseRehabTracker, { type RepResult } from "./components/PoseRehabTracker";
import RecoveryCheckIn from "./components/RecoveryCheckIn";

const EXERCISE_ID = "knee-flexion-day-3";
const TARGET_REPS = 10;

export default function HomePage() {
  const [result, setResult] = useState<RepResult | null>(null);

  return (
    <main className="min-h-screen px-4 pb-16">
      <WalletBar />

      <section className="max-w-2xl mx-auto text-center mb-8">
        <h1 className="text-3xl font-bold text-care-900">CareProtocol</h1>
        <p className="text-gray-600 mt-2">
          Bài tập ngày 3 sau mổ: <b>Gập &amp; duỗi gối tại giường</b> — 10 lần,
          giúp phòng ngừa huyết khối tĩnh mạch sâu.
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Camera chỉ xử lý cục bộ trên trình duyệt của bạn — không có video hay
          hình ảnh nào được tải lên máy chủ.
        </p>
      </section>

      <section className="max-w-2xl mx-auto bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
        {!result ? (
          <PoseRehabTracker
            targetReps={TARGET_REPS}
            onSessionComplete={setResult}
          />
        ) : (
          <RecoveryCheckIn
            exerciseId={EXERCISE_ID}
            result={result}
            onReset={() => setResult(null)}
          />
        )}
      </section>
    </main>
  );
}
