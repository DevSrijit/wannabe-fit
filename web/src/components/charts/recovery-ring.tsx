import { bandColor, bandLabel } from "@/lib/format";

type Ring = { value: number | null; color: string; label: string };

/**
 * Three concentric rings in the style of the Activity rings. Outer to inner:
 * resting heart rate, sleep performance, blood oxygen. The recovery score sits
 * in the centre. Each ring is a 0 to 100 component of that score.
 */
export function RecoveryRing({ score, band, rings, size = 236 }: { score: number | null; band: string | null; rings: Ring[]; size?: number }) {
  const stroke = 18;
  const gap = 5;
  const cx = size / 2;
  const color = bandColor(band);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        {rings.map((r, i) => {
          const radius = size / 2 - stroke / 2 - 2 - i * (stroke + gap);
          const c = 2 * Math.PI * radius;
          const v = r.value == null ? 0 : Math.max(0, Math.min(100, r.value));
          return (
            <g key={r.label}>
              <circle cx={cx} cy={cx} r={radius} fill="none" stroke={r.color} strokeOpacity={0.22} strokeWidth={stroke} />
              <circle
                cx={cx}
                cy={cx}
                r={radius}
                fill="none"
                stroke={r.color}
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={`${(c * v) / 100} ${c}`}
                style={{ transition: "stroke-dasharray 900ms cubic-bezier(.2,.8,.2,1)" }}
              />
            </g>
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="rounded-num num text-[44px] leading-none" style={{ color }}>
          {score == null ? "–" : Math.round(score)}
        </span>
        <span className="caption text-label-2 mt-1 font-medium">{bandLabel(band)}</span>
      </div>
    </div>
  );
}
