/**
 * Random number generation utilities for the Z-machine interpreter
 */

// Import a cryptographically secure PRNG
import seedrandom from 'seedrandom';

/**
 * The current random number generator function
 */
let rng: () => number;

/**
 * Initialize the random number generator
 *
 * If a seed is provided, creates a deterministic RNG.
 * Otherwise, creates a non-deterministic RNG.
 *
 * @param seed Optional seed string for deterministic generation
 */
export function initRandom(seed?: string): void {
  if (seed) {
    // Use a seeded RNG for deterministic results
    rng = seedrandom(seed);
  } else {
    // Use a non-deterministic RNG
    rng = seedrandom(undefined, { entropy: true });
  }
}

/**
 * Sets a specific seed for the random number generator
 * This allows for predictable sequences of "random" numbers
 *
 * @param seed The seed string to use
 */
export function randomSeed(seed: string): void {
  rng = seedrandom(seed);
}

/**
 * Generates a random integer from 1 to range (inclusive)
 *
 * @param range The upper bound of the random number (inclusive)
 * @returns A random integer in the range [1, range]
 */
export function randomInt(range: number): number {
  // Initialize the RNG if it hasn't been already
  if (!rng) {
    initRandom();
  }

  return Math.floor(rng() * range + 1);
}

/**
 * Generates a random integer from 0 to range-1 (inclusive)
 *
 * @param range The upper bound of the random number (exclusive)
 * @returns A random integer in the range [0, range-1]
 */
export function randomIntFrom0(range: number): number {
  // Initialize the RNG if it hasn't been already
  if (!rng) {
    initRandom();
  }

  return Math.floor(rng() * range);
}

/**
 * Generates a random floating-point number between 0 (inclusive) and 1 (exclusive)
 *
 * @returns A random float in the range [0, 1)
 */
export function random(): number {
  // Initialize the RNG if it hasn't been already
  if (!rng) {
    initRandom();
  }

  return rng();
}

// Initialize the RNG with a non-deterministic seed by default
initRandom();
