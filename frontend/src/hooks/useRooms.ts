import { useState, useEffect } from 'react';
import { ROOMS as STATIC_ROOMS, API_BASE } from '../config';

export interface Room {
  id: string;
  name: string;
  calendarEmail: string;
  order: number;
}

// Returns the room list — immediately the static fallback, then updated from the API.
// Components never see a loading state; they just get an updated list when it arrives.
export const useRooms = () => {
  const [rooms, setRooms] = useState<Room[]>(
    STATIC_ROOMS.map((name, i) => ({ id: name, name, calendarEmail: '', order: i })),
  );

  useEffect(() => {
    fetch(`${API_BASE}/rooms`)
      .then(r => r.json())
      .then((data: Room[]) => setRooms(data))
      .catch(() => {}); // keep static fallback if backend unreachable
  }, []);

  return rooms;
};

// Convenience: just the names, for components that only need the display list
export const useRoomNames = (): string[] => {
  const rooms = useRooms();
  return rooms.map(r => r.name);
};
