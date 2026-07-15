import { STORAGE_KEY_HOME_ROOM } from '../config';
import { useRooms } from '../hooks/useRooms';
import { useI18n } from '../i18n/I18nContext';
import { LanguageToggle } from './LanguageToggle';

export const SetupScreen = () => {
  const rooms = useRooms();
  const { t } = useI18n();

  // Store the stable room id (not the display name) so renames don't break kiosks.
  const handleSelect = (roomId: string) => {
    localStorage.setItem(STORAGE_KEY_HOME_ROOM, roomId);
    window.location.href = '/';
  };

  return (
    <div className="h-screen w-screen bg-gray-950 flex flex-col items-center justify-center p-16 select-none relative">
      <LanguageToggle className="absolute top-6 right-6" />
      <span className="text-blue-500 font-black uppercase tracking-[0.3em] text-sm mb-6">
        {t('setup.badge')}
      </span>
      <h1 className="text-6xl font-black text-white text-center leading-tight mb-4">
        {t('setup.title')}
      </h1>
      <p className="text-gray-500 text-xl mb-16 text-center max-w-lg">
        {t('setup.subtitle')}
      </p>
      <div className="grid grid-cols-2 gap-5 max-w-2xl w-full">
        {rooms.map(room => (
          <button
            key={room.id}
            onClick={() => handleSelect(room.id)}
            className="p-8 bg-gray-800 border-2 border-gray-700 rounded-[2rem] text-3xl font-black text-white hover:border-blue-500 hover:bg-gray-700 active:scale-95 transition-all"
          >
            {room.name}
          </button>
        ))}
      </div>
    </div>
  );
};
