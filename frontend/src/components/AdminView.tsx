import { useState, useEffect, useCallback } from 'react';
import { useRoomStatus } from '../hooks/useRoomStatus';
import { useRooms, type Room } from '../hooks/useRooms';
import { DEFAULT_PRESET_ORGANIZERS, STORAGE_KEY_HOME_ROOM, API_BASE } from '../config';

interface Health { status: string; mode: 'mock' | 'graph'; timestamp: string; }
interface TokenStatus { hasToken: boolean; expiresAt: string | null; }

// ── Helpers ───────────────────────────────────────────────────────────────────

const SectionHeading = ({ children }: { children: React.ReactNode }) => (
  <h2 className="text-xs font-black uppercase tracking-widest text-gray-500 mb-3">{children}</h2>
);

const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-gray-900 border border-gray-800 rounded-2xl p-5 ${className}`}>{children}</div>
);

// ── Per-room status card ──────────────────────────────────────────────────────

const RoomStatusCard = ({ room, onEdit, onDelete }: {
  room: Room;
  onEdit: (room: Room) => void;
  onDelete: (id: string) => void;
}) => {
  const { status, error } = useRoomStatus(room.name, 15000);
  const endTime = status?.currentMeetingEnd ? new Date(status.currentMeetingEnd) : null;
  const minutesLeft = endTime ? Math.max(0, Math.ceil((endTime.getTime() - Date.now()) / 60000)) : null;

  return (
    <div className={`p-4 border rounded-2xl transition-all ${
      error ? 'bg-red-950/30 border-red-900'
      : !status ? 'bg-gray-800/40 border-gray-700 animate-pulse'
      : status.isOccupied ? 'bg-red-950/20 border-red-800/50'
      : 'bg-green-950/15 border-green-900/40'
    }`}>
      {/* Room header row */}
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="min-w-0">
          <p className="font-black text-white text-sm truncate">{room.name}</p>
          {room.calendarEmail && (
            <p className="text-gray-600 text-xs truncate">{room.calendarEmail}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <a
            href={`/?room=${encodeURIComponent(room.name)}`}
            target="_blank" rel="noopener noreferrer"
            className="text-xs text-blue-500 border border-blue-900 px-2 py-0.5 rounded-lg hover:border-blue-500 transition-colors"
          >↗</a>
          <button
            onClick={() => onEdit(room)}
            className="text-xs text-gray-500 border border-gray-700 px-2 py-0.5 rounded-lg hover:border-gray-500 hover:text-white transition-colors"
          >✎</button>
          <button
            onClick={() => onDelete(room.id)}
            className="text-xs text-gray-600 border border-gray-800 px-2 py-0.5 rounded-lg hover:border-red-700 hover:text-red-400 transition-colors"
          >✕</button>
        </div>
      </div>

      {/* Status */}
      {error ? (
        <p className="text-red-400 text-xs">Kapcsolódási hiba</p>
      ) : !status ? (
        <p className="text-gray-600 text-xs">Betöltés...</p>
      ) : status.isOccupied ? (
        <div className="space-y-0.5">
          <span className="text-xs font-black text-red-400 uppercase tracking-wider">● Foglalt</span>
          <p className="text-white text-xs truncate">{status.currentMeetingTitle || 'Privát megbeszélés'}</p>
          {status.currentMeetingOrganizer && <p className="text-gray-400 text-xs">{status.currentMeetingOrganizer}</p>}
          {endTime && (
            <p className="text-orange-400 text-xs">
              Vége: {endTime.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })}
              {minutesLeft !== null && ` · még ${minutesLeft} perc`}
            </p>
          )}
        </div>
      ) : (
        <div>
          <span className="text-xs font-black text-green-400 uppercase tracking-wider">● Szabad</span>
          {status.nextMeetingStart && (
            <p className="text-gray-500 text-xs mt-0.5">
              Köv.: {new Date(status.nextMeetingStart).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

// ── Edit room modal ───────────────────────────────────────────────────────────

const EditRoomModal = ({ room, onSave, onClose }: {
  room: Room;
  onSave: (id: string, name: string, email: string) => Promise<void>;
  onClose: () => void;
}) => {
  const [name, setName] = useState(room.name);
  const [email, setEmail] = useState(room.calendarEmail);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await onSave(room.id, name.trim(), email.trim());
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-black text-white mb-5">Tárgyaló szerkesztése</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-widest block mb-1">Megnevezés</label>
            <input
              className="w-full bg-gray-800 text-white px-4 py-2.5 rounded-xl border border-gray-700 focus:border-blue-500 focus:outline-none"
              value={name} onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-widest block mb-1">Outlook postafiók email (Graph API)</label>
            <input
              className="w-full bg-gray-800 text-white px-4 py-2.5 rounded-xl border border-gray-700 focus:border-blue-500 focus:outline-none text-sm font-mono"
              value={email} onChange={e => setEmail(e.target.value)}
              placeholder="sed@company.hu"
              onKeyDown={e => e.key === 'Enter' && handleSave()}
            />
            <p className="text-xs text-gray-700 mt-1">Elhagyható mock módban. Graph módban ez azonosítja a naptárat.</p>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 bg-gray-800 rounded-xl text-sm font-bold hover:bg-gray-700 transition-colors">Mégse</button>
          <button
            onClick={handleSave} disabled={!name.trim() || saving}
            className="flex-1 py-2.5 bg-blue-600 rounded-xl text-sm font-black hover:bg-blue-500 disabled:opacity-40 transition-colors"
          >
            {saving ? 'Mentés...' : 'Mentés'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main admin view ──────────────────────────────────────────────────────────

export const AdminView = () => {
  const rooms = useRooms();
  const [roomList, setRoomList] = useState<Room[]>([]);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomEmail, setNewRoomEmail] = useState('');
  const [roomSaving, setRoomSaving] = useState(false);
  const [roomMsg, setRoomMsg] = useState<string | null>(null);

  // Sync hook → local state so we can optimistically update
  useEffect(() => { setRoomList(rooms); }, [rooms]);

  const [health, setHealth] = useState<Health | null>(null);
  const [healthError, setHealthError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const [tokenStatus, setTokenStatus] = useState<TokenStatus | null>(null);
  const [tokenInput, setTokenInput] = useState('');
  const [tokenSaving, setTokenSaving] = useState(false);
  const [tokenMsg, setTokenMsg] = useState<string | null>(null);

  const [presetNames, setPresetNames] = useState<string[]>(DEFAULT_PRESET_ORGANIZERS);
  const [newName, setNewName] = useState('');
  const [presetMsg, setPresetMsg] = useState<string | null>(null);

  // ── Health polling ──────────────────────────────────────────────────────────

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

  const fetchTokenStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/config/graph-token/status`);
      setTokenStatus(await res.json());
    } catch {}
  }, []);

  const fetchPresetNames = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/config/preset-names`);
      setPresetNames(await res.json());
    } catch {}
  }, []);

  useEffect(() => {
    document.title = 'MMH Admin';
    fetchHealth();
    fetchTokenStatus();
    fetchPresetNames();
    const id = setInterval(() => { fetchHealth(); fetchTokenStatus(); }, 15000);
    return () => clearInterval(id);
  }, [fetchHealth, fetchTokenStatus, fetchPresetNames]);

  // ── Room management ─────────────────────────────────────────────────────────

  const handleAddRoom = async () => {
    if (!newRoomName.trim()) return;
    setRoomSaving(true);
    try {
      const res = await fetch(`${API_BASE}/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newRoomName.trim(), calendarEmail: newRoomEmail.trim() }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      const room: Room = await res.json();
      setRoomList(prev => [...prev, room]);
      setNewRoomName('');
      setNewRoomEmail('');
      setRoomMsg('Tárgyaló hozzáadva.');
    } catch (e: any) {
      setRoomMsg(`Hiba: ${e.message}`);
    } finally {
      setRoomSaving(false);
      setTimeout(() => setRoomMsg(null), 3000);
    }
  };

  const handleEditRoom = async (id: string, name: string, calendarEmail: string) => {
    const res = await fetch(`${API_BASE}/rooms/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, calendarEmail }),
    });
    const updated: Room = await res.json();
    setRoomList(prev => prev.map(r => r.id === id ? updated : r));
  };

  const handleDeleteRoom = async (id: string) => {
    if (!confirm('Biztosan törlöd ezt a tárgyalót?')) return;
    await fetch(`${API_BASE}/rooms/${id}`, { method: 'DELETE' });
    setRoomList(prev => prev.filter(r => r.id !== id));
  };

  const handleResetRooms = async () => {
    if (!confirm('Visszaállítod az alapértelmezett tárgyalólistát?')) return;
    const res = await fetch(`${API_BASE}/rooms/reset`, { method: 'POST' });
    setRoomList(await res.json());
  };

  // ── Token management ────────────────────────────────────────────────────────

  const handleApplyToken = async () => {
    if (!tokenInput.trim()) return;
    setTokenSaving(true);
    try {
      const res = await fetch(`${API_BASE}/config/graph-token`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenInput.trim() }),
      });
      const data = await res.json();
      setTokenStatus({ hasToken: true, expiresAt: data.expiresAt });
      setTokenInput('');
      setTokenMsg('Token alkalmazva. A backend Graph módban fut.');
    } catch {
      setTokenMsg('Hiba a token alkalmazásakor.');
    } finally {
      setTokenSaving(false);
      setTimeout(() => setTokenMsg(null), 4000);
    }
  };

  const tokenExpiry = tokenStatus?.expiresAt ? new Date(tokenStatus.expiresAt) : null;
  const tokenMinutesLeft = tokenExpiry ? Math.max(0, Math.floor((tokenExpiry.getTime() - Date.now()) / 60000)) : null;
  const tokenExpired = tokenExpiry ? tokenExpiry < new Date() : false;

  // ── Preset names ────────────────────────────────────────────────────────────

  const savePresetNames = async (names: string[]) => {
    setPresetNames(names);
    try {
      await fetch(`${API_BASE}/config/preset-names`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ names }),
      });
      setPresetMsg('Mentve — minden eszközön frissül.');
    } catch {
      setPresetMsg('Hiba a mentéskor.');
    }
    setTimeout(() => setPresetMsg(null), 3000);
  };

  const addPresetName = () => {
    const name = newName.trim();
    if (name && !presetNames.includes(name)) {
      savePresetNames([...presetNames, name]);
      setNewName('');
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8 overflow-auto select-text cursor-auto">
      <div className="max-w-6xl mx-auto space-y-10">

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight">MMH Kioszk — Admin</h1>
            <p className="text-gray-600 text-sm mt-1">Utolsó frissítés: {lastUpdated.toLocaleTimeString('hu-HU')}</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-bold ${
              healthError ? 'border-red-700 bg-red-950/40 text-red-400' : 'border-green-800 bg-green-950/30 text-green-400'
            }`}>
              <span className={`w-2 h-2 rounded-full ${healthError ? 'bg-red-500' : 'bg-green-400 animate-pulse'}`} />
              {healthError ? 'Backend offline' : 'Backend online'}
              {health && (
                <span className={`ml-1 text-xs px-2 py-0.5 rounded font-black uppercase ${
                  health.mode === 'mock' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-blue-500/20 text-blue-400'
                }`}>{health.mode}</span>
              )}
            </div>
            <button onClick={() => { fetchHealth(); fetchTokenStatus(); }}
              className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-xl text-sm font-bold hover:bg-gray-700 transition-colors">
              ↻ Frissítés
            </button>
            <a href="/" className="px-4 py-2 bg-blue-700 rounded-xl text-sm font-bold hover:bg-blue-600 transition-colors">
              Kioszk nézet
            </a>
          </div>
        </div>

        {/* ── Rooms section ──────────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <SectionHeading>Tárgyalók kezelése</SectionHeading>
            <button onClick={handleResetRooms}
              className="text-xs text-gray-700 hover:text-gray-400 underline">
              Visszaállítás alapértelmezettre
            </button>
          </div>

          {/* Status grid */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            {roomList.map(room => (
              <RoomStatusCard
                key={room.id} room={room}
                onEdit={setEditingRoom}
                onDelete={handleDeleteRoom}
              />
            ))}
          </div>

          {/* Add room form */}
          <Card>
            <p className="text-xs font-black uppercase tracking-widest text-gray-500 mb-3">Új tárgyaló hozzáadása</p>
            <div className="flex gap-3 flex-wrap">
              <input
                value={newRoomName} onChange={e => setNewRoomName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddRoom()}
                placeholder="Megnevezés (pl. MMH Jupiter)"
                className="flex-1 min-w-48 bg-gray-800 text-white text-sm px-4 py-2.5 rounded-xl border border-gray-700 focus:border-blue-500 focus:outline-none"
              />
              <input
                value={newRoomEmail} onChange={e => setNewRoomEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddRoom()}
                placeholder="jupiter@company.hu (opcionális)"
                className="flex-1 min-w-60 bg-gray-800 text-white text-sm px-4 py-2.5 rounded-xl border border-gray-700 focus:border-blue-500 focus:outline-none font-mono"
              />
              <button
                onClick={handleAddRoom} disabled={!newRoomName.trim() || roomSaving}
                className="px-5 py-2.5 bg-blue-700 rounded-xl text-sm font-black hover:bg-blue-600 disabled:opacity-40 transition-colors whitespace-nowrap"
              >
                {roomSaving ? 'Mentés...' : '+ Hozzáadás'}
              </button>
            </div>
            {roomMsg && <p className="text-xs text-green-400 mt-2">{roomMsg}</p>}
          </Card>
        </div>

        {/* ── Graph token + Preset names ─────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-6">

          {/* Graph token */}
          <div>
            <SectionHeading>Microsoft Graph Token</SectionHeading>
            <Card>
              {/* Current status */}
              <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-800">
                {!tokenStatus ? (
                  <span className="text-gray-600 text-sm">Betöltés...</span>
                ) : !tokenStatus.hasToken ? (
                  <span className="text-gray-500 text-sm">Nincs token — mock mód aktív</span>
                ) : tokenExpired ? (
                  <span className="text-red-400 text-sm font-bold">⚠ Token lejárt</span>
                ) : (
                  <span className="text-green-400 text-sm font-bold">
                    ✓ Érvényes — még {tokenMinutesLeft} perc
                    {tokenExpiry && (
                      <span className="text-gray-500 font-normal ml-1">
                        (lejár: {tokenExpiry.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })})
                      </span>
                    )}
                  </span>
                )}
              </div>

              {/* Paste new token */}
              <p className="text-xs text-gray-500 mb-2">
                Frissített token beillesztése (
                <a href="https://developer.microsoft.com/en-us/graph/graph-explorer"
                  target="_blank" rel="noopener noreferrer"
                  className="text-blue-500 hover:text-blue-400">Graph Explorer</a>
                → avatar → Access token):
              </p>
              <textarea
                value={tokenInput} onChange={e => setTokenInput(e.target.value)}
                rows={3}
                placeholder="eyJ0eXAiOiJKV1Qi..."
                className="w-full bg-gray-800 text-white text-xs font-mono px-4 py-3 rounded-xl border border-gray-700 focus:border-blue-500 focus:outline-none resize-none mb-3"
              />
              <button
                onClick={handleApplyToken} disabled={!tokenInput.trim() || tokenSaving}
                className="w-full py-2.5 bg-blue-700 rounded-xl text-sm font-black hover:bg-blue-600 disabled:opacity-40 transition-colors"
              >
                {tokenSaving ? 'Alkalmazás...' : 'Token alkalmazása'}
              </button>
              {tokenMsg && <p className="text-xs text-green-400 mt-2">{tokenMsg}</p>}
              <p className="text-xs text-gray-700 mt-3">
                A token az aktív kapcsolatot azonnal frissíti és a .env fájlba is elmentődik az újraindítás után is.
              </p>
            </Card>
          </div>

          {/* Preset names */}
          <div>
            <SectionHeading>Foglalási nevek (megosztott)</SectionHeading>
            <Card>
              <div className="flex flex-wrap gap-2 mb-4 min-h-10">
                {presetNames.map(name => (
                  <span key={name} className="flex items-center gap-2 bg-gray-800 px-3 py-1.5 rounded-xl text-sm">
                    {name}
                    <button
                      onClick={() => savePresetNames(presetNames.filter(n => n !== name))}
                      className="text-gray-500 hover:text-red-400 font-black leading-none"
                    >×</button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text" value={newName} onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addPresetName()}
                  placeholder="Új név..."
                  className="flex-1 bg-gray-800 text-white text-sm px-4 py-2 rounded-xl border border-gray-700 focus:border-blue-500 focus:outline-none"
                />
                <button onClick={addPresetName}
                  className="px-4 py-2 bg-blue-700 rounded-xl text-sm font-bold hover:bg-blue-600 transition-colors">
                  + Hozzáad
                </button>
              </div>
              <button onClick={() => savePresetNames(DEFAULT_PRESET_ORGANIZERS)}
                className="mt-3 text-xs text-gray-600 hover:text-gray-400 underline">
                Visszaállítás alapértelmezettre
              </button>
              {presetMsg && <p className="text-xs text-green-400 mt-2">{presetMsg}</p>}
              <p className="text-xs text-gray-700 mt-2">
                A lista a szerverről töltődik be — minden kioszk és böngésző ugyanazt látja.
              </p>
            </Card>
          </div>
        </div>

        {/* ── System info ────────────────────────────────────────────────────── */}
        <div>
          <SectionHeading>Rendszer</SectionHeading>
          <Card>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm mb-4">
              {[
                ['Backend API', `${API_BASE}`],
                ['Kiosk UI', window.location.origin],
                ['Admin', `${window.location.origin}/admin`],
                ['Üzemmód', health?.mode === 'mock' ? '🎭 Mock — szimulált adatok' : health?.mode === 'graph' ? '🔗 Graph — éles Outlook' : '—'],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between items-center gap-4 border-b border-gray-800/50 pb-2">
                  <span className="text-gray-500 shrink-0">{label}</span>
                  <span className="text-gray-300 text-xs font-mono text-right">{value}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-gray-800 pt-4">
              <p className="text-xs font-black uppercase tracking-widest text-gray-600 mb-2">Kiosk hivatkozások</p>
              <div className="grid grid-cols-2 gap-x-8 gap-y-1">
                {roomList.map(room => (
                  <div key={room.id} className="flex items-center justify-between">
                    <span className="text-gray-400 text-xs">{room.name}</span>
                    <a href={`/?room=${encodeURIComponent(room.name)}`}
                      target="_blank" rel="noopener noreferrer"
                      className="text-xs text-blue-500 hover:text-blue-400">Megnyitás ↗</a>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-gray-800 pt-4 mt-4">
              <p className="text-xs font-black uppercase tracking-widest text-gray-600 mb-2">Tábla visszaállítás</p>
              <p className="text-xs text-gray-600">
                Tartsa nyomva a kioszkon az órát 3 másodpercig a helyszínbeállítás törléséhez.
                LocalStorage kulcs: <code className="text-gray-500">{STORAGE_KEY_HOME_ROOM}</code>
              </p>
            </div>
          </Card>
        </div>

        <p className="text-center text-gray-800 text-xs pb-4">MMH Kioszk Admin — POC verzió</p>
      </div>

      {/* Edit room modal */}
      {editingRoom && (
        <EditRoomModal
          room={editingRoom}
          onSave={handleEditRoom}
          onClose={() => setEditingRoom(null)}
        />
      )}
    </div>
  );
};
