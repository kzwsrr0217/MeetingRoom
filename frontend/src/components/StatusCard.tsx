// frontend/src/components/StatusCard.tsx
import { useState, useEffect } from 'react';
import type { RoomStatus } from '../hooks/useRoomStatus';

interface Props {
  status: RoomStatus;
  onOpenBookingModal: () => void;
  onCheckIn: () => void;
}

export const StatusCard = ({ status, onOpenBookingModal, onCheckIn }: Props) => {
  // LocalStorage-ból olvassuk ki, hogy be van-e csekkolva (így frissítéskor megmarad)
  const [hasCheckedIn, setHasCheckedIn] = useState(() => {
    return localStorage.getItem(`checkin_${status.roomId}`) === 'true';
  });

  const isFree = !status.isOccupied;

  // Ha véget ér a meeting (vagy változik a címe), reseteljük a check-in-t
  useEffect(() => {
    if (isFree) {
      setHasCheckedIn(false);
      localStorage.removeItem(`checkin_${status.roomId}`);
    }
  }, [status.currentMeetingTitle, isFree]);

  const handleCheckInClick = () => {
    setHasCheckedIn(true);
    localStorage.setItem(`checkin_${status.roomId}`, 'true');
    onCheckIn();
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
        
        {!isFree && !hasCheckedIn && (
          <div className="mt-8 flex flex-col items-center">
            <p className="text-white/80 font-bold mb-4">Megérkeztél?</p>
            <button
              onClick={handleCheckInClick}
              className="px-10 py-5 bg-white text-red-600 rounded-2xl font-black text-xl shadow-xl uppercase active:scale-95 transition-transform hover:bg-gray-100"
            >
              Check-in
            </button>
          </div>
        )}

        {hasCheckedIn && !isFree && (
          <p className="mt-8 text-white/80 font-bold uppercase tracking-widest text-sm flex items-center gap-2">
            <span className="text-xl">✓</span> Visszaigazolva
          </p>
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