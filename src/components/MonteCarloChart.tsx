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
import type { MonteCarloChartPoint } from "../types/fire";
import { formatCurrencyCompact, formatCurrency } from "../lib/formatters";
import { FIRE_TARGET_STYLE } from "../lib/returnPathStyles";

interface MonteCarloChartProps {
  chartPaths: MonteCarloChartPoint[];
  currentAge: number;
  numSimulations: number;
}

/**
 * Monte Carlo percentile band colors. Deliberately distinct from the
 * deterministic chart's conservative/base/optimistic palette (orange/blue/
 * green) since these represent a fundamentally different thing — a
 * cross-sectional percentile of thousands of random simulated outcomes at
 * each point in time, not three fixed return assumptions. Using the same
 * three colors here would visually imply "10th percentile = conservative
 * path," which isn't the same claim at all.
 */
const P90_COLOR = "#0e7490"; // teal, the optimistic edge of the simulated band
const P50_COLOR = "#0f1b2d"; // ink, the median/typical outcome
const P10_COLOR = "#b45309"; // amber, the pessimistic edge of the simulated band

const LABELS: Record<string, string> = {
  p90: "90th percentile (relatively lucky)",
  p50: "Median (50th percentile)",
  p10: "10th percentile (relatively unlucky)",
  fireTarget: FIRE_TARGET_STYLE.label,
};

const COLORS: Record<string, string> = {
  p90: P90_COLOR,
  p50: P50_COLOR,
  p10: P10_COLOR,
  fireTarget: FIRE_TARGET_STYLE.color,
};

interface TooltipPayloadEntry {
  dataKey?: string | number;
  value?: number;
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayloadEntry[]; label?: number }) {
  if (!active || !payload || payload.length === 0) return null;

  const order = ["p90", "p50", "p10", "fireTarget"];
  const ordered = order
    .map((key) => payload.find((entry) => entry.dataKey === key))
    .filter((entry): entry is TooltipPayloadEntry => Boolean(entry));

  return (
    <div className="rounded-lg border border-paper-dim bg-white px-3 py-2 text-xs shadow-md">
      <p className="mb-1.5 font-medium text-ink">Age {label !== undefined ? Math.round(label) : ""}</p>
      <div className="space-y-1">
        {ordered.map((entry) => {
          const key = String(entry.dataKey);
          return (
            <div key={key} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-slate">
                <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[key] }} />
                {LABELS[key]}
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

export default function MonteCarloChart({ chartPaths, currentAge, numSimulations }: MonteCarloChartProps) {
  const sampled = downsample(chartPaths, 90);

  return (
    <div className="rounded-xl border border-paper-dim bg-white p-5 shadow-sm">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate">
        Monte Carlo simulation — {numSimulations.toLocaleString()} simulated outcomes
      </p>
      <div className="h-80 w-full sm:h-96">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={sampled} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="mcBandFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={P50_COLOR} stopOpacity={0.12} />
                <stop offset="100%" stopColor={P50_COLOR} stopOpacity={0.02} />
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
            <Tooltip content={<ChartTooltip />} />
            <Legend
              formatter={(value) => LABELS[String(value)] ?? String(value)}
              wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            />
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
              dataKey="p90"
              name="p90"
              stroke={P90_COLOR}
              strokeWidth={1.75}
              strokeDasharray="2 3"
              dot={false}
              isAnimationActive
              animationDuration={500}
            />
            <Area
              type="monotone"
              dataKey="p50"
              name="p50"
              stroke={P50_COLOR}
              strokeWidth={3}
              fill="url(#mcBandFill)"
              isAnimationActive
              animationDuration={500}
            />
            <Line
              type="monotone"
              dataKey="p10"
              name="p10"
              stroke={P10_COLOR}
              strokeWidth={1.75}
              strokeDasharray="2 3"
              dot={false}
              isAnimationActive
              animationDuration={500}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-3 text-xs text-slate">
        Starting at age {Math.round(currentAge)}. Each of the {numSimulations.toLocaleString()} simulated runs draws
        a different random sequence of annual returns around your expected return, using your chosen volatility.
        The teal line shows a relatively lucky outcome (90th percentile), the dark line shows the median run, and
        the amber line shows a relatively unlucky outcome (10th percentile) — at every age, not just at the end.
        This is a simplified model of risk, not a forecast: real returns aren't perfectly random or independent
        year to year.
      </p>
    </div>
  );
}

function downsample(points: MonteCarloChartPoint[], maxPoints: number): MonteCarloChartPoint[] {
  if (points.length <= maxPoints) return points;
  const step = Math.ceil(points.length / maxPoints);
  const result: MonteCarloChartPoint[] = [];
  for (let i = 0; i < points.length; i += step) {
    result.push(points[i]);
  }
  const last = points[points.length - 1];
  if (result[result.length - 1] !== last) {
    result.push(last);
  }
  return result;
}
