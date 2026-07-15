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

  it('has the same key set in every language (no missing translations)', () => {
    const huKeys = Object.keys(translations.hu).sort();
    for (const lang of ['en', 'de'] as const) {
      const keys = Object.keys(translations[lang]).sort();
      expect(keys, `${lang} key set differs from hu`).toEqual(huKeys);
    }
  });

  it('falls back to the key for missing entries', () => {
    expect(makeT('en')('does.not.exist')).toBe('does.not.exist');
  });

  it('maps each language to a locale', () => {
    expect(LOCALES.hu).toBe('hu-HU');
    expect(LOCALES.en).toBe('en-GB');
    expect(LOCALES.de).toBe('de-DE');
  });

  it('translates German', () => {
    expect(makeT('de')('common.free')).toBe('Frei');
    expect(makeT('de')('status.book_now')).toBe('Jetzt buchen');
    expect(makeT('de')('admin.rooms_manage')).toBe('Räume verwalten');
  });
});
