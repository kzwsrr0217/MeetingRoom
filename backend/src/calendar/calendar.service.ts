import { RoomStatus } from './domain/room-status.model';

export abstract class CalendarService {
  abstract getRoomStatus(roomId: string): Promise<RoomStatus>;
  
  // JAVÍTÁS: Itt is jelezzük, hogy jöhet egy 4. paraméter (startTime)
  abstract bookRoom(
    roomId: string, 
    durationMinutes: number, 
    organizer: string, 
    startTime?: string
  ): Promise<boolean>;
}