import { useState, useEffect, useCallback } from 'react';
import { API_BASE, STATUS_POLL_MS } from '../config';

export interface RoomStatus {
  roomId: string;
  isOccupied: boolean;
  currentMeetingTitle: string | null;
  currentMeetingOrganizer: string | null;
  currentMeetingEnd: string | null;
  nextMeetingStart: string | null;
  schedule: { start: string; end: string; title: string; organizer: string }[];
  currentMeetingId?: string | null;
  currentMeetingCheckedIn?: boolean;
  checkInRequired?: boolean;
  autoReleaseAt?: string | null;
}

export const useRoomStatus = (roomId: string, refreshIntervalMs = STATUS_POLL_MS) => {
  const [status, setStatus] = useState<RoomStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/calendar/room/${encodeURIComponent(roomId)}/status`);

      if (response.status === 401) {
        setError('A Microsoft Graph token lejárt. Kérje az adminisztrátor frissítse az /admin oldalon.');
        return;
      }
      if (!response.ok) throw new Error('Hálózati hiba a letöltésnél');

      const data: RoomStatus = await response.json();
      setStatus(data);
      setError(null);
    } catch (err) {
      setError('Nem sikerült kapcsolódni a szerverhez.');
      console.error('Lekérdezési hiba:', err);
    }
  }, [roomId]);

  useEffect(() => {
    fetchStatus();
    const intervalId = setInterval(fetchStatus, refreshIntervalMs);
    return () => clearInterval(intervalId);
  }, [fetchStatus, refreshIntervalMs]);

  // Returns null on success, or an error string the caller can show in a toast.
  const bookRoom = async (
    durationMinutes: number,
    organizer: string,
    title: string,
    startTime?: Date,
  ): Promise<string | null> => {
    try {
      const response = await fetch(
        `${API_BASE}/calendar/room/${encodeURIComponent(roomId)}/book`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            durationMinutes,
            organizer,
            ...(title && { title }),
            ...(startTime && { startTime: startTime.toISOString() }),
          }),
        },
      );

      if (!response.ok) {
        if (response.status === 401)
          return 'A Graph token lejárt — kérje az adminisztrátor frissítse az /admin oldalon.';
        const body = await response.json().catch(() => ({}));
        return body.message ?? 'A foglalás nem sikerült.';
      }

      await fetchStatus();
      return null; // success
    } catch (err) {
      console.error('API hiba a foglalásnál:', err);
      return 'Nem sikerült kapcsolódni a szerverhez.';
    }
  };

  // Shared helper for the on-panel lifecycle actions (check-in / release / extend).
  // Returns null on success, or an error string the caller can show in a toast.
  const action = async (path: string, body?: object): Promise<string | null> => {
    try {
      const response = await fetch(`${API_BASE}/calendar/room/${encodeURIComponent(roomId)}/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        return data.message ?? 'A művelet nem sikerült.';
      }
      await fetchStatus();
      return null;
    } catch (err) {
      console.error(`API hiba (${path}):`, err);
      return 'Nem sikerült kapcsolódni a szerverhez.';
    }
  };

  const checkIn = () => action('checkin');
  const releaseNow = () => action('release');
  const extend = (minutes: number) => action('extend', { minutes });

  return { status, error, bookRoom, fetchStatus, checkIn, releaseNow, extend };
};
