import { formatScreenTime, screenTimeFillFraction, screenTimeLevel } from "@/lib/screentime";

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

function polar(angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: CX + R * Math.cos(rad), y: CY + R * Math.sin(rad) };
}

function arcPath(startAngle: number, endAngle: number) {
  const start = polar(startAngle);
  const end = polar(endAngle);
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
  const origin = polar(START_ANGLE);

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
