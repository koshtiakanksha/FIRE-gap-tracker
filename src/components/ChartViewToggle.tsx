import { useState } from "react";
import type { CombinedProjectionPoint, MonteCarloChartPoint } from "../types/fire";
import GrowthChart from "./GrowthChart";
import MonteCarloChart from "./MonteCarloChart";

interface ChartViewToggleProps {
  combinedProjection: CombinedProjectionPoint[];
  monteCarloChartPaths: MonteCarloChartPoint[];
  numSimulations: number;
  currentAge: number;
}

type ChartView = "range" | "monte-carlo";

/**
 * Switches between the deterministic conservative/base/optimistic chart
 * ("Range view") and the Monte Carlo percentile fan chart ("Monte Carlo
 * view"). Kept as a toggle rather than showing both at once, per the Phase
 * 2 spec's instruction not to clutter the existing chart — a user looking
 * at growth projections sees exactly one chart at a time, by choice.
 */
export default function ChartViewToggle({
  combinedProjection,
  monteCarloChartPaths,
  numSimulations,
  currentAge,
}: ChartViewToggleProps) {
  const [view, setView] = useState<ChartView>("range");

  return (
    <div>
      <div className="mb-3 inline-flex rounded-lg border border-paper-dim bg-white p-1 shadow-sm">
        <ToggleButton active={view === "range"} onClick={() => setView("range")}>
          Range view
        </ToggleButton>
        <ToggleButton active={view === "monte-carlo"} onClick={() => setView("monte-carlo")}>
          Monte Carlo view
        </ToggleButton>
      </div>

      {view === "range" ? (
        <GrowthChart combinedProjection={combinedProjection} currentAge={currentAge} />
      ) : (
        <MonteCarloChart chartPaths={monteCarloChartPaths} currentAge={currentAge} numSimulations={numSimulations} />
      )}
    </div>
  );
}

function ToggleButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
        active ? "bg-ink text-paper" : "text-slate hover:bg-paper-dim/60"
      }`}
    >
      {children}
    </button>
  );
}
