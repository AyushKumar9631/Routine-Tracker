"use client";

import { ActivityIcon } from "@/components/activity-icon";
import { formatScreenTimeLong } from "@/lib/screentime";
import type { Activity } from "@/lib/types";
import { cn, formatRelativeTime } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";

interface ScreenTimeStats {
  todayMinutes: number | null;
  weeklyAverageMinutes: number | null;
  monthlyAverageMinutes: number | null;
  weekLowestMinutes: number | null;
}

interface DayPoint {
  key: string;
  minutes: number | null;
}

const SCREENTIME_COLORS = {
  light: {
    background: "#FFFFFF",
    card: "#F2F2F7",
    text: "#000000",
    textSoft: "#8E8E93",
    cyan: "#32ADE6",
    blue: "#007AFF",
    orange: "#FF9500",
  },
  dark: {
    background: "#000000",
    card: "#1C1C1E",
    text: "#FFFFFF",
    textSoft: "#8E8E93",
    cyan: "#64D2FF",
    blue: "#0A84FF",
    orange: "#FF9F0A",
  },
};

function formatTimeCompact(minutes: number | null | undefined): { hours: string; mins: string } {
  if (minutes == null || !Number.isFinite(minutes)) return { hours: "--", mins: "--" };
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  return { hours: `${hours}hr`, mins: `${mins} mins` };
}

