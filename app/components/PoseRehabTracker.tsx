"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FilesetResolver,
  PoseLandmarker,
  type PoseLandmarkerResult,
} from "@mediapipe/tasks-vision";

export interface RepResult {
  reps: number;
  targetReps: number;
  formQualityScore: number; // trung bình độ chính xác góc gối trong toàn bộ phiên tập (0-100)
}

interface Props {
  targetReps?: number;
  onSessionComplete: (result: RepResult) => void;
}

// Chỉ số landmark theo chuẩn MediaPipe Pose (33 điểm), phía chân phải:
// 24 = hip phải, 26 = knee phải, 28 = ankle phải
const HIP = 24;
const KNEE = 26;
const ANKLE = 28;

// Ngưỡng góc gối (độ) để phân biệt trạng thái "duỗi thẳng" và "gập chân"
const EXTENDED_ANGLE_DEG = 160; // > ngưỡng này coi là chân đã duỗi thẳng
const FLEXED_ANGLE_DEG = 110; // < ngưỡng này coi là chân đã gập đủ sâu

type ExerciseState = "extended" | "flexing" | "flexed";

function calcAngleDegrees(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number }
): number {
  // Góc tại điểm b, tạo bởi 2 đoạn thẳng b->a và b->c
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };
  const dot = ab.x * cb.x + ab.y * cb.y;
  const magAB = Math.hypot(ab.x, ab.y);
  const magCB = Math.hypot(cb.x, cb.y);
  if (magAB === 0 || magCB === 0) return 180;
  const cosAngle = Math.min(1, Math.max(-1, dot / (magAB * magCB)));
  return (Math.acos(cosAngle) * 180) / Math.PI;
}

