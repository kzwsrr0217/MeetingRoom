import { RoomStatus } from './domain/room-status.model';

export abstract class CalendarService {
  abstract getRoomStatus(roomId: string): Promise<RoomStatus>;
  abstract bookRoom(roomId: string, durationMinutes: number, organizer: string, startTime?: string): Promise<boolean>;

  // No-op in mock mode; GraphCalendarService overrides to re-init the Graph client
  updateToken(_token: string): void {}
}
