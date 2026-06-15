import { useState, useEffect, useCallback } from 'react';

export interface RoomStatus {
  roomId: string;
  isOccupied: boolean;
  currentMeetingTitle: string | null;
  currentMeetingOrganizer: string | null;
  currentMeetingEnd: string | null;
  nextMeetingStart: string | null;
  schedule: { start: string; end: string; title: string; organizer: string }[];
}

import { API_BASE } from '../config';

export const useRoomStatus = (roomId: string, refreshIntervalMs = 10000) => {
  const [status, setStatus] = useState<RoomStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/calendar/room/${roomId}/status`);
      if (!response.ok) throw new Error('Hálózati hiba a letöltésnél');
      
      const data: RoomStatus = await response.json();
      setStatus(data);
      setError(null);
    } catch (err) {
      setError('Nem sikerült kapcsolódni a szerverhez.');
      console.error("Lekérdezési hiba:", err);
    }
  }, [roomId]);

  useEffect(() => {
    fetchStatus();
    const intervalId = setInterval(fetchStatus, refreshIntervalMs);
    return () => clearInterval(intervalId);
  }, [fetchStatus, refreshIntervalMs]);

  // ÚJ: startTime hozzáadva (Date formátumban érkezik, stringként küldjük)
  const bookRoom = async (durationMinutes: number, organizer: string, startTime?: Date) => {
    try {
      const response = await fetch(`${API_BASE}/calendar/room/${roomId}/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          durationMinutes,
          organizer,
          ...(startTime && { startTime: startTime.toISOString() }) // Csak akkor küldjük, ha van
        }),
      });

      if (!response.ok) throw new Error('Sikertelen foglalás a backend oldalon');
      
      await fetchStatus();
      return true;
    } catch (err) {
      console.error("API hiba a foglalásnál:", err);
      return false;
    }
  };

  return { status, error, bookRoom, fetchStatus };
};