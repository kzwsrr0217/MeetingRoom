import { useState, useEffect, useCallback } from 'react';
import { useRoomStatus } from '../hooks/useRoomStatus';
import { useRooms, type Room } from '../hooks/useRooms';
import {
  DEFAULT_PRESET_ORGANIZERS, STORAGE_KEY_HOME_ROOM, STORAGE_KEY_ADMIN_KEY,
  API_BASE, ADMIN_STATUS_POLL_MS, adminHeaders, getAdminKey,
} from '../config';
import { useI18n } from '../i18n/I18nContext';
import { LanguageToggle } from './LanguageToggle';

interface Health { status: string; mode: 'mock' | 'graph'; timestamp: string; }
interface TokenStatus { hasToken: boolean; expiresAt: string | null; }
interface Issue { id: string; roomId: string; type: string; note: string; createdAt: string; }

const ISSUE_TYPE_EMOJI: Record<string, string> = {
  av: '📽️', climate: '🌡️', cleanliness: '🧹', furniture: '🪑', other: '⚠️',
};

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
  const { t } = useI18n();
  const { status, error } = useRoomStatus(room.id, ADMIN_STATUS_POLL_MS);
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
            href={`/?room=${encodeURIComponent(room.id)}`}
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
        <p className="text-red-400 text-xs">{t('room.connection_error')}</p>
      ) : !status ? (
        <p className="text-gray-600 text-xs">{t('room.loading')}</p>
      ) : status.isOccupied ? (
        <div className="space-y-0.5">
          <span className="text-xs font-black text-red-400 uppercase tracking-wider">● {t('common.occupied')}</span>
          <p className="text-white text-xs truncate">
            {status.currentMeetingPrivate ? t('meeting.private') : (status.currentMeetingTitle || t('meeting.private'))}
          </p>
          {status.currentMeetingOrganizer && <p className="text-gray-400 text-xs">{status.currentMeetingOrganizer}</p>}
          {endTime && (
            <p className="text-orange-400 text-xs">
              {t('room.ends')} {endTime.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })}
              {minutesLeft !== null && ` · ${t('room.minutes_left', { n: minutesLeft })}`}
            </p>
          )}
        </div>
      ) : (
        <div>
          <span className="text-xs font-black text-green-400 uppercase tracking-wider">● {t('common.free')}</span>
          {status.nextMeetingStart && (
            <p className="text-gray-500 text-xs mt-0.5">
              {t('room.next_short')} {new Date(status.nextMeetingStart).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })}
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
  const { t } = useI18n();
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
        <h3 className="text-lg font-black text-white mb-5">{t('admin.edit_room')}</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-widest block mb-1">{t('admin.name_label')}</label>
            <input
              className="w-full bg-gray-800 text-white px-4 py-2.5 rounded-xl border border-gray-700 focus:border-blue-500 focus:outline-none"
              value={name} onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-widest block mb-1">{t('admin.email_label')}</label>
            <input
              className="w-full bg-gray-800 text-white px-4 py-2.5 rounded-xl border border-gray-700 focus:border-blue-500 focus:outline-none text-sm font-mono"
              value={email} onChange={e => setEmail(e.target.value)}
              placeholder="sed@company.hu"
              onKeyDown={e => e.key === 'Enter' && handleSave()}
            />
            <p className="text-xs text-gray-700 mt-1">{t('admin.email_note')}</p>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 bg-gray-800 rounded-xl text-sm font-bold hover:bg-gray-700 transition-colors">{t('common.cancel')}</button>
          <button
            onClick={handleSave} disabled={!name.trim() || saving}
            className="flex-1 py-2.5 bg-blue-600 rounded-xl text-sm font-black hover:bg-blue-500 disabled:opacity-40 transition-colors"
          >
            {saving ? t('admin.saving') : t('admin.save')}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main admin view ──────────────────────────────────────────────────────────

export const AdminView = () => {
  const { t, locale } = useI18n();
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

  const [adminKeyInput, setAdminKeyInput] = useState(getAdminKey());
  const [adminKeyMsg, setAdminKeyMsg] = useState<string | null>(null);

  const [issues, setIssues] = useState<Issue[]>([]);
  const fetchIssues = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/issues`, { headers: adminHeaders() });
      if (res.ok) setIssues(await res.json());
    } catch { /* ignore */ }
  }, []);
  const dismissIssue = async (id: string) => {
    await fetch(`${API_BASE}/issues/${id}`, { method: 'DELETE', headers: adminHeaders() });
    setIssues(prev => prev.filter(i => i.id !== id));
  };

  const saveAdminKey = () => {
    localStorage.setItem(STORAGE_KEY_ADMIN_KEY, adminKeyInput.trim());
    setAdminKeyMsg(t('admin.admin_key_saved'));
    setTimeout(() => setAdminKeyMsg(null), 3000);
  };

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
    fetchIssues();
    const id = setInterval(() => { fetchHealth(); fetchTokenStatus(); fetchIssues(); }, ADMIN_STATUS_POLL_MS);
    return () => clearInterval(id);
  }, [fetchHealth, fetchTokenStatus, fetchPresetNames, fetchIssues]);

  // ── Room management ─────────────────────────────────────────────────────────

  const handleAddRoom = async () => {
    if (!newRoomName.trim()) return;
    setRoomSaving(true);
    try {
      const res = await fetch(`${API_BASE}/rooms`, {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify({ name: newRoomName.trim(), calendarEmail: newRoomEmail.trim() }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      const room: Room = await res.json();
      setRoomList(prev => [...prev, room]);
      setNewRoomName('');
      setNewRoomEmail('');
      setRoomMsg(t('admin.room_added'));
    } catch (e: any) {
      setRoomMsg(t('admin.error_prefix', { msg: e.message }));
    } finally {
      setRoomSaving(false);
      setTimeout(() => setRoomMsg(null), 3000);
    }
  };

  const handleEditRoom = async (id: string, name: string, calendarEmail: string) => {
    const res = await fetch(`${API_BASE}/rooms/${id}`, {
      method: 'PATCH',
      headers: adminHeaders(),
      body: JSON.stringify({ name, calendarEmail }),
    });
    const updated: Room = await res.json();
    setRoomList(prev => prev.map(r => r.id === id ? updated : r));
  };

  const handleDeleteRoom = async (id: string) => {
    if (!confirm(t('admin.confirm_delete'))) return;
    await fetch(`${API_BASE}/rooms/${id}`, { method: 'DELETE', headers: adminHeaders() });
    setRoomList(prev => prev.filter(r => r.id !== id));
  };

  const handleResetRooms = async () => {
    if (!confirm(t('admin.confirm_reset'))) return;
    const res = await fetch(`${API_BASE}/rooms/reset`, { method: 'POST', headers: adminHeaders() });
    setRoomList(await res.json());
  };

  // ── Token management ────────────────────────────────────────────────────────

  const handleApplyToken = async () => {
    if (!tokenInput.trim()) return;
    setTokenSaving(true);
    try {
      const res = await fetch(`${API_BASE}/config/graph-token`, {
        method: 'PUT',
        headers: adminHeaders(),
        body: JSON.stringify({ token: tokenInput.trim() }),
      });
      const data = await res.json();
      setTokenStatus({ hasToken: true, expiresAt: data.expiresAt });
      setTokenInput('');
      setTokenMsg(t('admin.token_applied'));
    } catch {
      setTokenMsg(t('admin.token_apply_error'));
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
        headers: adminHeaders(),
        body: JSON.stringify({ names }),
      });
      setPresetMsg(t('admin.preset_saved'));
    } catch {
      setPresetMsg(t('admin.save_error'));
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
            <h1 className="text-3xl font-black tracking-tight">{t('admin.title')}</h1>
            <p className="text-gray-600 text-sm mt-1">{t('admin.last_update', { time: lastUpdated.toLocaleTimeString(locale) })}</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <LanguageToggle />
            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-bold ${
              healthError ? 'border-red-700 bg-red-950/40 text-red-400' : 'border-green-800 bg-green-950/30 text-green-400'
            }`}>
              <span className={`w-2 h-2 rounded-full ${healthError ? 'bg-red-500' : 'bg-green-400 animate-pulse'}`} />
              {healthError ? t('admin.backend_offline') : t('admin.backend_online')}
              {health && (
                <span className={`ml-1 text-xs px-2 py-0.5 rounded font-black uppercase ${
                  health.mode === 'mock' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-blue-500/20 text-blue-400'
                }`}>{health.mode}</span>
              )}
            </div>
            <button onClick={() => { fetchHealth(); fetchTokenStatus(); }}
              className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-xl text-sm font-bold hover:bg-gray-700 transition-colors">
              ↻ {t('admin.refresh')}
            </button>
            <a href="/" className="px-4 py-2 bg-blue-700 rounded-xl text-sm font-bold hover:bg-blue-600 transition-colors">
              {t('admin.kiosk_view')}
            </a>
          </div>
        </div>

        {/* ── Rooms section ──────────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <SectionHeading>{t('admin.rooms_manage')}</SectionHeading>
            <button onClick={handleResetRooms}
              className="text-xs text-gray-700 hover:text-gray-400 underline">
              {t('admin.reset_default')}
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
            <p className="text-xs font-black uppercase tracking-widest text-gray-500 mb-3">{t('admin.add_room')}</p>
            <div className="flex gap-3 flex-wrap">
              <input
                value={newRoomName} onChange={e => setNewRoomName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddRoom()}
                placeholder={t('admin.room_name_ph')}
                className="flex-1 min-w-48 bg-gray-800 text-white text-sm px-4 py-2.5 rounded-xl border border-gray-700 focus:border-blue-500 focus:outline-none"
              />
              <input
                value={newRoomEmail} onChange={e => setNewRoomEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddRoom()}
                placeholder={t('admin.room_email_ph')}
                className="flex-1 min-w-60 bg-gray-800 text-white text-sm px-4 py-2.5 rounded-xl border border-gray-700 focus:border-blue-500 focus:outline-none font-mono"
              />
              <button
                onClick={handleAddRoom} disabled={!newRoomName.trim() || roomSaving}
                className="px-5 py-2.5 bg-blue-700 rounded-xl text-sm font-black hover:bg-blue-600 disabled:opacity-40 transition-colors whitespace-nowrap"
              >
                {roomSaving ? t('admin.saving') : t('admin.add')}
              </button>
            </div>
            {roomMsg && <p className="text-xs text-green-400 mt-2">{roomMsg}</p>}
          </Card>
        </div>

        {/* ── Graph token + Preset names ─────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-6">

          {/* Graph token */}
          <div>
            <SectionHeading>{t('admin.graph_token')}</SectionHeading>
            <Card>
              {/* Current status */}
              <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-800">
                {!tokenStatus ? (
                  <span className="text-gray-600 text-sm">{t('admin.loading')}</span>
                ) : !tokenStatus.hasToken ? (
                  <span className="text-gray-500 text-sm">{t('admin.no_token')}</span>
                ) : tokenExpired ? (
                  <span className="text-red-400 text-sm font-bold">{t('admin.token_expired')}</span>
                ) : (
                  <span className="text-green-400 text-sm font-bold">
                    {t('admin.token_valid', { n: tokenMinutesLeft ?? 0 })}
                    {tokenExpiry && (
                      <span className="text-gray-500 font-normal ml-1">
                        {t('admin.token_expires_at', { time: tokenExpiry.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) })}
                      </span>
                    )}
                  </span>
                )}
              </div>

              {/* Paste new token */}
              <p className="text-xs text-gray-500 mb-2">
                {t('admin.token_paste_pre')}
                <a href="https://developer.microsoft.com/en-us/graph/graph-explorer"
                  target="_blank" rel="noopener noreferrer"
                  className="text-blue-500 hover:text-blue-400">Graph Explorer</a>
                {t('admin.token_paste_post')}
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
                {tokenSaving ? t('admin.applying') : t('admin.token_apply')}
              </button>
              {tokenMsg && <p className="text-xs text-green-400 mt-2">{tokenMsg}</p>}
              <p className="text-xs text-gray-700 mt-3">{t('admin.token_note')}</p>
            </Card>
          </div>

          {/* Preset names */}
          <div>
            <SectionHeading>{t('admin.preset_names')}</SectionHeading>
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
                  placeholder={t('admin.new_name_ph')}
                  className="flex-1 bg-gray-800 text-white text-sm px-4 py-2 rounded-xl border border-gray-700 focus:border-blue-500 focus:outline-none"
                />
                <button onClick={addPresetName}
                  className="px-4 py-2 bg-blue-700 rounded-xl text-sm font-bold hover:bg-blue-600 transition-colors">
                  {t('admin.add_short')}
                </button>
              </div>
              <button onClick={() => savePresetNames(DEFAULT_PRESET_ORGANIZERS)}
                className="mt-3 text-xs text-gray-600 hover:text-gray-400 underline">
                {t('admin.reset_default')}
              </button>
              {presetMsg && <p className="text-xs text-green-400 mt-2">{presetMsg}</p>}
              <p className="text-xs text-gray-700 mt-2">{t('admin.preset_note')}</p>
            </Card>
          </div>
        </div>

        {/* ── Reported issues ────────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center gap-3 mb-3">
            <SectionHeading>{t('admin.issues')}</SectionHeading>
            {issues.length > 0 && (
              <span className="text-xs font-black px-2 py-0.5 rounded bg-amber-500/20 text-amber-400">{issues.length}</span>
            )}
          </div>
          <Card>
            {issues.length === 0 ? (
              <p className="text-gray-600 text-sm">{t('admin.no_issues')}</p>
            ) : (
              <div className="space-y-2">
                {issues.map(issue => (
                  <div key={issue.id} className="flex items-start justify-between gap-4 border-b border-gray-800/50 pb-2 last:border-0">
                    <div className="min-w-0">
                      <p className="text-white text-sm font-bold">
                        {(ISSUE_TYPE_EMOJI[issue.type] ?? '⚠️')} {t(`issue.type_${issue.type}`)}
                        <span className="text-gray-500 font-normal ml-2">· {issue.roomId}</span>
                      </p>
                      {issue.note && <p className="text-gray-400 text-xs mt-0.5">{issue.note}</p>}
                      <p className="text-gray-700 text-xs mt-0.5">
                        {new Date(issue.createdAt).toLocaleString(locale)}
                      </p>
                    </div>
                    <button
                      onClick={() => dismissIssue(issue.id)}
                      className="text-xs text-gray-500 border border-gray-700 px-3 py-1 rounded-lg hover:border-green-600 hover:text-green-400 transition-colors shrink-0"
                    >
                      {t('admin.resolved')}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* ── System info ────────────────────────────────────────────────────── */}
        <div>
          <SectionHeading>{t('admin.system')}</SectionHeading>
          <Card>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm mb-4">
              {[
                ['Backend API', `${API_BASE}`],
                ['Kiosk UI', window.location.origin],
                ['Admin', `${window.location.origin}/admin`],
                [t('admin.mode'), health?.mode === 'mock' ? t('admin.mode_mock') : health?.mode === 'graph' ? t('admin.mode_graph') : '—'],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between items-center gap-4 border-b border-gray-800/50 pb-2">
                  <span className="text-gray-500 shrink-0">{label}</span>
                  <span className="text-gray-300 text-xs font-mono text-right">{value}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-gray-800 pt-4">
              <p className="text-xs font-black uppercase tracking-widest text-gray-600 mb-2">{t('admin.kiosk_links')}</p>
              <div className="grid grid-cols-2 gap-x-8 gap-y-1">
                {roomList.map(room => (
                  <div key={room.id} className="flex items-center justify-between">
                    <span className="text-gray-400 text-xs">{room.name}</span>
                    <a href={`/?room=${encodeURIComponent(room.id)}`}
                      target="_blank" rel="noopener noreferrer"
                      className="text-xs text-blue-500 hover:text-blue-400">{t('admin.open')}</a>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-gray-800 pt-4 mt-4">
              <p className="text-xs font-black uppercase tracking-widest text-gray-600 mb-2">{t('admin.admin_key')}</p>
              <p className="text-xs text-gray-600 mb-2">{t('admin.admin_key_note')}</p>
              <div className="flex gap-2">
                <input
                  type="password" value={adminKeyInput} onChange={e => setAdminKeyInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && saveAdminKey()}
                  placeholder={t('admin.admin_key_ph')}
                  className="flex-1 bg-gray-800 text-white text-sm px-4 py-2 rounded-xl border border-gray-700 focus:border-blue-500 focus:outline-none font-mono"
                />
                <button onClick={saveAdminKey}
                  className="px-4 py-2 bg-blue-700 rounded-xl text-sm font-bold hover:bg-blue-600 transition-colors">
                  {t('admin.save')}
                </button>
              </div>
              {adminKeyMsg && <p className="text-xs text-green-400 mt-2">{adminKeyMsg}</p>}
            </div>

            <div className="border-t border-gray-800 pt-4 mt-4">
              <p className="text-xs font-black uppercase tracking-widest text-gray-600 mb-2">{t('admin.tablet_reset')}</p>
              <p className="text-xs text-gray-600">{t('admin.tablet_reset_note', { key: STORAGE_KEY_HOME_ROOM })}</p>
            </div>
          </Card>
        </div>

        <p className="text-center text-gray-800 text-xs pb-4">{t('admin.footer')}</p>
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
