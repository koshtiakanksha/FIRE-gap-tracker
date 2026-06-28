/**
 * A small, seedable pseudo-random number generator (mulberry32), used
 * instead of Math.random() for Monte Carlo simulation.
 *
 * Why not Math.random()? Two reasons:
 * 1. Testability — unit tests need a deterministic sequence to assert
 *    against. With Math.random(), the same test would produce different
 *    results on every run, making the Monte Carlo tests either flaky or
 *    so loose ("probability is somewhere between 0 and 100") that they
 *    don't actually catch regressions.
 * 2. Reproducibility for the user — re-running the same scenario with the
 *    same seed reproduces the same percentile paths, which is a nice
 *    property for an "explain this number" debugging session, even though
 *    the production UI re-seeds randomly on every input change so the
 *    simulation still feels alive rather than frozen.
 *
 * This is NOT cryptographically secure and isn't meant to be — it's a fast,
 * good-enough generator for a Monte Carlo simulation, the same category of
 * use case mulberry32 is commonly chosen for.
 */

/** A function that returns the next pseudo-random float in [0, 1). */
export type RandomFn = () => number;

/**
 * Creates a seeded RandomFn using the mulberry32 algorithm. Same seed always
 * produces the same sequence of values.
 */
export function createSeededRandom(seed: number): RandomFn {
  let state = seed >>> 0;
  return function mulberry32(): number {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Draws one sample from a standard normal distribution (mean 0, std dev 1)
 * using the Box-Muller transform, driven by a supplied RandomFn so it's
 * exactly as seedable/testable as everything else in this module.
 */
export function sampleStandardNormal(random: RandomFn): number {
  // Box-Muller needs two uniform samples in (0, 1]; guard against an exact 0
  // from the underlying generator since log(0) is -Infinity.
  let u1 = random();
  if (u1 === 0) u1 = Number.EPSILON;
  const u2 = random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/**
 * Draws one sample from a normal distribution with the given mean and
 * standard deviation, built on sampleStandardNormal.
 */
export function sampleNormal(random: RandomFn, mean: number, stdDev: number): number {
  if (stdDev <= 0) return mean;
  return mean + sampleStandardNormal(random) * stdDev;
}
