"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { formatStudyClock, liveElapsedSeconds } from "@/lib/study-timer";

const SCREENTIME_COLORS = {
  light: {
    card: "#F2F2F7",
    text: "#000000",
    textSoft: "#8E8E93",
    cyan: "#32ADE6",
    blue: "#007AFF",
  },
  dark: {
    card: "#1C1C1E",
    text: "#FFFFFF",
    textSoft: "#8E8E93",
    cyan: "#64D2FF",
    blue: "#0A84FF",
  },
};

const MAX_SECONDS = 3 * 60 * 60; // 3 hours
const SEGMENT_COUNT = 24;

interface CircularStopwatchProps {
  totalSeconds: number;
  isRunning: boolean;
  isDark: boolean;
}

function CircularStopwatch({ totalSeconds, isRunning, isDark }: CircularStopwatchProps) {
  const colors = isDark ? SCREENTIME_COLORS.dark : SCREENTIME_COLORS.light;
  const percentage = Math.min((totalSeconds / MAX_SECONDS) * 100, 100);
  const filledSegments = Math.floor((percentage / 100) * SEGMENT_COUNT);
  const nextSegmentToBeFilled = filledSegments < SEGMENT_COUNT ? filledSegments : -1;

  const CX = 100;
  const CY = 100;
  const R = 80;
  const SEGMENT_ANGLE = 360 / SEGMENT_COUNT;
  const GAP = 2;

  const polarToCartesian = (angle: number, radius: number) => {
    const rad = ((angle - 90) * Math.PI) / 180;
    return {
      x: CX + radius * Math.cos(rad),
      y: CY + radius * Math.sin(rad),
    };
  };

  const createSegmentPath = (startAngle: number, endAngle: number) => {
    const innerRadius = R - 8;
    const outerRadius = R + 8;

    const start1 = polarToCartesian(startAngle, innerRadius);
    const end1 = polarToCartesian(endAngle, innerRadius);
    const start2 = polarToCartesian(startAngle, outerRadius);
    const end2 = polarToCartesian(endAngle, outerRadius);

    return `
      M ${start1.x} ${start1.y}
      A ${innerRadius} ${innerRadius} 0 0 1 ${end1.x} ${end1.y}
      L ${end2.x} ${end2.y}
      A ${outerRadius} ${outerRadius} 0 0 0 ${start2.x} ${start2.y}
      Z
    `;
  };

  return (
    <div className="relative w-full max-w-[220px] min-h-[180px] flex items-center justify-center">
      <svg viewBox="0 0 200 200" className="w-full" aria-hidden="true">
        {Array.from({ length: SEGMENT_COUNT }).map((_, i) => {
          const segmentStart = i * SEGMENT_ANGLE + (i > 0 ? GAP / 2 : 0);
          const segmentEnd = (i + 1) * SEGMENT_ANGLE - GAP / 2;

          let fillColor = colors.card;
          let strokeColor = isDark ? "#3C3C3E" : "#D5D5DA";
          let opacity = 1;

          if (i < filledSegments) {
            fillColor = colors.cyan;
            strokeColor = colors.cyan;
          }

          const shouldBlink = i === nextSegmentToBeFilled && isRunning;

          return (
            <g key={i}>
              <path
                d={createSegmentPath(segmentStart, segmentEnd)}
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth="1"
                className={cn(shouldBlink && "animate-pulse")}
                style={{
                  opacity: 0,
                  animation: `fadeIn 0.35s ease-out ${i * 0.02}s forwards`,
                }}
              />
            </g>
          );
        })}

        <text
          x={CX}
          y={CY + 5}
          textAnchor="middle"
          dominantBaseline="middle"
          className="font-mono font-semibold"
          style={{
            fontSize: "36px",
            fill: colors.text,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {formatStudyClock(totalSeconds)}
        </text>
      </svg>
    </div>
  );
}

export function PermanentStopwatchCard() {
  const router = useRouter();
  const [isDark, setIsDark] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [topicName, setTopicName] = useState("");
  const [status, setStatus] = useState<"idle" | "running" | "paused">("idle");
  const [accumulated, setAccumulated] = useState(0);
  const [runningSince, setRunningSince] = useState<string | null>(null);
  const [tick, setTick] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));

    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains("dark"));
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (status !== "running") {
      setTick(null);
      return;
    }
    const update = () => setTick(Date.now());
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [status, runningSince]);

  const colors = isDark ? SCREENTIME_COLORS.dark : SCREENTIME_COLORS.light;
  const liveSeconds = tick === null ? 0 : liveElapsedSeconds(runningSince, tick);
  const totalSeconds = accumulated + liveSeconds;

  // Auto-complete at 3 hours
  useEffect(() => {
    if (totalSeconds >= MAX_SECONDS && status === "running") {
      handleComplete();
    }
  }, [totalSeconds, status]);

  const handleStart = () => {
    if (!topicName.trim()) return;
    setIsActive(true);
    setStatus("running");
    setRunningSince(new Date().toISOString());
  };

  const handleToggle = () => {
    if (status === "running") {
      setAccumulated(totalSeconds);
      setRunningSince(null);
      setStatus("paused");
    } else {
      setRunningSince(new Date().toISOString());
      setStatus("running");
    }
  };

  const handleComplete = () => {
    setIsActive(false);
    setStatus("idle");
    setTopicName("");
    setAccumulated(0);
    setRunningSince(null);
    setTick(null);
  };

  return (
    <div
      className="stopwatch-card mb-6 rounded-xl border p-6 transition-all duration-300"
      style={{
        backgroundColor: colors.card,
        borderColor: isDark ? "#2C2C2E" : "#E5E5EA",
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {!isActive ? (
        <div className="flex flex-col items-center gap-6 py-4">
          <div className="relative w-full max-w-[220px]">
            <div className="absolute inset-0 flex items-center justify-center opacity-10">
              <img src="/stopwatch-icon.svg" alt="" className="w-32 h-32" />
            </div>
            <CircularStopwatch totalSeconds={0} isRunning={false} isDark={isDark} />
          </div>

          <div className="w-full max-w-[280px] space-y-4">
            <input
              type="text"
              value={topicName}
              onChange={(e) => setTopicName(e.target.value)}
              placeholder="What are you working on?"
              className="w-full rounded-lg border px-4 py-3 text-sm transition-all"
              style={{
                backgroundColor: isDark ? "#2C2C2E" : "#FFFFFF",
                borderColor: isDark ? "#3C3C3E" : "#D5D5DA",
                color: colors.text,
              }}
            />

            <button
              onClick={handleStart}
              disabled={!topicName.trim()}
              className="w-full rounded-full py-4 text-base font-semibold transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100"
              style={{
                backgroundColor: colors.blue,
                color: "#FFFFFF",
              }}
            >
              Start
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: status === "running" ? colors.cyan : colors.textSoft }}
            />
            <span className="text-sm font-medium" style={{ color: colors.text }}>
              {topicName}
            </span>
          </div>

          <div className="flex flex-col items-center gap-6">
            <div className="relative w-full max-w-[220px]">
              <div className="absolute inset-0 flex items-center justify-center opacity-10">
                <img src="/stopwatch-icon.svg" alt="" className="w-32 h-32" />
              </div>
              <CircularStopwatch totalSeconds={totalSeconds} isRunning={status === "running"} isDark={isDark} />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleToggle}
                disabled={isPending}
                className="rounded-full px-6 py-3 text-sm font-semibold transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                style={{
                  backgroundColor: isDark ? "#2C2C2E" : "#E5E5EA",
                  color: colors.text,
                }}
              >
                {status === "running" ? "Pause" : "Resume"}
              </button>
              <button
                onClick={handleComplete}
                disabled={isPending}
                className="rounded-full px-6 py-3 text-sm font-semibold transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                style={{
                  backgroundColor: colors.blue,
                  color: "#FFFFFF",
                }}
              >
                Complete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