export default function PoseRehabTracker({
  targetReps = 10,
  onSessionComplete,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const stateRef = useRef<ExerciseState>("extended");
  const repsRef = useRef(0);
  const angleQualitySamplesRef = useRef<number[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [reps, setReps] = useState(0);
  const [currentAngle, setCurrentAngle] = useState<number | null>(null);
  const [feedback, setFeedback] = useState(
    "Đang tải mô hình nhận diện khung xương…"
  );
  const [error, setError] = useState<string | null>(null);

  // Khởi tạo PoseLandmarker (tải model .task + wasm runtime từ CDN của Google, chạy trên GPU/CPU trình duyệt)
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
        );
        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numPoses: 1,
        });
        if (cancelled) return;
        landmarkerRef.current = landmarker;
        setIsLoading(false);
        setFeedback("Sẵn sàng. Bấm “Bắt đầu tập” và đứng để camera thấy rõ chân phải.");
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setError(
            "Không tải được mô hình AI. Vui lòng kiểm tra kết nối mạng và thử lại."
          );
          setIsLoading(false);
        }
      }
    }

    init();
    return () => {
      cancelled = true;
      landmarkerRef.current?.close();
    };
  }, []);

  const stopCamera = useCallback(() => {
    if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    const stream = videoRef.current?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((track) => track.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsRunning(false);
  }, []);

  const predictLoop = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const landmarker = landmarkerRef.current;
    if (!video || !canvas || !landmarker || video.readyState < 2) {
      rafIdRef.current = requestAnimationFrame(predictLoop);
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const result: PoseLandmarkerResult = landmarker.detectForVideo(
      video,
      performance.now()
    );

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    if (result.landmarks && result.landmarks.length > 0) {
      const lm = result.landmarks[0];
      const hip = lm[HIP];
      const knee = lm[KNEE];
      const ankle = lm[ANKLE];

      if (hip && knee && ankle) {
        const angle = calcAngleDegrees(hip, knee, ankle);
        setCurrentAngle(Math.round(angle));

        // Vẽ khung xương chân phải để bệnh nhân tự quan sát tư thế
        ctx.strokeStyle = "#10b981";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(hip.x * canvas.width, hip.y * canvas.height);
        ctx.lineTo(knee.x * canvas.width, knee.y * canvas.height);
        ctx.lineTo(ankle.x * canvas.width, ankle.y * canvas.height);
        ctx.stroke();
        [hip, knee, ankle].forEach((p) => {
          ctx.fillStyle = "#059669";
          ctx.beginPath();
          ctx.arc(p.x * canvas.width, p.y * canvas.height, 7, 0, 2 * Math.PI);
          ctx.fill();
        });

        // State machine đếm rep: extended -> flexing -> flexed -> (quay lại) extended = 1 rep
        const state = stateRef.current;
        if (state === "extended" && angle < FLEXED_ANGLE_DEG) {
          stateRef.current = "flexing";
        } else if (state === "flexing" && angle < FLEXED_ANGLE_DEG - 5) {
          stateRef.current = "flexed";
          // Điểm chất lượng: gập càng sâu (góc càng nhỏ, tối đa hoá ở 70 độ) điểm càng cao
          const quality = Math.max(
            0,
            Math.min(100, 100 - (angle - 70) * 1.2)
          );
          angleQualitySamplesRef.current.push(quality);
        } else if (state === "flexed" && angle > EXTENDED_ANGLE_DEG) {
          stateRef.current = "extended";
          repsRef.current += 1;
          setReps(repsRef.current);
          setFeedback(`Tốt! Đã đếm ${repsRef.current}/${targetReps} lần.`);

          if (repsRef.current >= targetReps) {
            const samples = angleQualitySamplesRef.current;
            const avgQuality =
              samples.length > 0
                ? Math.round(
                    samples.reduce((a, b) => a + b, 0) / samples.length
                  )
                : 80;
            stopCamera();
            onSessionComplete({
              reps: repsRef.current,
              targetReps,
              formQualityScore: avgQuality,
            });
            ctx.restore();
            return;
          }
        }

        if (angle >= FLEXED_ANGLE_DEG && angle <= EXTENDED_ANGLE_DEG) {
          setFeedback("Đang chuyển động — tiếp tục gập/duỗi đều nhịp.");
        } else if (state === "extended") {
          setFeedback("Chân đang duỗi thẳng. Bắt đầu gập gối lại.");
        }
      }
    } else {
      setFeedback("Không thấy rõ chân trong khung hình. Lùi lại để camera thấy toàn thân.");
    }

    ctx.restore();
    rafIdRef.current = requestAnimationFrame(predictLoop);
  }, [onSessionComplete, stopCamera, targetReps]);

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      repsRef.current = 0;
      angleQualitySamplesRef.current = [];
      stateRef.current = "extended";
      setReps(0);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsRunning(true);
      rafIdRef.current = requestAnimationFrame(predictLoop);
    } catch (e) {
      console.error(e);
      setError(
        "Không truy cập được camera. Vui lòng cấp quyền camera cho trình duyệt."
      );
    }
  }, [predictLoop]);

  useEffect(() => stopCamera, [stopCamera]);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative w-full max-w-md mx-auto aspect-[4/3] bg-black rounded-2xl overflow-hidden shadow-lg">
        <video ref={videoRef} className="hidden" playsInline muted />
        <canvas ref={canvasRef} className="w-full h-full object-cover" />
        {!isRunning && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-white text-center p-4">
            {isLoading ? "Đang tải mô hình AI…" : "Bấm “Bắt đầu tập” để mở camera"}
          </div>
        )}
        {currentAngle !== null && isRunning && (
          <div className="absolute top-2 left-2 bg-black/60 text-care-400 text-xs font-mono px-2 py-1 rounded">
            Góc gối: {currentAngle}°
          </div>
        )}
      </div>

      <div className="text-center">
        <p className="text-3xl font-bold text-care-700">
          {reps}
          <span className="text-lg text-gray-400"> / {targetReps} lần</span>
        </p>
        <p className="text-sm text-gray-600 mt-1">{feedback}</p>
        {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
      </div>

      <div className="flex justify-center gap-3">
        {!isRunning ? (
          <button
            onClick={startCamera}
            disabled={isLoading}
            className="px-5 py-2.5 rounded-xl bg-care-600 text-white font-medium disabled:opacity-50 hover:bg-care-700 transition"
          >
            Bắt đầu tập
          </button>
        ) : (
          <button
            onClick={stopCamera}
            className="px-5 py-2.5 rounded-xl bg-gray-200 text-gray-800 font-medium hover:bg-gray-300 transition"
          >
            Dừng lại
          </button>
        )}
      </div>
    </div>
  );
}
