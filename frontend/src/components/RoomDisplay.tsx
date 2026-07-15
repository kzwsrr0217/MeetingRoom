import { useState } from 'react';
import { useRoomStatus, type RoomStatus } from '../hooks/useRoomStatus';
import { useRooms, type Room } from '../hooks/useRooms';
import { useIdleTimer } from '../hooks/useIdleTimer';
import { useBurnInProtection } from '../hooks/useBurnInProtection';
import { Header } from './Header';
import { StatusCard } from './StatusCard';
import { MeetingDetails } from './MeetingDetails';
import { Timeline } from './Timeline';
import { BookingModal } from './BookingModal';
import { BookFromPhone } from './BookFromPhone';
import { ReportIssueModal } from './ReportIssueModal';
import { LanguageToggle } from './LanguageToggle';
import { useI18n } from '../i18n/I18nContext';

const fmt = (iso: string) =>
  new Date(iso).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });

// Horizontal strip showing upcoming meetings — always visible above the timeline
const UpcomingStrip = ({ schedule }: { schedule: RoomStatus['schedule'] }) => {
  const { t } = useI18n();
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
        {t('room.upcoming')}
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
  roomName: string;   // display name
  roomId: string;     // stable identifier used in URLs / status keys
  homeRoom: string;
  onBookRoom: (durationMinutes: number, organizer: string, title: string, startTime?: Date, isPrivate?: boolean) => Promise<string | null>;
  onCheckIn: () => Promise<string | null>;
  onRelease: () => Promise<string | null>;
  onExtend: (minutes: number) => Promise<string | null>;
}

