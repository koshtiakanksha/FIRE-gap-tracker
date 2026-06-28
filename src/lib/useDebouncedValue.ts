import { useEffect, useState } from "react";

/**
 * Returns a debounced copy of `value` that only updates after `delayMs`
 * has passed without `value` changing again.
 *
 * Used to keep the Monte Carlo simulation and sensitivity analysis (both
 * meaningfully more expensive than the deterministic dashboard — Monte
 * Carlo alone runs hundreds of multi-decade month-by-month simulations)
 * from re-running on every keystroke while someone is actively editing an
 * input. The deterministic dashboard above stays instant; these two
 * sections settle a brief moment after typing stops instead.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timeoutId);
  }, [value, delayMs]);

  return debounced;
}
