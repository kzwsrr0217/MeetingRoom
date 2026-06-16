import { useState, useMemo } from 'react';
import type { RoomStatus } from '../hooks/useRoomStatus';
import { BookingModal } from './BookingModal';

interface CalendarEvent {
  start: Date;
  end: Date;
  title: string;
  organizer: string;
}

interface Props {
  currentStatus: RoomStatus;
  onBookRoom: (durationMinutes: number, organizer: string, title: string, startTime?: Date) => Promise<string | null>;
  onToast: (msg: string, type: 'success' | 'error') => void;
}

export const Timeline = ({ currentStatus, onBookRoom, onToast }: Props) => {
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [bookingSlot, setBookingSlot] = useState<Date | null>(null);

  const now = new Date();

  const eventsForRoom: CalendarEvent[] = useMemo(() => {
    if (!currentStatus?.schedule) return [];
    return currentStatus.schedule.map(event => ({
      start: new Date(event.start),
      end: new Date(event.end),
      title: event.title,
      organizer: event.organizer,
    }));
  }, [currentStatus]);

  const timeSlots = useMemo(() => {
    const slots = [];
    let current = new Date(now.getTime() - 60 * 60 * 1000);
    current.setMinutes(current.getMinutes() < 30 ? 0 : 30, 0, 0);
    const endTime = new Date(now.getTime() + 180 * 60 * 1000);
    while (current <= endTime) {
      slots.push(new Date(current));
      current.setMinutes(current.getMinutes() + 30);
    }
    return slots;
  }, []);

  const getOccupiedEvent = (slotTime: Date): CalendarEvent | null => {
    const slotEnd = new Date(slotTime.getTime() + 30 * 60000);
    return (
      eventsForRoom.find(
        event =>
          (slotTime >= event.start && slotTime < event.end) ||
          (slotEnd > event.start && slotEnd <= event.end),
      ) ?? null
    );
  };

  const handleSlotClick = (
    slot: Date,
    isOccupied: boolean,
    occupiedEvent: CalendarEvent | null,
    isPast: boolean,
  ) => {
    if (isOccupied) {
      setSelectedEvent(occupiedEvent);
    } else if (!isPast) {
      setBookingSlot(slot);
    }
  };

  return (
    <div className="shrink-0 w-full pt-4 border-t border-gray-800">
      <div className="flex justify-between items-end mb-3 px-12">
        <h3 className="text-xl text-gray-500 uppercase tracking-widest font-medium">Napi Beosztás</h3>
      </div>

      <div className="w-full flex h-24 bg-gray-950 rounded-xl overflow-hidden border border-gray-800 shadow-2xl">
        {timeSlots.map((slot, index) => {
          const occupiedEvent = getOccupiedEvent(slot);
          const isOccupied = occupiedEvent !== null;
          const isPast = slot.getTime() + 30 * 60000 < now.getTime();
          const isNow = now >= slot && now < new Date(slot.getTime() + 30 * 60000);

          return (
            <button
              key={index}
              disabled={isPast && !isOccupied}
              onClick={() => handleSlotClick(slot, isOccupied, occupiedEvent, isPast)}
              className={`flex-1 flex flex-col items-center justify-center border-r border-gray-900 last:border-r-0 transition-all relative
                ${isOccupied ? 'bg-red-600/90 hover:bg-red-500' : 'bg-green-600/90 hover:bg-green-500'}
                ${isPast ? 'grayscale opacity-30 cursor-not-allowed' : 'cursor-pointer'}
                ${isNow ? 'ring-4 ring-yellow-400 z-10 scale-105 shadow-2xl mx-1 rounded-lg' : ''}
              `}
            >
              <span className={`text-xs font-bold ${isNow ? 'text-yellow-400' : 'text-white/80'}`}>
                {slot.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })}
              </span>
              {isNow && (
                <span className="absolute bottom-2 text-[8px] font-black uppercase text-yellow-400 animate-pulse">
                  Most
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Meeting info modal */}
      {selectedEvent && (
        <div
          className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-150"
          onClick={() => setSelectedEvent(null)}
        >
          <div
            className="bg-gray-800 p-12 rounded-[3rem] max-w-2xl w-full border border-gray-700 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-5xl font-bold text-white mb-8 leading-tight">{selectedEvent.title}</h2>
            <p className="text-2xl text-gray-400 mb-10">
              Szervező: <span className="text-white">{selectedEvent.organizer}</span>
            </p>
            <button
              onClick={() => setSelectedEvent(null)}
              className="w-full py-6 bg-white text-black font-black uppercase tracking-tighter rounded-2xl hover:bg-gray-200 transition-colors"
            >
              Bezárás
            </button>
          </div>
        </div>
      )}

      {/* Future slot booking — uses BookingModal with startTime */}
      <BookingModal
        isOpen={bookingSlot !== null}
        onClose={() => setBookingSlot(null)}
        onBook={(durationMinutes, organizer, title) =>
          onBookRoom(durationMinutes, organizer, title, bookingSlot ?? undefined)
        }
        onToast={onToast}
        startTime={bookingSlot ?? undefined}
      />
    </div>
  );
};
