import { useState } from 'react';
import { usePresetNames } from '../hooks/usePresetNames';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onBook: (durationMinutes: number, organizer: string, title: string) => Promise<string | null>;
  onToast: (msg: string, type: 'success' | 'error') => void;
  startTime?: Date; // When set, shows "Előrefoglalás: HH:MM" and adjusts end-time toast
}

export const BookingModal = ({ isOpen, onClose, onBook, onToast, startTime }: Props) => {
  const presetNames = usePresetNames();
  const [duration, setDuration] = useState(30);
  const [selectedName, setSelectedName] = useState('');
  const [customName, setCustomName] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [meetingTitle, setMeetingTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const organizer = showCustom ? customName.trim() : selectedName;
  const canBook = organizer.length > 0;

  const handleBook = async () => {
    if (!canBook || isSubmitting) return;
    setIsSubmitting(true);
    onToast('Foglalás rögzítése...', 'success');

    const error = await onBook(duration, organizer, meetingTitle.trim());
    setIsSubmitting(false);

    if (error === null) {
      const base = startTime ?? new Date();
      const end = new Date(base.getTime() + duration * 60000);
      const endStr = end.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });
      onToast(`Foglalás rögzítve! Vége: ${endStr}`, 'success');
      setSelectedName('');
      setCustomName('');
      setShowCustom(false);
      setMeetingTitle('');
      setDuration(30);
      onClose();
    } else {
      onToast(error, 'error');
    }
  };

  const isFuture = !!startTime;

  return (
    <div
      className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-150"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 p-12 rounded-[3rem] max-w-2xl w-full mx-4 border border-green-500/60 shadow-2xl shadow-green-900/20"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-4xl font-black text-white mb-1 uppercase tracking-tight">
          {isFuture ? 'Előrefoglalás' : 'Terem foglalása'}
        </h2>
        {isFuture && (
          <p className="text-green-400 text-lg font-bold mb-6">
            Kezdés: {startTime.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
        {!isFuture && <div className="mb-6" />}

        {/* Meeting title */}
        <p className="text-sm text-gray-500 uppercase tracking-widest mb-2">Megbeszélés neve (opcionális)</p>
        <input
          type="text"
          value={meetingTitle}
          onChange={e => setMeetingTitle(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleBook()}
          placeholder="pl. Design review, Sprint planning..."
          autoFocus
          className="w-full bg-gray-800 text-white text-xl p-5 rounded-2xl border border-gray-700 focus:border-green-500 focus:outline-none mb-8"
        />

        {/* Duration */}
        <p className="text-sm text-gray-500 uppercase tracking-widest mb-3">Időtartam</p>
        <div className="flex gap-4 mb-8">
          {[15, 30, 60].map(mins => (
            <button
              key={mins}
              onClick={() => setDuration(mins)}
              className={`flex-1 py-6 rounded-2xl text-2xl font-black transition-all ${
                duration === mins
                  ? 'bg-green-500 text-black scale-105 shadow-lg shadow-green-900/40'
                  : 'bg-gray-800 text-white hover:bg-gray-700'
              }`}
            >
              {mins} perc
            </button>
          ))}
        </div>

        {/* Name picker */}
        <p className="text-sm text-gray-500 uppercase tracking-widest mb-3">Ki foglal?</p>
        <div className="grid grid-cols-2 gap-3 mb-4">
          {presetNames.map(name => (
            <button
              key={name}
              onClick={() => { setSelectedName(name); setShowCustom(false); }}
              className={`py-5 px-6 rounded-2xl text-xl font-bold text-left transition-all ${
                selectedName === name && !showCustom
                  ? 'bg-green-500 text-black'
                  : 'bg-gray-800 text-white hover:bg-gray-700'
              }`}
            >
              {name}
            </button>
          ))}
          <button
            onClick={() => { setShowCustom(true); setSelectedName(''); }}
            className={`py-5 px-6 rounded-2xl text-xl font-bold text-left transition-all ${
              showCustom ? 'bg-blue-500 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Más név...
          </button>
        </div>

        {showCustom && (
          <input
            type="text"
            value={customName}
            onChange={e => setCustomName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleBook()}
            placeholder="Teljes neve..."
            autoFocus
            className="w-full bg-gray-800 text-white text-xl p-5 rounded-2xl border border-gray-700 focus:border-blue-500 focus:outline-none mb-4"
          />
        )}

        {/* Actions */}
        <div className="flex gap-4 mt-6">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 py-6 bg-gray-800 text-white font-black uppercase tracking-tight rounded-2xl hover:bg-gray-700 transition-colors"
          >
            Mégse
          </button>
          <button
            onClick={handleBook}
            disabled={!canBook || isSubmitting}
            className={`flex-1 py-6 font-black uppercase tracking-tight rounded-2xl transition-all ${
              canBook
                ? 'bg-green-500 text-black hover:bg-green-400'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isSubmitting ? 'Foglalás...' : 'Megerősítés'}
          </button>
        </div>
      </div>
    </div>
  );
};
