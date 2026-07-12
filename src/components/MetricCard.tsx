import type { ReactNode } from "react";

interface MetricCardProps {
  label: string;
  value: string;
  subtext?: string;
  accent?: "ink" | "moss" | "ember" | "gold";
  emphasis?: boolean;
}

const accentTextClass: Record<NonNullable<MetricCardProps["accent"]>, string> = {
  ink: "text-ink",
  moss: "text-moss",
  ember: "text-ember",
  gold: "text-gold",
};

export default function MetricCard({ label, value, subtext, accent = "ink", emphasis = false }: MetricCardProps) {
  return (
    <div
      className={`rounded-xl border border-paper-dim bg-white p-5 shadow-sm ${
        emphasis ? "ring-1 ring-ember/30" : ""
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-slate">{label}</p>
      <p className={`mt-2 font-mono-num text-2xl font-semibold leading-tight ${accentTextClass[accent]}`}>
        {value}
      </p>
      {subtext && <p className="mt-1.5 text-xs leading-relaxed text-slate">{subtext}</p>}
    </div>
  );
}

/** Lightweight wrapper for the FIRE Gap card, which needs a sentence rather than a single value. */
export function GapSummaryCard({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-ember/20 bg-ember/5 p-5 shadow-sm sm:col-span-2 lg:col-span-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-ember">FIRE gap</p>
      <p className="mt-2 font-display text-lg leading-snug text-ink">{children}</p>
    </div>
  );
}
