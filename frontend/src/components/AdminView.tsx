import { useState, useEffect, useCallback } from 'react';
import { useRoomStatus } from '../hooks/useRoomStatus';
import {
  ROOMS,
  DEFAULT_PRESET_ORGANIZERS,
  STORAGE_KEY_PRESET_NAMES,
  STORAGE_KEY_HOME_ROOM,
  API_BASE,
} from '../config';

interface Health {
  status: string;
  mode: 'mock' | 'graph';
  timestamp: string;
}

// ── Per-room card ────────────────────────────────────────────────────────────

const AdminRoomCard = ({ roomName }: { roomName: string }) => {
  const { status, error } = useRoomStatus(roomName, 15000);

  const endTime = status?.currentMeetingEnd ? new Date(status.currentMeetingEnd) : null;
  const minutesLeft = endTime
    ? Math.max(0, Math.ceil((endTime.getTime() - Date.now()) / 60000))
    : null;

  if (error) {
    return (
      <div className="p-5 bg-red-950/40 border border-red-800 rounded-2xl">
        <p className="font-bold text-white">{roomName}</p>
        <p className="text-red-400 text-sm mt-1">Kapcsolódási hiba</p>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="p-5 bg-gray-800/50 border border-gray-700 rounded-2xl animate-pulse">
        <p className="font-bold text-white">{roomName}</p>
        <p className="text-gray-600 text-sm mt-1">Betöltés...</p>
      </div>
    );
  }

  return (
    <div
      className={`p-5 border rounded-2xl transition-all ${
        status.isOccupied
          ? 'bg-red-950/30 border-red-800/60'
          : 'bg-green-950/20 border-green-900/50'
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="font-black text-white">{roomName}</p>
          <span
            className={`text-xs font-black uppercase tracking-wider ${
              status.isOccupied ? 'text-red-400' : 'text-green-400'
            }`}
          >
            {status.isOccupied ? '● Foglalt' : '● Szabad'}
          </span>
        </div>
        <a
          href={`/?room=${encodeURIComponent(roomName)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-400 border border-blue-900 px-3 py-1 rounded-lg hover:border-blue-500 hover:text-blue-300 transition-colors"
        >
          Kioszk ↗
        </a>
      </div>

      {status.isOccupied ? (
        <div className="mt-1 space-y-0.5">
          <p className="text-white font-medium text-sm truncate">
            {status.currentMeetingTitle || 'Privát megbeszélés'}
          </p>
          {status.currentMeetingOrganizer && (
            <p className="text-gray-400 text-xs">{status.currentMeetingOrganizer}</p>
          )}
          {endTime && (
            <p className="text-orange-400 text-xs mt-1">
              Vége: {endTime.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })}
              {minutesLeft !== null && ` · még ${minutesLeft} perc`}
            </p>
          )}
        </div>
      ) : (
        <p className="text-gray-500 text-xs mt-1">
          {status.nextMeetingStart
            ? `Köv.: ${new Date(status.nextMeetingStart).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })}`
            : 'Nincs több foglalás ma'}
        </p>
      )}
    </div>
  );
};

// ── Main admin view ──────────────────────────────────────────────────────────

