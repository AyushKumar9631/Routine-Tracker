import {
  formatScreenTime,
  screenTimeFillFraction,
  screenTimeLevel,
  screenTimeLimitMarkFraction,
} from "@/lib/screentime";

const STROKE_CLASS = {
  moss: "stroke-moss",
  amber: "stroke-amber",
  rust: "stroke-rust",
} as const;

const FILL_CLASS = {
  moss: "fill-moss",
  amber: "fill-amber",
  rust: "fill-rust",
} as const;

const CX = 100;
const CY = 100;
const R = 78;
const STROKE_WIDTH = 13;
const START_ANGLE = 135;
const SWEEP = 270;

function point(angleDeg: number, radius: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: CX + radius * Math.cos(rad), y: CY + radius * Math.sin(rad) };
}

function arcPath(startAngle: number, endAngle: number) {
  const start = point(startAngle, R);
  const end = point(endAngle, R);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${R} ${R} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

export function ScreenTimeGauge({
  minutes,
  limitMinutes,
}: {
  minutes: number;
  limitMinutes: number | null;
}) {
  const level = screenTimeLevel(minutes, limitMinutes);
  const fraction = screenTimeFillFraction(minutes, limitMinutes);
  const fillEndAngle = START_ANGLE + fraction * SWEEP;
  const origin = point(START_ANGLE, R);

  // The limit itself always sits at the same spot along the arc (a fixed
  // fraction of the 0 -> 150%-of-limit sweep) — a cut mark there shows
  // whether today's fill has crossed the boundary, without a raw number.
  const limitAngle = START_ANGLE + screenTimeLimitMarkFraction() * SWEEP;
  const limitInner = point(limitAngle, R - STROKE_WIDTH / 2 - 4);
  const limitOuter = point(limitAngle, R + STROKE_WIDTH / 2 + 4);

  return (
    <svg viewBox="0 0 200 170" className="mx-auto w-full max-w-[190px]" aria-hidden="true">
      <path
        d={arcPath(START_ANGLE, START_ANGLE + SWEEP)}
        fill="none"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeDasharray="2 8"
        className="stroke-line"
      />

      {fraction > 0 && (
        <>
          <path
            d={arcPath(START_ANGLE, fillEndAngle)}
            fill="none"
            strokeWidth={STROKE_WIDTH}
            strokeLinecap="round"
            className={STROKE_CLASS[level]}
          />
          <circle cx={origin.x} cy={origin.y} r={STROKE_WIDTH / 2} className={FILL_CLASS[level]} />
        </>
      )}

      {limitMinutes != null && limitMinutes > 0 && (
        <line
          x1={limitInner.x}
          y1={limitInner.y}
          x2={limitOuter.x}
          y2={limitOuter.y}
          strokeWidth={3}
          strokeLinecap="round"
          className="stroke-ink"
        />
      )}

      <text
        x={CX}
        y={CY - 4}
        textAnchor="middle"
        dominantBaseline="middle"
        className="fill-ink font-mono text-[36px] font-medium"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {formatScreenTime(minutes)}
      </text>
      <text x={CX} y={CY + 27} textAnchor="middle" className="fill-ink-soft font-sans text-[11px]">
        screen time today
      </text>
    </svg>
  );
}
