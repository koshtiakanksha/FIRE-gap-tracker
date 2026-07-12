import type { FireInputs, ValidationError } from "../types/fire";

interface InputPanelProps {
  inputs: FireInputs;
  errors: ValidationError[];
  onChange: (next: FireInputs) => void;
}

interface FieldConfig {
  key: keyof FireInputs;
  label: string;
  helperText: string;
  prefix?: string;
  suffix?: string;
  step?: number;
  min?: number;
  max?: number;
}

const requiredFields: FieldConfig[] = [
  { key: "currentAge", label: "Current age", helperText: "Your age today.", step: 1, min: 0 },
  { key: "targetFireAge", label: "Target FIRE age", helperText: "The age you'd like to reach financial independence.", step: 1, min: 0 },
  { key: "currentAssets", label: "Current invested assets", helperText: "Total of brokerage, retirement, and other invested accounts.", prefix: "$", step: 1000, min: 0 },
  { key: "annualExpenses", label: "Annual expenses", helperText: "What you spend in a typical year, today's dollars.", prefix: "$", step: 1000, min: 0 },
  { key: "monthlyInvestment", label: "Monthly investment", helperText: "How much you invest each month right now.", prefix: "$", step: 50, min: 0 },
  { key: "expectedReturnPct", label: "Expected annual return", helperText: "Long-run average, after fees. Many use 6–8%.", suffix: "%", step: 0.5 },
  { key: "safeWithdrawalRatePct", label: "Safe withdrawal rate", helperText: "Annual % of your portfolio you plan to withdraw. 4% is a common default.", suffix: "%", step: 0.1, min: 0.1 },
  { key: "inflationPct", label: "Inflation rate", helperText: "Used to grow your expenses over time. 3% is a common long-run estimate.", suffix: "%", step: 0.1, min: 0, max: 10 },
];

const optionalFields: FieldConfig[] = [
  { key: "annualIncome", label: "Annual income", helperText: "Not used in calculations yet — for your own reference.", prefix: "$", step: 1000, min: 0 },
];

export default function InputPanel({ inputs, errors, onChange }: InputPanelProps) {
  const errorFor = (field: keyof FireInputs) => errors.find((e) => e.field === field)?.message;

  function handleNumberChange(field: keyof FireInputs, raw: string) {
    if (raw === "") {
      onChange({ ...inputs, [field]: NaN });
      return;
    }
    const value = Number(raw);
    onChange({ ...inputs, [field]: value });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-ink">Your numbers</h2>
        <p className="mt-1 text-sm text-slate">Eight inputs. That's the whole plan.</p>
      </div>

      <div className="space-y-4">
        {requiredFields.map((field) => (
          <FieldInput
            key={field.key}
            field={field}
            value={inputs[field.key] as number}
            error={errorFor(field.key)}
            onChange={(raw) => handleNumberChange(field.key, raw)}
          />
        ))}
      </div>

      <div className="border-t border-paper-dim pt-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate">Optional</p>
        <div className="space-y-4">
          {optionalFields.map((field) => (
            <FieldInput
              key={field.key}
              field={field}
              value={(inputs[field.key] as number | undefined) ?? NaN}
              error={errorFor(field.key)}
              onChange={(raw) => handleNumberChange(field.key, raw)}
              allowEmpty
            />
          ))}

          <div className="rounded-lg bg-paper-dim/60 px-3 py-2.5">
            <p className="text-xs text-slate">
              <span className="font-medium text-ink">Today's vs. future dollars:</span> today's dollars show value
              in current spending power. Future dollars include inflation and estimate how much the same lifestyle
              may cost later.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function FieldInput({
  field,
  value,
  error,
  onChange,
  allowEmpty = false,
}: {
  field: FieldConfig;
  value: number;
  error?: string;
  onChange: (raw: string) => void;
  allowEmpty?: boolean;
}) {
  const displayValue = Number.isNaN(value) ? "" : value.toString();

  return (
    <div>
      <label htmlFor={field.key} className="mb-1.5 block text-sm font-medium text-ink">
        {field.label}
      </label>
      <div className="relative">
        {field.prefix && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-mono-num text-slate">
            {field.prefix}
          </span>
        )}
        <input
          id={field.key}
          type="number"
          inputMode="decimal"
          step={field.step ?? 1}
          min={field.min}
          max={field.max}
          value={displayValue}
          onChange={(e) => onChange(e.target.value)}
          placeholder={allowEmpty ? "Optional" : undefined}
          aria-invalid={Boolean(error)}
          aria-describedby={`${field.key}-helper`}
          className={`w-full rounded-lg border bg-white px-3 py-2.5 font-mono-num text-sm text-ink shadow-sm transition-colors focus-visible:outline-none ${
            field.prefix ? "pl-7" : ""
          } ${field.suffix ? "pr-9" : ""} ${
            error ? "border-ember" : "border-paper-dim hover:border-slate/40"
          }`}
        />
        {field.suffix && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-mono-num text-slate">
            {field.suffix}
          </span>
        )}
      </div>
      {error ? (
        <p className="mt-1.5 text-xs text-ember">{error}</p>
      ) : (
        <p id={`${field.key}-helper`} className="mt-1.5 text-xs text-slate">
          {field.helperText}
        </p>
      )}
    </div>
  );
}
