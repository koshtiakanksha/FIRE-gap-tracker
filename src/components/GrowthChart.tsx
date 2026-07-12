import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import type { ProjectionPoint } from "../types/fire";
import { formatCurrencyCompact, formatCurrency } from "../lib/formatters";

interface GrowthChartProps {
  projection: ProjectionPoint[];
  fireNumber: number;
  currentAge: number;
}

export default function GrowthChart({ projection, fireNumber, currentAge }: GrowthChartProps) {
  // Down-sample for the chart so we're not plotting hundreds of points on
  // mobile, while keeping the line visually smooth.
  const sampled = downsample(projection, 80);

  return (
    <div className="rounded-xl border border-paper-dim bg-white p-5 shadow-sm">
      <div className="mb-1 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate">Projected portfolio growth</p>
        <span className="hidden items-center gap-1.5 text-xs text-slate sm:flex">
          <span className="inline-block h-0.5 w-4 bg-gold" />
          FIRE number
        </span>
      </div>
      <div className="h-72 w-full sm:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={sampled} margin={{ top: 16, right: 12, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="portfolioFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#5b7b6b" stopOpacity={0.28} />
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
              formatter={(value) => [formatCurrency(Number(value)), "Portfolio value"]}
              labelFormatter={(age) => `Age ${Math.round(Number(age))}`}
              contentStyle={{
                borderRadius: 10,
                border: "1px solid #f0ebe0",
                fontSize: 12,
                fontFamily: "Inter, sans-serif",
              }}
            />
            <ReferenceLine
              y={isFinite(fireNumber) ? fireNumber : undefined}
              stroke="#c9a24b"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              label={{
                value: "FIRE number",
                position: "insideTopRight",
                fontSize: 11,
                fill: "#c9a24b",
                fontWeight: 600,
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#5b7b6b"
              strokeWidth={2.5}
              fill="url(#portfolioFill)"
              isAnimationActive={true}
              animationDuration={600}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-xs text-slate sm:hidden">Dashed gold line marks your FIRE number.</p>
      <p className="mt-2 text-xs text-slate">
        Starting at age {Math.round(currentAge)}, assuming steady monthly contributions and a constant annual
        return. Real markets move in fits and starts — this line shows the average path, not a guarantee.
      </p>
    </div>
  );
}

function downsample(points: ProjectionPoint[], maxPoints: number): ProjectionPoint[] {
  if (points.length <= maxPoints) return points;
  const step = Math.ceil(points.length / maxPoints);
  const result: ProjectionPoint[] = [];
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
