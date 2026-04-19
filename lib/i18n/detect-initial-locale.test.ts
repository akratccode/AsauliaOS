import { describe, it, expect } from 'vitest';
import { detectInitialLocale } from './detect-initial-locale';

describe('detectInitialLocale', () => {
  it('returns exact match for "es"', () => {
    expect(detectInitialLocale('es')).toBe('es');
  });

  it('returns exact match for "en"', () => {
    expect(detectInitialLocale('en')).toBe('en');
  });

  it('matches language prefix "es-AR,es;q=0.9" to "es"', () => {
    expect(detectInitialLocale('es-AR,es;q=0.9')).toBe('es');
  });

  it('matches language prefix "en-US,en;q=0.9" to "en"', () => {
    expect(detectInitialLocale('en-US,en;q=0.9')).toBe('en');
  });

  it('respects q-ordering: highest q wins, unsupported skipped', () => {
    expect(detectInitialLocale('fr;q=0.9,en;q=0.8,es;q=1.0')).toBe('es');
  });

  it('falls through to defaultLocale when none supported', () => {
    expect(detectInitialLocale('fr,de')).toBe('es');
  });

  it('returns defaultLocale for empty string', () => {
    expect(detectInitialLocale('')).toBe('es');
  });

  it('returns defaultLocale for null', () => {
    expect(detectInitialLocale(null)).toBe('es');
  });

  it('returns defaultLocale for undefined', () => {
    expect(detectInitialLocale(undefined)).toBe('es');
  });
});
