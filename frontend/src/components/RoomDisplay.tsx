import { useState } from 'react';
import { useRoomStatus, type RoomStatus } from '../hooks/useRoomStatus';
import { useRoomNames } from '../hooks/useRooms';
import { Header } from './Header';
import { StatusCard } from './StatusCard';
import { MeetingDetails } from './MeetingDetails';
import { Timeline } from './Timeline';
import { BookingModal } from './BookingModal';

const fmt = (iso: string) =>
  new Date(iso).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });

// Horizontal strip showing upcoming meetings — always visible above the timeline
const UpcomingStrip = ({ schedule }: { schedule: RoomStatus['schedule'] }) => {
  const now = Date.now();
  const upcoming = schedule
    .filter(e => new Date(e.start).getTime() > now)
    .filter(e => new Date(e.start).getTime() - now < 5 * 60 * 60 * 1000)
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    .slice(0, 4);

  if (upcoming.length === 0) return null;

  return (
    <div className="shrink-0 px-12 pb-3 flex items-center gap-3 overflow-x-auto scrollbar-none">
      <span className="text-gray-600 text-xs font-bold uppercase tracking-widest shrink-0">
        Következő:
      </span>
      {upcoming.map((e, i) => (
        <div
          key={i}
          className="shrink-0 flex items-center gap-3 px-5 py-2.5 bg-gray-800/60 border border-gray-700/60 rounded-2xl"
        >
          <span className="text-white font-black text-sm tabular-nums">
            {fmt(e.start)}–{fmt(e.end)}
          </span>
          <span className="text-gray-300 text-sm font-medium truncate max-w-48">{e.title}</span>
          <span className="text-gray-500 text-xs truncate max-w-32">{e.organizer}</span>
        </div>
      ))}
    </div>
  );
};

interface Props {
  status: RoomStatus;
  roomName: string;
  homeRoom: string;
  onBookRoom: (durationMinutes: number, organizer: string, title: string, startTime?: Date) => Promise<string | null>;
}

// Live status card shown in the "other rooms" modal
const OtherRoomCard = ({
  name,
  homeRoom,
  onClick,
}: {
  name: string;
  homeRoom: string;
  onClick: () => void;
}) => {
  const { status } = useRoomStatus(name, 15000);

  const occupied = status?.isOccupied ?? null;
  const endTime = status?.currentMeetingEnd ? new Date(status.currentMeetingEnd) : null;
  const minutesLeft = endTime
    ? Math.max(0, Math.ceil((endTime.getTime() - Date.now()) / 60000))
    : null;

  return (
    <div
      onClick={onClick}
      className={`p-8 border rounded-4xl flex flex-col gap-3 transition-all cursor-pointer group ${
        name === homeRoom
          ? 'bg-blue-900/20 border-blue-500'
          : occupied === true
          ? 'bg-red-950/20 border-red-800/60 hover:border-red-600'
          : occupied === false
          ? 'bg-green-950/15 border-green-900/40 hover:border-green-700'
          : 'bg-gray-800/40 border-gray-700 hover:border-gray-500'
      }`}
    >
      <div className="flex justify-between items-center">
        <p className="text-3xl font-black text-white group-hover:text-blue-400 transition-colors">
          {name}
        </p>
        <div
          className={`px-6 py-2 font-black rounded-xl text-sm uppercase tracking-wider ${
            occupied === null
              ? 'bg-gray-700 text-gray-400'
              : occupied
              ? 'bg-red-600/80 text-white'
              : 'bg-green-600/80 text-white'
          }`}
        >
          {occupied === null ? '...' : occupied ? 'Foglalt' : 'Szabad'}
        </div>
      </div>

      {/* Meeting detail when occupied */}
      {occupied && status && (
        <div className="text-sm text-gray-400 leading-snug">
          {status.currentMeetingTitle && (
            <p className="text-white/80 font-bold truncate">{status.currentMeetingTitle}</p>
          )}
          {endTime && minutesLeft !== null && (
            <p className="text-orange-400">
              Vége: {endTime.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })}
              {' · még '}{minutesLeft} perc
            </p>
          )}
        </div>
      )}

      {/* Next meeting when free */}
      {occupied === false && status?.nextMeetingStart && (
        <p className="text-sm text-gray-500">
          Köv.:{' '}
          {new Date(status.nextMeetingStart).toLocaleTimeString('hu-HU', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      )}
    </div>
  );
};