function SegmentedSpeedometer({
  minutes,
  limitMinutes,
  isDark,
}: {
  minutes: number;
  limitMinutes: number | null;
  isDark: boolean;
}) {
  const colors = isDark ? SCREENTIME_COLORS.dark : SCREENTIME_COLORS.light;
  const limit = limitMinutes || 240;
  const percentage = Math.min((minutes / limit) * 100, 100);
  const filledBoxes = Math.floor((percentage / 100) * 15);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const CX = 100;
  const CY = 100;
  const R = 70;
  const START_ANGLE = 135;
  const SWEEP = 270;
  const SEGMENT_COUNT = 15;
  const SEGMENT_ANGLE = SWEEP / SEGMENT_COUNT;
  const GAP = 3;

  const polarToCartesian = (angle: number, radius: number) => {
    const rad = (angle * Math.PI) / 180;
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

  const time = formatTimeCompact(minutes);

  return (
    <div className="relative w-full max-w-[200px]">
      <svg viewBox="0 0 200 180" className="w-full" aria-hidden="true">
        {Array.from({ length: SEGMENT_COUNT }).map((_, i) => {
          const segmentStart = START_ANGLE + i * SEGMENT_ANGLE + (i > 0 ? GAP / 2 : 0);
          const segmentEnd = START_ANGLE + (i + 1) * SEGMENT_ANGLE - GAP / 2;

          let fillColor = colors.card;
          let opacity = 0.3;

          if (i < filledBoxes) {
            if (i < 5) {
              fillColor = colors.cyan;
              opacity = 1;
            } else if (i < 10) {
              fillColor = colors.blue;
              opacity = 1;
            } else {
              fillColor = colors.orange;
              opacity = 1;
            }
          }

          const isLastBox = i === 14;
          const shouldBlink = isLastBox && i >= filledBoxes;
          const isHovered = hoveredIndex === i;

          return (
            <g key={i}>
              <path
                d={createSegmentPath(segmentStart, segmentEnd)}
                fill={fillColor}
                opacity={opacity}
                className={cn(
                  "transition-all duration-300 cursor-pointer animate-heat-pop",
                  shouldBlink && "animate-pulse"
                )}
                style={{
                  transformOrigin: `${CX}px ${CY}px`,
                  transform: isHovered ? "scale(1.05)" : "scale(1)",
                  animationDelay: `${i * 40}ms`,
                }}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <title>{`${Math.round(((i + 1) / 15) * 100)}%`}</title>
              </path>
            </g>
          );
        })}

        <text
          x={CX}
          y={CY - 12}
          textAnchor="middle"
          dominantBaseline="middle"
          className="font-mono font-semibold"
          style={{
            fontSize: "28px",
            fill: colors.text,
            fontVariantNumeric: "tabular-nums"
          }}
        >
          {time.hours}
        </text>
        <text
          x={CX}
          y={CY + 8}
          textAnchor="middle"
          dominantBaseline="middle"
          className="font-mono font-semibold"
          style={{
            fontSize: "28px",
            fill: colors.text,
            fontVariantNumeric: "tabular-nums"
          }}
        >
          {time.mins}
        </text>
        <text
          x={CX}
          y={CY + 28}
          textAnchor="middle"
          dominantBaseline="middle"
          style={{
            fontSize: "9px",
            fill: colors.textSoft,
          }}
        >
          screen time today
        </text>
      </svg>
    </div>
  );
}

function LineGraph({
  days,
  limitMinutes,
  isDark,
}: {
  days: DayPoint[];
  limitMinutes: number | null;
  isDark: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredDay, setHoveredDay] = useState<{ index: number; x: number; y: number; minutes: number } | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const colors = isDark ? SCREENTIME_COLORS.dark : SCREENTIME_COLORS.light;

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setMousePos({ x: e.clientX, y: e.clientY });

    const width = rect.width;
    const padding = 10;
    const graphWidth = width - padding * 2;
    const graphHeight = rect.height - padding * 2;
    const stepX = graphWidth / (days.length - 1);

    let closestIndex = -1;
    let closestDist = Infinity;

    days.forEach((day, i) => {
      if (day.minutes !== null) {
        const dayX = padding + i * stepX;
        const dist = Math.abs(x - dayX);
        if (dist < closestDist && dist < 20) {
          closestDist = dist;
          closestIndex = i;
        }
      }
    });

    if (closestIndex >= 0 && days[closestIndex].minutes !== null) {
      const validMinutes = days.map((d) => d.minutes).filter((m): m is number => m !== null);
      const maxMinutes = Math.max(...validMinutes, limitMinutes || 0);
      const dayX = padding + closestIndex * stepX;
      const canvasRect = canvas.getBoundingClientRect();

      setHoveredDay({
        index: closestIndex,
        x: canvasRect.left + dayX,
        y: canvasRect.top,
        minutes: days[closestIndex].minutes!,
      });
    } else {
      setHoveredDay(null);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const padding = 10;
    const graphWidth = width - padding * 2;
    const graphHeight = height - padding * 2;

    ctx.clearRect(0, 0, width, height);

    const validMinutes = days.map((d) => d.minutes).filter((m): m is number => m !== null);
    if (validMinutes.length === 0) return;

    const maxMinutes = Math.max(...validMinutes, limitMinutes || 0);
    const avgMinutes = validMinutes.reduce((sum, m) => sum + m, 0) / validMinutes.length;
    const minMinutes = Math.min(...validMinutes);
    const stepX = graphWidth / (days.length - 1);

    // Y-axis labels (max and min) - more visible
    ctx.fillStyle = colors.textSoft;
    ctx.font = "bold 10px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(formatScreenTimeLong(maxMinutes), width - 5, padding + 10);
    ctx.fillText(formatScreenTimeLong(minMinutes), width - 5, padding + graphHeight);

    const points: { x: number; y: number; minutes: number; color: string }[] = [];
    days.forEach((day, i) => {
      if (day.minutes !== null) {
        const x = padding + i * stepX;
        const y = padding + graphHeight - (day.minutes / maxMinutes) * graphHeight;

        let color = colors.cyan;
        if (limitMinutes) {
          const pct = (day.minutes / limitMinutes) * 100;
          if (pct > 100) color = colors.orange;
          else if (pct > 66) color = colors.blue;
        }

        points.push({ x, y, minutes: day.minutes, color });
      }
    });

    if (points.length === 0) return;

    ctx.beginPath();
    ctx.moveTo(points[0].x, graphHeight + padding);

    points.forEach((point, i) => {
      if (i === 0) {
        ctx.lineTo(point.x, point.y);
      } else {
        const prevPoint = points[i - 1];
        const midX = (prevPoint.x + point.x) / 2;
        ctx.quadraticCurveTo(prevPoint.x, prevPoint.y, midX, (prevPoint.y + point.y) / 2);
        ctx.quadraticCurveTo(point.x, point.y, point.x, point.y);
      }
    });

    ctx.lineTo(points[points.length - 1].x, graphHeight + padding);
    ctx.closePath();

    const gradient = ctx.createLinearGradient(0, padding, 0, graphHeight + padding);
    gradient.addColorStop(0, `${colors.cyan}40`);
    gradient.addColorStop(0.5, `${colors.blue}30`);
    gradient.addColorStop(1, `${colors.orange}20`);
    ctx.fillStyle = gradient;
    ctx.fill();

    for (let i = 0; i < points.length - 1; i++) {
      const start = points[i];
      const end = points[i + 1];

      const lineGradient = ctx.createLinearGradient(start.x, start.y, end.x, end.y);
      lineGradient.addColorStop(0, start.color);
      lineGradient.addColorStop(1, end.color);

      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      const midX = (start.x + end.x) / 2;
      ctx.quadraticCurveTo(start.x, start.y, midX, (start.y + end.y) / 2);
      ctx.quadraticCurveTo(end.x, end.y, end.x, end.y);
      ctx.strokeStyle = lineGradient;
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
    }

    points.forEach((point) => {
      const isHovered = hoveredDay?.index === days.findIndex((d) => d.minutes === point.minutes);
      const radius = isHovered ? 5 : 3.5;

      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = point.color;
      ctx.fill();
      ctx.strokeStyle = isDark ? colors.card : colors.background;
      ctx.lineWidth = 2;
      ctx.stroke();

      if (isHovered) {
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius + 4, 0, Math.PI * 2);
        ctx.strokeStyle = `${point.color}40`;
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    });
  }, [days, limitMinutes, isDark, colors, hoveredDay]);

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        className="w-full h-32 cursor-pointer"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredDay(null)}
      />
      {hoveredDay && (
        <div
          className="fixed z-50 pointer-events-none px-2 py-1 rounded text-xs font-medium shadow-lg"
          style={{
            backgroundColor: colors.card,
            color: colors.text,
            border: `1px solid ${isDark ? "#2C2C2E" : "#E5E5EA"}`,
            left: hoveredDay.x - 35,
            top: hoveredDay.y - 10,
          }}
        >
          {formatScreenTimeLong(hoveredDay.minutes)}
        </div>
      )}
    </div>
  );
}

