import seedrandom from 'seedrandom';

let rng: () => number;

// Initialize with a default seed
initRandom();

export function initRandom(seed?: string): void {
  if (seed) {
    // Use a seeded RNG
    rng = seedrandom(seed);
  } else {
    // Use Math.random as a fallback
    rng = Math.random;
  }
}

export function randomInt(range: number): number {
  return Math.floor(rng() * range + 1);
}
