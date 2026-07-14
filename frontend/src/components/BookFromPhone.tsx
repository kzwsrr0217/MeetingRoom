import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

/**
 * A small QR that opens this room's panel on a phone, so a passer-by can book
 * without touching the shared screen. The panel UI is usable on mobile.
 */
export const BookFromPhone = ({ roomId }: { roomId: string }) => {
  const [dataUrl, setDataUrl] = useState('');

  useEffect(() => {
    const url = `${window.location.origin}/?room=${encodeURIComponent(roomId)}`;
    QRCode.toDataURL(url, { margin: 1, width: 176, color: { dark: '#0f172a', light: '#ffffff' } })
      .then(setDataUrl)
      .catch(() => setDataUrl(''));
  }, [roomId]);

  if (!dataUrl) return null;

  return (
    <div className="mt-10 flex items-center gap-4">
      <img
        src={dataUrl}
        alt="QR — foglalás telefonról"
        className="w-24 h-24 rounded-2xl bg-white p-1.5 shadow-lg"
      />
      <div className="text-left">
        <p className="text-white/80 font-black uppercase tracking-wide text-sm">Foglalás telefonról</p>
        <p className="text-white/40 text-xs mt-0.5 max-w-40">
          Olvassa be a kódot, és foglaljon a saját eszközéről.
        </p>
      </div>
    </div>
  );
};
