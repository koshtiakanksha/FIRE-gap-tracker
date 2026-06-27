interface ProgressBarProps {
  progressPct: number;
  isAlreadyFi: boolean;
}

export default function ProgressBar({ progressPct, isAlreadyFi }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, progressPct));

  return (
    <div className="rounded-xl border border-paper-dim bg-white p-5 shadow-sm">
      <div className="mb-2.5 flex items-baseline justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate">Progress to FIRE</p>
        <p className="font-mono-num text-sm font-semibold text-ink">
          {isAlreadyFi ? "100%+" : `${clamped.toFixed(1)}%`}
        </p>
      </div>
      <div
        className="h-3 w-full overflow-hidden rounded-full bg-paper-dim"
        role="progressbar"
        aria-valuenow={Math.round(clamped)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progress toward FIRE number"
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-moss to-moss-dim transition-[width] duration-500"
          style={{ width: `${isAlreadyFi ? 100 : clamped}%` }}
        />
      </div>
      <p className="mt-2.5 text-xs text-slate">
        {isAlreadyFi
          ? "Your current assets have already crossed your FIRE number."
          : "Share of your FIRE number covered by current invested assets."}
      </p>
    </div>
  );
}