export const AdminView = () => {
  const [health, setHealth] = useState<Health | null>(null);
  const [healthError, setHealthError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const [presetNames, setPresetNames] = useState<string[]>(() => {
    return (
      JSON.parse(localStorage.getItem(STORAGE_KEY_PRESET_NAMES) ?? 'null') ??
      DEFAULT_PRESET_ORGANIZERS
    );
  });
  const [newName, setNewName] = useState('');

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/health`);
      const data: Health = await res.json();
      setHealth(data);
      setHealthError(false);
      setLastUpdated(new Date());
    } catch {
      setHealthError(true);
    }
  }, []);

  useEffect(() => {
    document.title = 'MMH Admin';
    fetchHealth();
    const id = setInterval(fetchHealth, 15000);
    return () => clearInterval(id);
  }, [fetchHealth]);

  const savePresetNames = (names: string[]) => {
    setPresetNames(names);
    localStorage.setItem(STORAGE_KEY_PRESET_NAMES, JSON.stringify(names));
  };

  const addName = () => {
    const name = newName.trim();
    if (name && !presetNames.includes(name)) {
      savePresetNames([...presetNames, name]);
      setNewName('');
    }
  };

  const removeName = (name: string) =>
    savePresetNames(presetNames.filter(n => n !== name));

  const resetPresetNames = () => {
    savePresetNames(DEFAULT_PRESET_ORGANIZERS);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8 overflow-auto select-text cursor-auto">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-10">
          <div>
            <h1 className="text-3xl font-black tracking-tight">MMH Kioszk — Admin</h1>
            <p className="text-gray-600 text-sm mt-1">
              Utolsó frissítés: {lastUpdated.toLocaleTimeString('hu-HU')}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Backend status pill */}
            <div
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-bold ${
                healthError
                  ? 'border-red-700 bg-red-950/40 text-red-400'
                  : 'border-green-800 bg-green-950/30 text-green-400'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  healthError ? 'bg-red-500' : 'bg-green-400 animate-pulse'
                }`}
              />
              {healthError ? 'Backend offline' : 'Backend online'}
              {health && (
                <span
                  className={`ml-1 text-xs px-2 py-0.5 rounded font-black uppercase ${
                    health.mode === 'mock'
                      ? 'bg-yellow-500/20 text-yellow-400'
                      : 'bg-blue-500/20 text-blue-400'
                  }`}
                >
                  {health.mode}
                </span>
              )}
            </div>
            <button
              onClick={fetchHealth}
              className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-xl text-sm font-bold hover:bg-gray-700 transition-colors"
            >
              ↻ Frissítés
            </button>
            <a
              href="/"
              className="px-4 py-2 bg-blue-700 rounded-xl text-sm font-bold hover:bg-blue-600 transition-colors"
            >
              Kioszk nézet
            </a>
          </div>
        </div>

        {/* Rooms grid */}
        <h2 className="text-xs font-black uppercase tracking-widest text-gray-600 mb-3">
          Tárgyalók — élő állapot
        </h2>
        <div className="grid grid-cols-3 gap-3 mb-10">
          {ROOMS.map(room => (
            <AdminRoomCard key={room} roomName={room} />
          ))}
        </div>

        <div className="grid grid-cols-2 gap-6">

          {/* Preset names */}
          <div>
            <h2 className="text-xs font-black uppercase tracking-widest text-gray-600 mb-3">
              Foglalási nevek (gyors választó)
            </h2>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <div className="flex flex-wrap gap-2 mb-4 min-h-[2.5rem]">
                {presetNames.map(name => (
                  <span
                    key={name}
                    className="flex items-center gap-2 bg-gray-800 px-3 py-1.5 rounded-xl text-sm"
                  >
                    {name}
                    <button
                      onClick={() => removeName(name)}
                      className="text-gray-500 hover:text-red-400 font-black leading-none"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addName()}
                  placeholder="Új név..."
                  className="flex-1 bg-gray-800 text-white text-sm px-4 py-2 rounded-xl border border-gray-700 focus:border-blue-500 focus:outline-none"
                />
                <button
                  onClick={addName}
                  className="px-4 py-2 bg-blue-700 rounded-xl text-sm font-bold hover:bg-blue-600 transition-colors"
                >
                  + Add
                </button>
              </div>
              <button
                onClick={resetPresetNames}
                className="mt-3 text-xs text-gray-600 hover:text-gray-400 underline"
              >
                Visszaállítás alapértelmezettre
              </button>
              <p className="text-xs text-gray-700 mt-2">
                ⚠ Csak ebben a böngészőben él. A táblák saját localStorage-t használnak.
              </p>
            </div>
          </div>

          {/* System info */}
          <div>
            <h2 className="text-xs font-black uppercase tracking-widest text-gray-600 mb-3">
              Rendszer
            </h2>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-3 text-sm">
              <InfoRow label="Backend" value="http://localhost:3000" mono />
              <InfoRow label="Kiosk UI" value="http://localhost:5173" mono />
              <InfoRow label="Admin" value="http://localhost:5173/admin" mono />
              <InfoRow
                label="Üzemmód"
                value={
                  health?.mode === 'mock'
                    ? '🎭 Mock — szimulált adatok'
                    : health?.mode === 'graph'
                    ? '🔗 Graph API — éles Outlook'
                    : '—'
                }
                highlight={health?.mode === 'mock' ? 'yellow' : 'blue'}
              />
              {health?.mode === 'graph' && (
                <InfoRow
                  label="Graph token"
                  value="⚠ Manuálisan frissítendő (~60 perc)"
                  highlight="orange"
                />
              )}
              <div className="border-t border-gray-800 pt-3">
                <p className="text-xs font-black uppercase tracking-widest text-gray-600 mb-2">
                  Kiosk hivatkozások
                </p>
                <div className="space-y-1">
                  {ROOMS.map(room => (
                    <div key={room} className="flex items-center justify-between">
                      <span className="text-gray-400 text-xs">{room}</span>
                      <a
                        href={`/?room=${encodeURIComponent(room)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-500 hover:text-blue-400"
                      >
                        Megnyitás ↗
                      </a>
                    </div>
                  ))}
                </div>
              </div>
              <div className="border-t border-gray-800 pt-3">
                <p className="text-xs font-black uppercase tracking-widest text-gray-600 mb-2">
                  Tábla visszaállítás
                </p>
                <p className="text-xs text-gray-600">
                  Tartsa nyomva a kioszkon az órát 3 másodpercig a helyszínbeállítás törléséhez.
                  Jelenlegi localStorage kulcs:{' '}
                  <code className="text-gray-500">{STORAGE_KEY_HOME_ROOM}</code>
                </p>
              </div>
            </div>
          </div>
        </div>

        <p className="text-center text-gray-800 text-xs mt-12 pb-4">
          MMH Kioszk Admin — POC verzió
        </p>
      </div>
    </div>
  );
};

const InfoRow = ({
  label,
  value,
  mono,
  highlight,
}: {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: 'yellow' | 'blue' | 'orange';
}) => {
  const colorMap = {
    yellow: 'text-yellow-400',
    blue: 'text-blue-400',
    orange: 'text-orange-400',
  };
  return (
    <div className="flex justify-between items-center gap-4">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span
        className={`text-right ${mono ? 'font-mono text-gray-300 text-xs' : ''} ${
          highlight ? colorMap[highlight] : 'text-white'
        }`}
      >
        {value}
      </span>
    </div>
  );
};
