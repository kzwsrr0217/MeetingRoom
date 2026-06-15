import { useState } from 'react';
import type { RoomStatus } from '../hooks/useRoomStatus';
import { Header } from './Header';
import { StatusCard } from './StatusCard';
import { MeetingDetails } from './MeetingDetails';
import { Timeline } from './Timeline';

interface Props {
  status: RoomStatus;
  roomName: string;
  onBookRoom: (durationMinutes: number, organizer: string, startTime?: Date) => Promise<boolean>;
}

export const RoomDisplay = ({ status, roomName, onBookRoom }: Props) => {
  const [showOtherRooms, setShowOtherRooms] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const HOME_ROOM = 'MMH Séd';

  const allRooms = ['MMH Séd', 'MMH Balaton', 'MMH Mars', 'MMH Tihany', 'MMH Bakony', 'MMH Kis Balaton'];
  const otherRooms = allRooms.filter(name => name !== roomName);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleBookNow = async () => {
    showToast('Kapcsolódás az Outlookhoz...', 'success');
    try {
      const success = await onBookRoom(15, 'Tablet Felhasználó');
      showToast(success ? 'Sikeres azonnali foglalás!' : 'A terem már foglalt!', success ? 'success' : 'error');
    } catch {
      showToast('Hálózati hiba! Ellenőrizd a backendet.', 'error');
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-900 antialiased relative overflow-hidden">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-20 left-1/2 -translate-x-1/2 z-200 px-10 py-6 rounded-3xl shadow-2xl border-2 animate-in slide-in-from-top duration-500 backdrop-blur-md ${
          toast.type === 'success' ? 'bg-green-600/90 border-green-400' : 'bg-red-600/90 border-red-400'
        }`}>
          <p className="text-white text-2xl font-black uppercase tracking-tighter">{toast.msg}</p>
        </div>
      )}

      {/* Ambient glow */}
      <div className={`absolute inset-0 pointer-events-none opacity-20 transition-colors duration-1000 ${
        status.isOccupied
          ? 'shadow-[inset_0_0_150px_rgba(239,68,68,0.8)]'
          : 'shadow-[inset_0_0_150px_rgba(34,197,94,0.8)]'
      }`} />

      {/* Other rooms button */}
      <button
        onClick={() => setShowOtherRooms(true)}
        className="absolute top-24 right-8 z-20 px-6 py-4 bg-gray-800/80 backdrop-blur-md border border-gray-700 text-gray-200 rounded-2xl font-bold hover:bg-gray-700 shadow-xl active:scale-95 transition-transform"
      >
        Tárgyalók Állapota
      </button>

      {/* Main layout */}
      <div className={`grow flex justify-between p-12 pr-20 border-l-16 transition-colors duration-500 ${
        status.isOccupied ? 'border-red-600' : 'border-green-600'
      }`}>
        <div className="flex flex-col justify-start max-w-4xl z-10">
          <Header />
          <div className="mt-12 mb-auto">
            <span className="text-blue-500 font-black uppercase tracking-[0.3em] text-sm">Helyszín</span>
            <h2 className="text-7xl font-black text-white tracking-tighter uppercase leading-none">{roomName}</h2>
          </div>
          <MeetingDetails status={status} />
        </div>

        <div className="flex flex-col justify-center min-w-105 z-10">
          <StatusCard
            status={status}
            onBookNow={handleBookNow}
            onCheckIn={() => showToast('Sikeres Check-in!', 'success')}
          />
        </div>
      </div>

      <Timeline
        roomId={roomName}
        currentStatus={status}
        onBookRoom={onBookRoom}
        onToast={showToast}
      />

      {/* Modal: Other rooms */}
      {showOtherRooms && (
        <div
          className="fixed inset-0 bg-black/95 backdrop-blur-3xl z-100 p-16 flex flex-col"
          onClick={() => setShowOtherRooms(false)}
        >
          <div className="max-w-6xl mx-auto w-full" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-12">
              <h2 className="text-6xl font-black text-white uppercase">MMH Tárgyalók</h2>
              <button onClick={() => setShowOtherRooms(false)} className="text-7xl text-gray-600 hover:text-white">&times;</button>
            </div>
            <div className="grid grid-cols-2 gap-6">
              {otherRooms.map(name => (
                <div
                  key={name}
                  onClick={() => { window.location.search = `?room=${encodeURIComponent(name)}`; }}
                  className={`p-8 border rounded-4xl flex justify-between items-center transition-all cursor-pointer group ${
                    name === HOME_ROOM
                      ? 'bg-blue-900/20 border-blue-500'
                      : 'bg-gray-800/40 border-gray-700 hover:border-gray-500'
                  }`}
                >
                  <p className="text-3xl font-black text-white group-hover:text-blue-400">{name}</p>
                  <div className="px-6 py-3 bg-gray-700 text-white font-black rounded-xl text-xs uppercase">Megtekintés</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
