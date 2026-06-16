import { STORAGE_KEY_HOME_ROOM } from '../config';
import { useRoomNames } from '../hooks/useRooms';

export const SetupScreen = () => {
  const rooms = useRoomNames();

  const handleSelect = (room: string) => {
    localStorage.setItem(STORAGE_KEY_HOME_ROOM, room);
    window.location.href = '/';
  };

  return (
    <div className="h-screen w-screen bg-gray-950 flex flex-col items-center justify-center p-16 select-none">
      <span className="text-blue-500 font-black uppercase tracking-[0.3em] text-sm mb-6">
        Első beállítás
      </span>
      <h1 className="text-6xl font-black text-white text-center leading-tight mb-4">
        Melyik tárgyaló<br />ez a kioszk?
      </h1>
      <p className="text-gray-500 text-xl mb-16 text-center max-w-lg">
        Válassza ki a kioszk fizikai helyszínét. Ez lesz az alapértelmezett nézet.
      </p>
      <div className="grid grid-cols-2 gap-5 max-w-2xl w-full">
        {rooms.map(room => (
          <button
            key={room}
            onClick={() => handleSelect(room)}
            className="p-8 bg-gray-800 border-2 border-gray-700 rounded-[2rem] text-3xl font-black text-white hover:border-blue-500 hover:bg-gray-700 active:scale-95 transition-all"
          >
            {room}
          </button>
        ))}
      </div>
    </div>
  );
};
