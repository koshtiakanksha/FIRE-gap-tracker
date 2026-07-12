import type { ReturnPathResult } from "../types/fire";
import { formatPathFireAge, formatYears } from "../lib/formatters";
import { RETURN_PATH_STYLES } from "../lib/returnPathStyles";

interface ReturnPathCardsProps {
  conservative: ReturnPathResult;
  base: ReturnPathResult;
  optimistic: ReturnPathResult;
  currentAge: number;
}

const PATH_SUBTITLE: Record<ReturnPathResult["path"], string> = {
  conservative: "Return − 2 points",
  base: "Your expected return",
  optimistic: "Return + 2 points",
};

export default function ReturnPathCards({ conservative, base, optimistic, currentAge }: ReturnPathCardsProps) {
  const paths = [conservative, base, optimistic];

  return (
    <section>
      <div className="mb-4">
        <h2 className="font-display text-xl font-semibold text-ink">FIRE age range</h2>
        <p className="mt-1 text-sm text-slate">
          One return assumption rarely holds for 20+ years. Here's how your FIRE age shifts across a realistic
          range — colors match the lines in the chart above.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {paths.map((result) => {
          const style = RETURN_PATH_STYLES[result.path];
          return (
            <div
              key={result.path}
              className="rounded-xl border border-paper-dim bg-white p-5 shadow-sm"
              style={{ borderLeftWidth: 4, borderLeftColor: style.color }}
            >
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate">
                <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: style.color }} />
                {style.label}
              </p>
              <p className="mt-0.5 text-xs text-slate">
                {PATH_SUBTITLE[result.path]} ({result.annualReturnPct.toFixed(1)}%)
              </p>
              <p className="mt-3 font-mono-num text-2xl font-semibold leading-tight" style={{ color: style.color }}>
                {formatPathFireAge(result.timelineStatus, result.estimatedFireAge, currentAge)}
              </p>
              <p className="mt-1.5 text-xs text-slate">
                {result.timelineStatus === "already-fi"
                  ? "Already there at this return."
                  : result.timelineStatus === "unreachable"
                    ? "Not reached within a 100-year projection."
                    : `${formatYears(result.yearsToFire)} from now.`}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
