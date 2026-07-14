// frontend/src/components/StatusCard.tsx
import { useState, useEffect } from 'react';
import type { RoomStatus } from '../hooks/useRoomStatus';

interface Props {
  status: RoomStatus;
  onOpenBookingModal: () => void;
  onCheckIn: () => Promise<string | null>;
  onRelease: () => Promise<string | null>;
  onExtend: (minutes: number) => Promise<string | null>;
  onToast: (msg: string, type: 'success' | 'error') => void;
}

const mmss = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export const StatusCard = ({ status, onOpenBookingModal, onCheckIn, onRelease, onExtend, onToast }: Props) => {
  const isFree = !status.isOccupied;
  const checkedIn = !!status.currentMeetingCheckedIn;
  const needsCheckIn = !!status.checkInRequired;

  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const releaseMsLeft = status.autoReleaseAt ? new Date(status.autoReleaseAt).getTime() - now : null;

  const run = async (fn: () => Promise<string | null>, okMsg: string) => {
    if (busy) return;
    setBusy(true);
    const err = await fn();
    setBusy(false);
    onToast(err ?? okMsg, err ? 'error' : 'success');
  };

  return (
    <div className="relative group">
      <div className={`absolute -inset-4 rounded-[4rem] blur-2xl opacity-40 animate-pulse transition-colors duration-1000 ${
        isFree ? 'bg-green-400' : 'bg-red-400'
      }`}></div>

      <div className={`relative flex flex-col items-center justify-center p-10 rounded-[3rem] w-96 shadow-2xl transition-all duration-500 border-4 ${
        isFree ? 'bg-green-600 border-green-400' : 'bg-red-600 border-red-400'
      }`}>
        <h2 className="text-5xl font-black mb-2 uppercase tracking-tighter text-white">
          {isFree ? 'Szabad' : 'Foglalt'}
        </h2>

        {/* Occupied + not yet checked in → prompt check-in with a no-show countdown */}
        {!isFree && needsCheckIn && (
          <div className="mt-6 flex flex-col items-center">
            <p className="text-white/80 font-bold mb-3">Megérkeztél?</p>
            <button
              onClick={() => run(onCheckIn, 'Sikeres check-in!')}
              disabled={busy}
              className="px-10 py-5 bg-white text-red-600 rounded-2xl font-black text-xl shadow-xl uppercase active:scale-95 transition-transform hover:bg-gray-100 disabled:opacity-60"
            >
              Check-in
            </button>
            {releaseMsLeft !== null && releaseMsLeft > 0 && (
              <p className="mt-3 text-white/70 text-sm font-bold">
                Automatikus felszabadítás: <span className="tabular-nums">{mmss(releaseMsLeft)}</span>
              </p>
            )}
          </div>
        )}

        {/* Checked in confirmation */}
        {!isFree && checkedIn && (
          <p className="mt-6 text-white/90 font-bold uppercase tracking-widest text-sm flex items-center gap-2">
            <span className="text-xl">✓</span> Visszaigazolva
          </p>
        )}

        {/* Occupied → release / extend controls */}
        {!isFree && (
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <button
              onClick={() => run(onRelease, 'Terem felszabadítva.')}
              disabled={busy}
              className="px-4 py-3 bg-white/15 text-white rounded-xl font-bold text-sm uppercase tracking-wide hover:bg-white/25 active:scale-95 transition-all disabled:opacity-60"
            >
              Vége
            </button>
            <button
              onClick={() => run(() => onExtend(15), '+15 perc hozzáadva.')}
              disabled={busy}
              className="px-4 py-3 bg-white/15 text-white rounded-xl font-bold text-sm uppercase tracking-wide hover:bg-white/25 active:scale-95 transition-all disabled:opacity-60"
            >
              +15 perc
            </button>
            <button
              onClick={() => run(() => onExtend(30), '+30 perc hozzáadva.')}
              disabled={busy}
              className="px-4 py-3 bg-white/15 text-white rounded-xl font-bold text-sm uppercase tracking-wide hover:bg-white/25 active:scale-95 transition-all disabled:opacity-60"
            >
              +30 perc
            </button>
          </div>
        )}

        {isFree && (
          <button
            onClick={onOpenBookingModal}
            className="mt-8 px-10 py-5 bg-white text-green-700 rounded-2xl font-black text-xl shadow-xl hover:bg-gray-100 uppercase cursor-pointer"
          >
            Azonnali foglalás
          </button>
        )}
      </div>
    </div>
  );
};
