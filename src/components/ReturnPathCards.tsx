import type { ReturnPathResult } from "../types/fire";
import { formatPathFireAge, formatYears } from "../lib/formatters";

interface ReturnPathCardsProps {
  conservative: ReturnPathResult;
  base: ReturnPathResult;
  optimistic: ReturnPathResult;
  currentAge: number;
}

const PATH_META = {
  conservative: {
    title: "Conservative",
    sub: "Return − 2 points",
    accentClass: "border-slate/25 bg-slate/5",
    valueClass: "text-slate",
  },
  base: {
    title: "Base",
    sub: "Your expected return",
    accentClass: "border-moss/30 bg-moss/5",
    valueClass: "text-moss",
  },
  optimistic: {
    title: "Optimistic",
    sub: "Return + 2 points",
    accentClass: "border-gold/30 bg-gold/5",
    valueClass: "text-gold",
  },
} as const;

export default function ReturnPathCards({ conservative, base, optimistic, currentAge }: ReturnPathCardsProps) {
  const paths = [conservative, base, optimistic];

  return (
    <section>
      <div className="mb-4">
        <h2 className="font-display text-xl font-semibold text-ink">FIRE age range</h2>
        <p className="mt-1 text-sm text-slate">
          One return assumption rarely holds for 20+ years. Here's how your FIRE age shifts across a realistic
          range.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {paths.map((result) => {
          const meta = PATH_META[result.path];
          return (
            <div key={result.path} className={`rounded-xl border p-5 shadow-sm ${meta.accentClass}`}>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate">{meta.title}</p>
              <p className="mt-0.5 text-xs text-slate">
                {meta.sub} ({result.annualReturnPct.toFixed(1)}%)
              </p>
              <p className={`mt-3 font-mono-num text-2xl font-semibold leading-tight ${meta.valueClass}`}>
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