export const RoomDisplay = ({ status, roomName, homeRoom, onBookRoom }: Props) => {
  const [showOtherRooms, setShowOtherRooms] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const allRooms = useRoomNames();
  const otherRooms = allRooms.filter(name => name !== roomName);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-900 antialiased relative overflow-hidden select-none">

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

      {/* Top-right controls */}
      <div className="absolute top-6 right-8 z-20 flex items-center gap-3">
        {/* Live pulse dot */}
        <div className="flex items-center gap-2 px-4 py-2 bg-gray-900/60 backdrop-blur-sm rounded-xl border border-gray-700">
          <span className={`w-2.5 h-2.5 rounded-full ${status.isOccupied ? 'bg-red-400' : 'bg-green-400'} animate-pulse`} />
          <span className="text-gray-400 text-xs font-bold uppercase tracking-widest">Élő</span>
        </div>

        {/* Other rooms button */}
        <button
          onClick={() => setShowOtherRooms(true)}
          className="px-6 py-3 bg-gray-800/80 backdrop-blur-md border border-gray-700 text-gray-200 rounded-2xl font-bold hover:bg-gray-700 shadow-xl active:scale-95 transition-transform cursor-pointer"
        >
          Tárgyalók Állapota
        </button>

        {/* Fullscreen button */}
        <button
          onClick={toggleFullscreen}
          title={isFullscreen ? 'Kilépés teljes képernyőből' : 'Teljes képernyő'}
          className="p-3 bg-gray-800/80 backdrop-blur-md border border-gray-700 text-gray-400 rounded-2xl hover:bg-gray-700 hover:text-white active:scale-95 transition-all cursor-pointer"
        >
          {isFullscreen ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4H4m0 5h5m6-5h5v5m0-5h-5m5 15h-5v5m0-5h5M4 15h5v5m-5 0v-5" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          )}
        </button>
      </div>

      {/* Main layout */}
      <div className={`flex-1 min-h-0 flex justify-between p-12 pr-20 border-l-16 transition-colors duration-500 ${
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
            onOpenBookingModal={() => setShowBookingModal(true)}
            onCheckIn={() => showToast('Sikeres Check-in!', 'success')}
          />
        </div>
      </div>

      <UpcomingStrip schedule={status.schedule} />

      <Timeline
        currentStatus={status}
        onBookRoom={onBookRoom}
        onToast={showToast}
      />

      {/* Booking modal — instant booking from StatusCard */}
      <BookingModal
        isOpen={showBookingModal}
        onClose={() => setShowBookingModal(false)}
        onBook={onBookRoom}
        onToast={showToast}
      />

      {/* Modal: other rooms with live status */}
      {showOtherRooms && (
        <div
          className="fixed inset-0 bg-black/95 backdrop-blur-3xl z-100 p-16 flex flex-col"
          onClick={() => setShowOtherRooms(false)}
        >
          <div className="max-w-6xl mx-auto w-full" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-12">
              <h2 className="text-6xl font-black text-white uppercase">MMH Tárgyalók</h2>
              <button
                onClick={() => setShowOtherRooms(false)}
                className="text-7xl text-gray-600 hover:text-white cursor-pointer"
              >
                &times;
              </button>
            </div>
            <div className="grid grid-cols-2 gap-6">
              {otherRooms.map(name => (
                <OtherRoomCard
                  key={name}
                  name={name}
                  homeRoom={homeRoom}
                  onClick={() => {
                    setShowOtherRooms(false);
                    window.location.search = `?room=${encodeURIComponent(name)}`;
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
