import { useState } from 'react';
import { API_BASE } from '../config';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  onToast: (msg: string, type: 'success' | 'error') => void;
}

const TYPES: { id: string; label: string; icon: string }[] = [
  { id: 'av', label: 'Projektor / AV', icon: '📽️' },
  { id: 'climate', label: 'Fűtés / Klíma', icon: '🌡️' },
  { id: 'cleanliness', label: 'Tisztaság', icon: '🧹' },
  { id: 'furniture', label: 'Bútor', icon: '🪑' },
  { id: 'other', label: 'Egyéb', icon: '⚠️' },
];

export const ReportIssueModal = ({ isOpen, onClose, roomId, onToast }: Props) => {
  const [type, setType] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const submit = async () => {
    if (!type || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/issues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, type, note: note.trim() }),
      });
      if (!res.ok) throw new Error();
      onToast('Köszönjük! A hibát rögzítettük.', 'success');
      setType(null);
      setNote('');
      onClose();
    } catch {
      onToast('A bejelentés nem sikerült.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-150" onClick={onClose}>
      <div className="bg-gray-900 p-12 rounded-[3rem] max-w-2xl w-full mx-4 border border-amber-500/50 shadow-2xl" onClick={e => e.stopPropagation()}>
        <h2 className="text-4xl font-black text-white mb-2 uppercase tracking-tight">Hiba bejelentése</h2>
        <p className="text-gray-500 mb-8">Mi a probléma a teremben?</p>

        <div className="grid grid-cols-2 gap-3 mb-6">
          {TYPES.map(t => (
            <button
              key={t.id}
              onClick={() => setType(t.id)}
              className={`py-5 px-6 rounded-2xl text-xl font-bold text-left flex items-center gap-3 transition-all ${
                type === t.id ? 'bg-amber-500 text-black' : 'bg-gray-800 text-white hover:bg-gray-700'
              }`}
            >
              <span className="text-2xl">{t.icon}</span> {t.label}
            </button>
          ))}
        </div>

        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          rows={2}
          placeholder="Rövid leírás (opcionális)…"
          className="w-full bg-gray-800 text-white text-lg p-5 rounded-2xl border border-gray-700 focus:border-amber-500 focus:outline-none mb-6"
        />

        <div className="flex gap-4">
          <button onClick={onClose} disabled={submitting}
            className="flex-1 py-6 bg-gray-800 text-white font-black uppercase tracking-tight rounded-2xl hover:bg-gray-700 transition-colors">
            Mégse
          </button>
          <button onClick={submit} disabled={!type || submitting}
            className={`flex-1 py-6 font-black uppercase tracking-tight rounded-2xl transition-all ${
              type ? 'bg-amber-500 text-black hover:bg-amber-400' : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}>
            {submitting ? 'Küldés…' : 'Bejelentés'}
          </button>
        </div>
      </div>
    </div>
  );
};
