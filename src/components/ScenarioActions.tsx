import { useRef, useState } from "react";
import type { FireInputs } from "../types/fire";
import { downloadScenarioAsJson, parseScenarioJson, SAMPLE_INPUTS } from "../lib/scenarioStorage";

interface ScenarioActionsProps {
  inputs: FireInputs;
  onApplyInputs: (inputs: FireInputs) => void;
}

export default function ScenarioActions({ inputs, onApplyInputs }: ScenarioActionsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);

  function handleReset() {
    onApplyInputs(SAMPLE_INPUTS);
    setImportError(null);
    setImportSuccess(false);
  }

  function handleExport() {
    downloadScenarioAsJson(inputs);
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      const result = parseScenarioJson(text);
      if (result.success) {
        onApplyInputs(result.inputs);
        setImportError(null);
        setImportSuccess(true);
        window.setTimeout(() => setImportSuccess(false), 3000);
      } else {
        setImportError(result.error);
        setImportSuccess(false);
      }
    };
    reader.onerror = () => {
      setImportError("Couldn't read that file. Please try again.");
    };
    reader.readAsText(file);
  }

  return (
    <div className="rounded-xl border border-paper-dim bg-white p-5 shadow-sm">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate">Scenario</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleReset}
          className="rounded-lg border border-paper-dim px-3 py-2 text-sm font-medium text-ink transition-colors hover:border-slate/40 hover:bg-paper-dim/40"
        >
          Reset to sample
        </button>
        <button
          type="button"
          onClick={handleExport}
          className="rounded-lg border border-paper-dim px-3 py-2 text-sm font-medium text-ink transition-colors hover:border-slate/40 hover:bg-paper-dim/40"
        >
          Download as JSON
        </button>
        <button
          type="button"
          onClick={handleImportClick}
          className="rounded-lg border border-paper-dim px-3 py-2 text-sm font-medium text-ink transition-colors hover:border-slate/40 hover:bg-paper-dim/40"
        >
          Import scenario
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          onChange={handleFileSelected}
          className="hidden"
          aria-hidden="true"
        />
      </div>

      <p className="mt-3 text-xs text-slate">Your inputs save automatically in this browser as you type.</p>

      {importError && (
        <p className="mt-2 rounded-lg bg-ember/10 px-3 py-2 text-xs text-ember" role="alert">
          {importError}
        </p>
      )}
      {importSuccess && (
        <p className="mt-2 rounded-lg bg-moss/10 px-3 py-2 text-xs text-moss" role="status">
          Scenario imported.
        </p>
      )}
    </div>
  );
}
