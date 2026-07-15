import { useState, useEffect } from 'react';
import './index.css';
import { useRoomStatus } from './hooks/useRoomStatus';
import { useWakeLock } from './hooks/useWakeLock';
import { RoomDisplay } from './components/RoomDisplay';
import { SetupScreen } from './components/SetupScreen';
import { AdminView } from './components/AdminView';
import { useRooms } from './hooks/useRooms';
import { useI18n } from './i18n/I18nContext';
import { STORAGE_KEY_HOME_ROOM } from './config';

// ── Route: /admin ────────────────────────────────────────────────────────────

function App() {
  if (window.location.pathname === '/admin') {
    return <AdminView />;
  }

  const savedRoom = localStorage.getItem(STORAGE_KEY_HOME_ROOM);
  const urlParams = new URLSearchParams(window.location.search);
  const roomFromUrl = urlParams.get('room');

  if (!savedRoom && !roomFromUrl) {
    return <SetupScreen />;
  }

  return <KioskApp homeRoom={savedRoom ?? roomFromUrl!} />;
}

// ── Kiosk app (all hooks live here) ─────────────────────────────────────────

function KioskApp({ homeRoom }: { homeRoom: string }) {
  const { t } = useI18n();
  const urlParams = new URLSearchParams(window.location.search);
  const roomFromUrl = urlParams.get('room');
  // currentRoom / homeRoom are stable ids (older kiosks may hold a name — the
  // backend resolves either, and we look up the display name below).
  const currentRoom = roomFromUrl ?? homeRoom;
  const isViewingOtherRoom = currentRoom !== homeRoom;

  const rooms = useRooms();
  const resolveName = (idOrName: string) =>
    rooms.find(r => r.id === idOrName || r.name === idOrName)?.name ?? idOrName;
  const displayName = resolveName(currentRoom);

  const { status, error, bookRoom, fetchStatus, checkIn, releaseNow, extend } = useRoomStatus(currentRoom);

  // Kiosk essentials
  useWakeLock();

  // Dynamic page title
  useEffect(() => {
    document.title = `${displayName} — Kioszk`;
  }, [displayName]);

  // Refresh on tab becoming visible
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible') fetchStatus();
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [fetchStatus]);

  // Auto-return countdown when viewing another room
  const [secondsLeft, setSecondsLeft] = useState(60);

  useEffect(() => {
    if (!isViewingOtherRoom) {
      setSecondsLeft(60);
      return;
    }
    const returnTimer = setTimeout(() => {
      window.location.search = `?room=${encodeURIComponent(homeRoom)}`;
    }, 60000);
    const countdown = setInterval(() => setSecondsLeft(s => s - 1), 1000);
    return () => {
      clearTimeout(returnTimer);
      clearInterval(countdown);
    };
  }, [isViewingOtherRoom, homeRoom]);

  // ── Error state with retry countdown ──────────────────────────────────────
  if (error) return <ErrorScreen error={error} onRetry={fetchStatus} />;

  // ── Loading state ─────────────────────────────────────────────────────────
  if (!status) return <LoadingScreen />;

  return (
    <>
      {isViewingOtherRoom && (
        <div className="fixed top-0 left-0 w-full z-100 bg-blue-600 text-white py-3 px-10 flex justify-between items-center shadow-2xl animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-4">
            <span className="text-2xl">⚠️</span>
            <p className="font-bold uppercase tracking-tight">
              {t('app.viewing_other', { room: displayName })}
            </p>
          </div>
          <div className="flex items-center gap-6">
            <span className="text-sm text-blue-200">
              {t('app.returning_in', { s: secondsLeft })}
            </span>
            <button
              onClick={() => (window.location.search = `?room=${encodeURIComponent(homeRoom)}`)}
              className="bg-white text-blue-600 px-6 py-2 rounded-xl font-black uppercase text-sm hover:bg-blue-50 transition-colors"
            >
              {t('common.back')}
            </button>
          </div>
        </div>
      )}
      <RoomDisplay
        status={status}
        roomName={displayName}
        roomId={currentRoom}
        homeRoom={homeRoom}
        onBookRoom={bookRoom}
        onCheckIn={checkIn}
        onRelease={releaseNow}
        onExtend={extend}
      />
    </>
  );
}

// ── Error screen with auto-retry ─────────────────────────────────────────────

function ErrorScreen({ error, onRetry }: { error: string; onRetry: () => void }) {
  const { t } = useI18n();
  const [countdown, setCountdown] = useState(30);

  useEffect(() => {
    if (countdown <= 0) {
      onRetry();
      setCountdown(30);
      return;
    }
    const id = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(id);
  }, [countdown, onRetry]);

  return (
    <div
      className="h-screen w-screen bg-gray-950 flex items-center justify-center p-10 text-center cursor-pointer"
      onClick={() => { onRetry(); setCountdown(30); }}
    >
      <div className="bg-red-950/30 border border-red-700 p-12 rounded-[3rem] max-w-xl">
        <h1 className="text-red-500 text-3xl font-black uppercase mb-4">{t('app.error_title')}</h1>
        <p className="text-white/60 mb-8">{error}</p>
        <div className="w-full bg-gray-800 rounded-full h-1.5 mb-4">
          <div
            className="bg-red-500 h-1.5 rounded-full transition-all duration-1000"
            style={{ width: `${(countdown / 30) * 100}%` }}
          />
        </div>
        <p className="text-white/40 text-sm">
          {t('app.reconnect_in', { n: countdown })}
        </p>
        <p className="text-white/25 text-xs mt-2">{t('app.touch_reconnect')}</p>
      </div>
    </div>
  );
}

// ── Loading screen ────────────────────────────────────────────────────────────

function LoadingScreen() {
  const { t } = useI18n();
  return (
    <div className="h-screen w-screen bg-gray-950 flex flex-col items-center justify-center gap-6">
      <div className="w-14 h-14 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-white/60 font-bold tracking-widest uppercase text-sm">{t('app.syncing')}</p>
    </div>
  );
}

export default App;
