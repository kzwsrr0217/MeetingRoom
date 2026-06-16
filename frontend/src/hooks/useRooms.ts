import { useState, useEffect } from 'react';
import { ROOMS as STATIC_ROOMS, API_BASE } from '../config';

export interface Room {
  id: string;
  name: string;
  calendarEmail: string;
  order: number;
}

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes — propagates admin room changes to kiosks

// Returns the room list — immediately the static fallback, then updated from the API.
// Polls every 5 minutes so adds/renames/deletes from the admin page propagate automatically.
export const useRooms = () => {
  const [rooms, setRooms] = useState<Room[]>(
    STATIC_ROOMS.map((name, i) => ({ id: name, name, calendarEmail: '', order: i })),
  );

  useEffect(() => {
    const fetchRooms = () =>
      fetch(`${API_BASE}/rooms`)
        .then(r => r.json())
        .then((data: Room[]) => setRooms(data))
        .catch(() => {});

    fetchRooms();
    const id = setInterval(fetchRooms, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return rooms;
};

// Convenience: just the names, for components that only need the display list
export const useRoomNames = (): string[] => {
  const rooms = useRooms();
  return rooms.map(r => r.name);
};
