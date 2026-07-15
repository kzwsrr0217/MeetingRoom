import { useI18n } from '../i18n/I18nContext';
import type { Lang } from '../i18n/translations';

const LANGS: Lang[] = ['hu', 'en'];

export const LanguageToggle = ({ className = '' }: { className?: string }) => {
  const { lang, setLang } = useI18n();
  return (
    <div className={`flex items-center rounded-xl overflow-hidden border border-gray-700 ${className}`}>
      {LANGS.map(l => (
        <button
          key={l}
          onClick={() => setLang(l)}
          className={`px-3 py-2 text-xs font-black uppercase transition-colors ${
            lang === l ? 'bg-blue-600 text-white' : 'bg-gray-800/80 text-gray-400 hover:text-white'
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
};
