import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import type { CombinedProjectionPoint } from "../types/fire";
import { formatCurrencyCompact, formatCurrency } from "../lib/formatters";

interface GrowthChartProps {
  combinedProjection: CombinedProjectionPoint[];
  currentAge: number;
}

const SERIES_LABELS: Record<string, string> = {
  conservative: "Conservative",
  base: "Base",
  optimistic: "Optimistic",
  fireTarget: "FIRE number (future $)",
};

export default function GrowthChart({ combinedProjection, currentAge }: GrowthChartProps) {
  // Down-sample for the chart so we're not plotting hundreds of points on
  // mobile, while keeping every line visually smooth.
  const sampled = downsample(combinedProjection, 90);

  return (
    <div className="rounded-xl border border-paper-dim bg-white p-5 shadow-sm">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate">Projected portfolio growth</p>
        <span className="hidden items-center gap-1.5 text-xs text-slate sm:flex">
          <span className="inline-block h-0.5 w-4 bg-gold" />
          FIRE number (future $, inflation-adjusted)
        </span>
      </div>
      <div className="h-80 w-full sm:h-96">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={sampled} margin={{ top: 16, right: 12, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="baseFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#5b7b6b" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#5b7b6b" stopOpacity={0.02} />
              </linearGradient>
            </defs>
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
            <Tooltip
              formatter={(value, name) => [formatCurrency(Number(value)), SERIES_LABELS[String(name)] ?? String(name)]}
              labelFormatter={(age) => `Age ${Math.round(Number(age))}`}
              contentStyle={{
                borderRadius: 10,
                border: "1px solid #f0ebe0",
                fontSize: 12,
                fontFamily: "Inter, sans-serif",
              }}
            />
            <Legend
              formatter={(value) => SERIES_LABELS[String(value)] ?? String(value)}
              wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            />
            {/* Base case gets a soft fill since it's the "headline" path; conservative/optimistic are lines only, so the fill doesn't visually compete with them. */}
            <Area
              type="monotone"
              dataKey="base"
              name="base"
              stroke="#5b7b6b"
              strokeWidth={2.5}
              fill="url(#baseFill)"
              isAnimationActive
              animationDuration={600}
            />
            <Line
              type="monotone"
              dataKey="conservative"
              name="conservative"
              stroke="#5c6b7a"
              strokeWidth={1.75}
              strokeDasharray="5 4"
              dot={false}
              isAnimationActive
              animationDuration={600}
            />
            <Line
              type="monotone"
              dataKey="optimistic"
              name="optimistic"
              stroke="#5b7b6b"
              strokeWidth={1.75}
              strokeOpacity={0.55}
              dot={false}
              isAnimationActive
              animationDuration={600}
            />
            <Line
              type="monotone"
              dataKey="fireTarget"
              name="fireTarget"
              stroke="#c9a24b"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
              isAnimationActive
              animationDuration={600}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-xs text-slate sm:hidden">Dashed gold line marks your inflation-adjusted FIRE number.</p>
      <p className="mt-2 text-xs text-slate">
        Starting at age {Math.round(currentAge)}. The shaded line is your base-case return; the lighter lines show a
        conservative path (2 points lower) and an optimistic path (2 points higher). The dashed gold line is your
        FIRE number restated in future dollars — it climbs because expenses are assumed to inflate, not because the
        bar moves arbitrarily. Real markets move in fits and starts; these are average paths, not guarantees.
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
