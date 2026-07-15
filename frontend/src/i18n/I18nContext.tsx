import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { type Lang, makeT, LOCALES } from './translations';

const STORAGE_KEY_LANG = 'meetingroom_lang';

interface I18nValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  locale: string;
}

// Default value is a working Hungarian translator, so components render correctly
// even when used outside a provider (e.g. in unit tests) — no wrapper required.
const defaultValue: I18nValue = { lang: 'hu', setLang: () => {}, t: makeT('hu'), locale: LOCALES.hu };

const I18nCtx = createContext<I18nValue>(defaultValue);

export const I18nProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY_LANG) : null;
    return saved === 'en' || saved === 'hu' ? saved : 'hu';
  });

  const setLang = (l: Lang) => {
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY_LANG, l);
    setLangState(l);
  };

  const value = useMemo<I18nValue>(() => ({ lang, setLang, t: makeT(lang), locale: LOCALES[lang] }), [lang]);

  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
};

export const useI18n = () => useContext(I18nCtx);