// Live status card shown in the "other rooms" modal
const OtherRoomCard = ({
  room,
  homeRoom,
  onClick,
}: {
  room: Room;
  homeRoom: string;
  onClick: () => void;
}) => {
  const { t } = useI18n();
  const { status } = useRoomStatus(room.id, 15000);
  const isHome = room.id === homeRoom || room.name === homeRoom;

  const occupied = status?.isOccupied ?? null;
  const endTime = status?.currentMeetingEnd ? new Date(status.currentMeetingEnd) : null;
  const minutesLeft = endTime
    ? Math.max(0, Math.ceil((endTime.getTime() - Date.now()) / 60000))
    : null;

  return (
    <div
      onClick={onClick}
      className={`p-8 border rounded-4xl flex flex-col gap-3 transition-all cursor-pointer group ${
        isHome
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
          {room.name}
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
          {occupied === null ? '...' : occupied ? t('common.occupied') : t('common.free')}
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
              {t('room.ends')} {endTime.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })}
              {' · '}{t('room.minutes_left', { n: minutesLeft })}
            </p>
          )}
        </div>
      )}

      {/* Next meeting when free */}
      {occupied === false && status?.nextMeetingStart && (
        <p className="text-sm text-gray-500">
          {t('room.next_short')}{' '}
          {new Date(status.nextMeetingStart).toLocaleTimeString('hu-HU', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      )}
    </div>
  );
};

export const RoomDisplay = ({ status, roomName, roomId, homeRoom, onBookRoom, onCheckIn, onRelease, onExtend }: Props) => {
  const { t } = useI18n();
  const [showOtherRooms, setShowOtherRooms] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const { isIdle, reset: wakeUp } = useIdleTimer(3 * 60 * 1000);
  const burnIn = useBurnInProtection();

  const allRooms = useRooms();
  const otherRooms = allRooms.filter(r => r.id !== roomId && r.name !== roomName);

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
    <div
      className="h-screen w-screen flex flex-col bg-gray-900 antialiased relative overflow-hidden select-none"
      style={{ transform: burnIn.transform, transition: 'transform 1.5s ease-in-out' }}
    >
      {/* Night dim overlay — burn-in + power saving outside office hours */}
      {burnIn.nightDim > 0 && (
        <div
          className="fixed inset-0 z-[250] pointer-events-none transition-opacity duration-1000"
          style={{ background: `rgba(0,0,0,${burnIn.nightDim})` }}
        />
      )}

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
          <span className="text-gray-400 text-xs font-bold uppercase tracking-widest">{t('common.live')}</span>
        </div>

        <LanguageToggle />

        {/* Other rooms button */}
        <button
          onClick={() => setShowOtherRooms(true)}
          className="px-6 py-3 bg-gray-800/80 backdrop-blur-md border border-gray-700 text-gray-200 rounded-2xl font-bold hover:bg-gray-700 shadow-xl active:scale-95 transition-transform cursor-pointer"
        >
          {t('room.rooms_status')}
        </button>

        {/* Report issue button */}
        <button
          onClick={() => setShowIssueModal(true)}
          title={t('issue.title')}
          className="px-4 py-3 bg-gray-800/80 backdrop-blur-md border border-gray-700 text-amber-400 rounded-2xl font-bold hover:bg-gray-700 hover:border-amber-500 shadow-xl active:scale-95 transition-all cursor-pointer"
        >
          ⚠️ {t('room.issue')}
        </button>

        {/* Fullscreen button */}
        <button
          onClick={toggleFullscreen}
          title={isFullscreen ? t('room.exit_fullscreen') : t('room.fullscreen')}
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
            <span className="text-blue-500 font-black uppercase tracking-[0.3em] text-sm">{t('room.location')}</span>
            <h2 className="text-7xl font-black text-white tracking-tighter uppercase leading-none">{roomName}</h2>
          </div>
          <MeetingDetails status={status} />
          <BookFromPhone roomId={roomId} />
        </div>

        <div className="flex flex-col justify-center min-w-105 z-10">
          <StatusCard
            status={status}
            onOpenBookingModal={() => setShowBookingModal(true)}
            onCheckIn={onCheckIn}
            onRelease={onRelease}
            onExtend={onExtend}
            onToast={showToast}
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
        onBook={(durationMinutes, organizer, title, isPrivate) =>
          onBookRoom(durationMinutes, organizer, title, undefined, isPrivate)
        }
        onToast={showToast}
      />

      {/* Report issue modal */}
      <ReportIssueModal
        isOpen={showIssueModal}
        onClose={() => setShowIssueModal(false)}
        roomId={roomId}
        onToast={showToast}
      />

      {/* Idle / screen dim overlay */}
      {isIdle && (
        <div
          className="fixed inset-0 z-300 flex flex-col items-center justify-center cursor-pointer select-none"
          style={{ background: 'rgba(0,0,0,0.96)' }}
          onClick={wakeUp}
          onTouchStart={wakeUp}
        >
          <div className={`text-[12rem] font-black uppercase leading-none mb-6 transition-colors ${
            status.isOccupied ? 'text-red-600/30' : 'text-green-600/30'
          }`}>
            {status.isOccupied ? t('common.occupied') : t('common.free')}
          </div>
          <div className="text-3xl font-bold text-white/15 mb-20 uppercase tracking-widest">{roomName}</div>
          <p className="text-gray-700 text-xs uppercase tracking-[0.3em] animate-pulse">
            {t('room.touch_screen')}
          </p>
        </div>
      )}

      {/* Modal: other rooms with live status */}
      {showOtherRooms && (
        <div
          className="fixed inset-0 bg-black/95 backdrop-blur-3xl z-100 p-16 flex flex-col"
          onClick={() => setShowOtherRooms(false)}
        >
          <div className="max-w-6xl mx-auto w-full" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-12">
              <h2 className="text-6xl font-black text-white uppercase">{t('room.rooms_title')}</h2>
              <button
                onClick={() => setShowOtherRooms(false)}
                className="text-7xl text-gray-600 hover:text-white cursor-pointer"
              >
                &times;
              </button>
            </div>
            <div className="grid grid-cols-2 gap-6">
              {otherRooms.map(room => (
                <OtherRoomCard
                  key={room.id}
                  room={room}
                  homeRoom={homeRoom}
                  onClick={() => {
                    setShowOtherRooms(false);
                    window.location.search = `?room=${encodeURIComponent(room.id)}`;
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
