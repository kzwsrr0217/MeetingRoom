import { useState, useMemo } from 'react';
import type { RoomStatus } from '../hooks/useRoomStatus';

interface CalendarEvent {
  start: Date;
  end: Date;
  title: string;
  organizer: string;
}

interface Props {
  roomId: string;
  currentStatus: RoomStatus;
  onBookRoom: (durationMinutes: number, organizer: string, startTime?: Date) => Promise<boolean>;
  onToast: (msg: string, type: 'success' | 'error') => void;
}

export const Timeline = ({ roomId, currentStatus, onBookRoom, onToast }: Props) => {
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  
  // ÚJ ÁLLAPOTOK az előrefoglaláshoz
  const [bookingSlot, setBookingSlot] = useState<Date | null>(null);
  const [bookingDuration, setBookingDuration] = useState<number>(30);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const now = new Date();

// Ez az a blokk a Timeline-ban, ami az eseményeket gyűjti:
  const eventsForRoom: CalendarEvent[] = useMemo(() => {
    // Ha a backend még nem küldött adatot, vagy üres a lista, visszatérünk egy üres tömbbel
    if (!currentStatus || !currentStatus.schedule) return [];

    // TÉNYLEGES ADATOK: Átkonvertáljuk a backendtől kapott UTC stringeket JavaScript Date objektummá
    return currentStatus.schedule.map(event => ({
      start: new Date(event.start),
      end: new Date(event.end),
      title: event.title,
      organizer: event.organizer
    }));
  }, [currentStatus]); // Akkor frissül, ha új adat jön a szervertől

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
    return eventsForRoom.find(event => 
      (slotTime >= event.start && slotTime < event.end) || 
      (slotEnd > event.start && slotEnd <= event.end)
    ) || null;
  };

  const handleSlotClick = (slot: Date, isOccupied: boolean, occupiedEvent: CalendarEvent | null, isPast: boolean) => {
    if (isOccupied) {
      // Ha foglalt, mutatjuk az infó ablakot
      setSelectedEvent(occupiedEvent);
    } else if (!isPast) {
      // Ha szabad és nem múltbéli, megnyitjuk az előrefoglalót
      setBookingSlot(slot);
      setBookingDuration(30); // Alapértelmezett hossza
    }
  };

  const executeFutureBooking = async () => {
    if (!bookingSlot) return;
    setIsSubmitting(true);
    
    // Elküldjük a hooknak az adatokat a Kioszk nevével és a kiválasztott időponttal
    const success = await onBookRoom(bookingDuration, "Kioszk Előrefoglalás", bookingSlot);
    
    setIsSubmitting(false);
    if (success) {
      setBookingSlot(null);
      onToast('Előrefoglalás rögzítve!', 'success');
    } else {
      onToast('Hiba történt a foglalás során!', 'error');
    }
  };

  return (
    <div className="mt-auto w-full pt-16 border-t border-gray-800">
      <div className="flex justify-between items-end mb-6 px-12">
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
              disabled={isPast && !isOccupied} // Csak a múltbéli szabad sávokat tiltjuk le
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
              {isNow && <span className="absolute bottom-2 text-[8px] font-black uppercase text-yellow-400 animate-pulse">Most</span>}
            </button>
          );
        })}
      </div>

      {/* 1. Modal: Meglévő foglalás információi */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[150]" onClick={() => setSelectedEvent(null)}>
           <div className="bg-gray-800 p-12 rounded-[3rem] max-w-2xl w-full border border-gray-700 shadow-2xl" onClick={e => e.stopPropagation()}>
              <h2 className="text-5xl font-bold text-white mb-8 leading-tight">{selectedEvent.title}</h2>
              <p className="text-2xl text-gray-400 mb-10">Szervező: <span className="text-white">{selectedEvent.organizer}</span></p>
              <button onClick={() => setSelectedEvent(null)} className="w-full py-6 bg-white text-black font-black uppercase tracking-tighter rounded-2xl hover:bg-gray-200 transition-colors">
                Bezárás
              </button>
           </div>
        </div>
      )}

      {/* 2. Modal: ÚJ Előrefoglaló Ablak */}
      {bookingSlot && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[150]" onClick={() => setBookingSlot(null)}>
           <div className="bg-gray-900 p-12 rounded-[3rem] max-w-2xl w-full border border-green-500 shadow-2xl shadow-green-900/20" onClick={e => e.stopPropagation()}>
              <h2 className="text-4xl font-bold text-white mb-2">Terem Előrefoglalása</h2>
              <p className="text-2xl text-green-400 mb-10 border-b border-gray-700 pb-6">
                Kezdés: {bookingSlot.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })}
              </p>
              
              <h3 className="text-xl text-gray-400 mb-4 uppercase tracking-widest">Időtartam</h3>
              <div className="flex gap-4 mb-12">
                {[15, 30, 60].map(mins => (
                  <button 
                    key={mins}
                    onClick={() => setBookingDuration(mins)}
                    className={`flex-1 py-6 rounded-2xl text-2xl font-bold transition-all ${bookingDuration === mins ? 'bg-green-500 text-black scale-105' : 'bg-gray-800 text-white hover:bg-gray-700'}`}
                  >
                    {mins} perc
                  </button>
                ))}
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => setBookingSlot(null)} 
                  disabled={isSubmitting}
                  className="flex-1 py-6 bg-gray-800 text-white font-black uppercase tracking-tighter rounded-2xl hover:bg-gray-700 transition-colors"
                >
                  Mégse
                </button>
                <button 
                  onClick={executeFutureBooking}
                  disabled={isSubmitting}
                  className="flex-1 py-6 bg-green-500 text-black font-black uppercase tracking-tighter rounded-2xl hover:bg-green-400 transition-colors flex justify-center items-center"
                >
                  {isSubmitting ? 'Foglalás...' : 'Foglalás megerősítése'}
                </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};