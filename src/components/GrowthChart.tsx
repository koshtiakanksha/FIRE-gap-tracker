import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import type { CombinedProjectionPoint } from "../types/fire";
import { formatCurrencyCompact, formatCurrency } from "../lib/formatters";
import { RETURN_PATH_STYLES, FIRE_TARGET_STYLE } from "../lib/returnPathStyles";

interface GrowthChartProps {
  combinedProjection: CombinedProjectionPoint[];
  currentAge: number;
}

// dataKey -> style lookup, built once from the shared style map so the chart
// and the FIRE-age cards can never show a path in two different colors.
const SERIES: { dataKey: "conservative" | "base" | "optimistic" | "fireTarget"; label: string; color: string; dashArray?: string; strokeWidth: number }[] = [
  { dataKey: "conservative", ...RETURN_PATH_STYLES.conservative, strokeWidth: 2 },
  { dataKey: "base", ...RETURN_PATH_STYLES.base, strokeWidth: 3 },
  { dataKey: "optimistic", ...RETURN_PATH_STYLES.optimistic, strokeWidth: 2 },
  { dataKey: "fireTarget", ...FIRE_TARGET_STYLE, strokeWidth: 2 },
];

const LABELS_BY_KEY: Record<string, string> = Object.fromEntries(SERIES.map((s) => [s.dataKey, s.label]));
const COLORS_BY_KEY: Record<string, string> = Object.fromEntries(SERIES.map((s) => [s.dataKey, s.color]));

interface TooltipPayloadEntry {
  dataKey?: string | number;
  value?: number;
}

/**
 * Custom tooltip so every line in the chart shows up as its own clearly
 * labeled row — name, swatch color, and value all matching the line it
 * describes, rather than relying on Recharts' default formatting (which
 * doesn't color-code each row to match its line by default).
 */
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayloadEntry[]; label?: number }) {
  if (!active || !payload || payload.length === 0) return null;

  // Keep a consistent row order (conservative, base, optimistic, target)
  // regardless of the order Recharts hands back the payload.
  const ordered = SERIES.map((series) => payload.find((entry) => entry.dataKey === series.dataKey)).filter(
    (entry): entry is TooltipPayloadEntry => Boolean(entry),
  );

  return (
    <div className="rounded-lg border border-paper-dim bg-white px-3 py-2 text-xs shadow-md">
      <p className="mb-1.5 font-medium text-ink">Age {label !== undefined ? Math.round(label) : ""}</p>
      <div className="space-y-1">
        {ordered.map((entry) => {
          const key = String(entry.dataKey);
          return (
            <div key={key} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-slate">
                <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: COLORS_BY_KEY[key] }} />
                {LABELS_BY_KEY[key]}
              </span>
              <span className="font-mono-num font-medium text-ink">
                {entry.value !== undefined ? formatCurrency(entry.value) : "—"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function GrowthChart({ combinedProjection, currentAge }: GrowthChartProps) {
  // Down-sample for the chart so we're not plotting hundreds of points on
  // mobile, while keeping every line visually smooth.
  const sampled = downsample(combinedProjection, 90);

  return (
    <div className="rounded-xl border border-paper-dim bg-white p-5 shadow-sm">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate">Projected portfolio growth</p>
      <div className="h-80 w-full sm:h-96">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={sampled} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 6" stroke="#f0ebe0" vertical={false} />
            <XAxis
              dataKey="age"
              tickFormatter={(age: number) => Math.round(age).toString()}
              tick={{ fontSize: 11, fill: "#5c6b7a" }}
              axisLine={{ stroke: "#f0ebe0" }}
              tickLine={false}
              minTickGap={32}
              label={{ value: "Age", position: "insideBottom", offset: -2, fontSize: 11, fill: "#5c6b7a" }}
            />
            <YAxis
              tickFormatter={(v: number) => formatCurrencyCompact(v)}
              tick={{ fontSize: 11, fill: "#5c6b7a" }}
              axisLine={false}
              tickLine={false}
              width={56}
            />
            <Tooltip content={<ChartTooltip />} />
            <Legend
              formatter={(value) => LABELS_BY_KEY[String(value)] ?? String(value)}
              wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            />
            {/* Render order matters for visual layering: target line first (so it
                sits behind), then conservative/optimistic, then base last so the
                "headline" path draws on top and reads as the primary line. */}
            <Line
              type="monotone"
              dataKey="fireTarget"
              name="fireTarget"
              stroke={FIRE_TARGET_STYLE.color}
              strokeWidth={2}
              strokeDasharray={FIRE_TARGET_STYLE.dashArray}
              dot={false}
              isAnimationActive
              animationDuration={500}
            />
            <Line
              type="monotone"
              dataKey="conservative"
              name="conservative"
              stroke={RETURN_PATH_STYLES.conservative.color}
              strokeWidth={2}
              strokeDasharray={RETURN_PATH_STYLES.conservative.dashArray}
              dot={false}
              isAnimationActive
              animationDuration={500}
            />
            <Line
              type="monotone"
              dataKey="optimistic"
              name="optimistic"
              stroke={RETURN_PATH_STYLES.optimistic.color}
              strokeWidth={2}
              strokeDasharray={RETURN_PATH_STYLES.optimistic.dashArray}
              dot={false}
              isAnimationActive
              animationDuration={500}
            />
            <Line
              type="monotone"
              dataKey="base"
              name="base"
              stroke={RETURN_PATH_STYLES.base.color}
              strokeWidth={3}
              dot={false}
              isAnimationActive
              animationDuration={500}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-3 text-xs text-slate">
        Starting at age {Math.round(currentAge)}. The thick blue line is your base-case return; orange (dashed) is
        conservative, 2 points lower; green (dotted) is optimistic, 2 points higher. The purple dashed line is your
        FIRE number restated in future dollars — it climbs because expenses are assumed to inflate, not because the
        target moves arbitrarily. Real markets move in fits and starts; these are average paths, not guarantees.
      </p>
    </div>
  );
}

function downsample(points: CombinedProjectionPoint[], maxPoints: number): CombinedProjectionPoint[] {
  if (points.length <= maxPoints) return points;
  const step = Math.ceil(points.length / maxPoints);
  const result: CombinedProjectionPoint[] = [];
  for (let i = 0; i < points.length; i += step) {
    result.push(points[i]);
  }
  // Always include the final point so the chart doesn't appear to cut off early.
  const last = points[points.length - 1];
  if (result[result.length - 1] !== last) {
    result.push(last);
  }
  return result;
}
