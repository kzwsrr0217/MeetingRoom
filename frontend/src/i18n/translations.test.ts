import { describe, it, expect } from 'vitest';
import { makeT, translations, LOCALES } from './translations';

describe('i18n makeT', () => {
  it('returns Hungarian strings for hu', () => {
    const t = makeT('hu');
    expect(t('common.free')).toBe('Szabad');
    expect(t('status.book_now')).toBe('Azonnali foglalás');
  });

  it('returns English strings for en', () => {
    const t = makeT('en');
    expect(t('common.free')).toBe('Free');
    expect(t('status.book_now')).toBe('Book now');
  });

  it('interpolates {placeholders}', () => {
    expect(makeT('en')('room.minutes_left', { n: 5 })).toBe('5 min left');
    expect(makeT('hu')('app.returning_in', { s: 42 })).toBe('Visszatérés 42s múlva');
  });

  it('falls back to Hungarian, then the key, for missing entries', () => {
    // every en key should exist in hu too (no orphan keys)
    for (const key of Object.keys(translations.en)) {
      expect(translations.hu[key], `hu missing key ${key}`).toBeDefined();
    }
    expect(makeT('en')('does.not.exist')).toBe('does.not.exist');
  });

  it('maps each language to a locale', () => {
    expect(LOCALES.hu).toBe('hu-HU');
    expect(LOCALES.en).toBe('en-GB');
  });
});