export function ScreenTimeTodayCard({
  activity,
  stats,
  lastSyncedAt,
  history = [],
  todayDateKey,
}: {
  activity: Activity;
  stats: ScreenTimeStats;
  lastSyncedAt: string | null;
  history?: { period_key: string; value: number | null }[];
  todayDateKey: string;
}) {
  const [isDark, setIsDark] = useState(false);

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

  const colors = isDark ? SCREENTIME_COLORS.dark : SCREENTIME_COLORS.light;

  const last14Days: DayPoint[] = [];
  const today = new Date(todayDateKey);
  for (let i = 13; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const key = date.toISOString().split("T")[0];
    const entry = history.find((h) => h.period_key === key);
    last14Days.push({ key, minutes: entry?.value ?? null });
  }

  const weeklyTime = formatTimeCompact(stats.weeklyAverageMinutes);
  const monthlyTime = formatTimeCompact(stats.monthlyAverageMinutes);
  const lowestTime = formatTimeCompact(stats.weekLowestMinutes);

  return (
    <div
      className="screentime-card mb-6 rounded-xl border p-6 transition-all duration-300 lg:col-span-2 xl:col-span-2"
      style={{
        backgroundColor: colors.card,
        borderColor: isDark ? "#2C2C2E" : "#E5E5EA",
      }}
    >
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ActivityIcon icon={activity.icon} className="text-xl" />
          <span className="text-base font-medium" style={{ color: colors.text }}>
            {activity.name}
          </span>
        </div>
        <span className="text-xs" style={{ color: colors.textSoft }}>
          {formatRelativeTime(lastSyncedAt)}
        </span>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex flex-col items-center justify-start shrink-0">
          <SegmentedSpeedometer
            minutes={stats.todayMinutes ?? 0}
            limitMinutes={activity.target_value}
            isDark={isDark}
          />
          {activity.target_value && (
            <p className="mt-4 text-xs text-center" style={{ color: colors.textSoft }}>
              Daily limit: {formatScreenTimeLong(activity.target_value)}
            </p>
          )}
        </div>

        <div className="flex-1 flex flex-col space-y-5 min-w-0">
          <div className="grid grid-cols-3 gap-6">
            <div className="group cursor-default transition-transform hover:scale-105">
              <p className="text-[11px] mb-1.5 uppercase tracking-wide" style={{ color: colors.textSoft }}>
                Weekly Average
              </p>
              <p className="text-xl font-semibold tabular-nums leading-tight" style={{ color: colors.text }}>
                {weeklyTime.hours}
              </p>
              <p className="text-xl font-semibold tabular-nums leading-tight" style={{ color: colors.text }}>
                {weeklyTime.mins}
              </p>
            </div>
            <div className="group cursor-default transition-transform hover:scale-105">
              <p className="text-[11px] mb-1.5 uppercase tracking-wide" style={{ color: colors.textSoft }}>
                Monthly Average
              </p>
              <p className="text-xl font-semibold tabular-nums leading-tight" style={{ color: colors.text }}>
                {monthlyTime.hours}
              </p>
              <p className="text-xl font-semibold tabular-nums leading-tight" style={{ color: colors.text }}>
                {monthlyTime.mins}
              </p>
            </div>
            <div className="group cursor-default transition-transform hover:scale-105">
              <p className="text-[11px] mb-1.5 uppercase tracking-wide" style={{ color: colors.textSoft }}>
                Week Lowest
              </p>
              <p className="text-xl font-semibold tabular-nums leading-tight" style={{ color: colors.text }}>
                {lowestTime.hours}
              </p>
              <p className="text-xl font-semibold tabular-nums leading-tight" style={{ color: colors.text }}>
                {lowestTime.mins}
              </p>
            </div>
          </div>

          <div>
            <p
              className="mb-3 text-[11px] font-medium uppercase tracking-wider"
              style={{ color: colors.textSoft }}
            >
              Last 14 days
            </p>
            <LineGraph days={last14Days} limitMinutes={activity.target_value} isDark={isDark} />
          </div>
        </div>
      </div>
    </div>
  );
}
