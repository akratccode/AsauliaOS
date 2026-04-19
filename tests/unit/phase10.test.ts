import { describe, it, expect } from 'vitest';
import { normalizeContractorWeights } from '@/lib/admin/weights';

describe('normalizeContractorWeights', () => {
  it('returns an empty array for no input', () => {
    expect(normalizeContractorWeights([])).toEqual([]);
  });

  it('assigns 10_000 bps to a single contractor', () => {
    expect(normalizeContractorWeights([7])).toEqual([10_000]);
  });

  it('splits evenly when all weights are equal', () => {
    const out = normalizeContractorWeights([1, 1, 1, 1]);
    expect(out.reduce((s, v) => s + v, 0)).toBe(10_000);
    expect(out).toEqual([2_500, 2_500, 2_500, 2_500]);
  });

  it('splits evenly when all weights are zero (fallback)', () => {
    const out = normalizeContractorWeights([0, 0, 0]);
    expect(out.reduce((s, v) => s + v, 0)).toBe(10_000);
    // 3 contractors, base = 3333, leftover = 1 goes to the first index
    expect(out).toEqual([3_334, 3_333, 3_333]);
  });

  it('respects weight ratios (2:1)', () => {
    const out = normalizeContractorWeights([2, 1]);
    expect(out.reduce((s, v) => s + v, 0)).toBe(10_000);
    expect(out[0]).toBeGreaterThan(out[1]!);
    expect(Math.abs(out[0]! - 6_667)).toBeLessThanOrEqual(1);
  });

  it('treats negative and non-finite inputs as zero', () => {
    const out = normalizeContractorWeights([-1, Infinity, 4, 6]);
    expect(out.reduce((s, v) => s + v, 0)).toBe(10_000);
    expect(out[0]).toBe(0);
    expect(out[1]).toBe(0);
    expect(out[2]! + out[3]!).toBe(10_000);
    expect(out[3]).toBe(6_000);
    expect(out[2]).toBe(4_000);
  });

  it('always sums to exactly 10_000 for fuzzed inputs', () => {
    let seed = 42;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 2 ** 32;
      return seed / 2 ** 32;
    };
    for (let run = 0; run < 200; run++) {
      const n = 1 + Math.floor(rand() * 12);
      const weights = Array.from({ length: n }, () => Math.floor(rand() * 100));
      const out = normalizeContractorWeights(weights);
      expect(out).toHaveLength(n);
      expect(out.reduce((s, v) => s + v, 0)).toBe(10_000);
      for (const v of out) {
        expect(v).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('returns sorted-by-remainder cycling when many equal fractions', () => {
    // three equal weights -> equal split via the non-zero branch
    const out = normalizeContractorWeights([1, 1, 1]);
    expect(out.reduce((s, v) => s + v, 0)).toBe(10_000);
    // One bucket gets the +2 remainder, but all must stay within ±1 of each other.
    const maxDelta = Math.max(...out) - Math.min(...out);
    expect(maxDelta).toBeLessThanOrEqual(1);
  });
});
