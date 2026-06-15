// backend/src/calendar/mock-calendar.service.ts
import { Injectable } from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { RoomStatus } from './domain/room-status.model';

@Injectable()
export class MockCalendarService implements CalendarService {
  async getRoomStatus(roomId: string): Promise<RoomStatus> {
    const now = new Date();
    const currentHour = now.getHours();
    
    // Terem-specifikus szimuláció (roomId alapján)
    let isOccupied = false;
    let title = null;
    let organizer = null;

    if (roomId.includes('Balaton')) {
      isOccupied = true; // A Balaton mindig foglalt (VIP)
      title = 'Vezetőségi értekezlet';
      organizer = 'Dr. Kovács István';
    } else if (roomId.includes('Mars')) {
      isOccupied = currentHour > 14; // A Mars csak délután foglalt
      title = 'Mars Colonization Sync';
      organizer = 'Elon M. (SpaceX)';
    } else if (roomId.includes('Séd')) {
      isOccupied = currentHour % 2 === 0; // A Séd páros órákban foglalt
      title = 'Heti Séd-Review';
      organizer = 'Nagy Anna';
    } else {
      isOccupied = false; // A többi alapértelmezetten szabad
    }

    const nextHour = new Date(now);
    nextHour.setHours(currentHour + 1, 0, 0, 0);
    const meetingEnd = new Date(now);
    meetingEnd.setHours(currentHour + 1, 0, 0, 0);

    return {
      roomId,
      isOccupied,
      currentMeetingTitle: isOccupied ? title : null,
      currentMeetingOrganizer: isOccupied ? organizer : null,
      currentMeetingEnd: isOccupied ? meetingEnd.toISOString() : null,
      nextMeetingStart: isOccupied ? null : nextHour.toISOString(),
      schedule: [],
    };
  }

async bookRoom(roomId: string, durationMinutes: number, organizer: string, startTime?: string): Promise<boolean> {
    
    // PoC logolás, hogy lássuk a jövőbeli foglalást is a teszt környezetben
    const startLog = startTime ? new Date(startTime).toLocaleTimeString('hu-HU') : 'Azonnal';
    console.log(`[Mock] Foglalás rögzítve: ${roomId} | Kezdés: ${startLog} | Időtartam: ${durationMinutes} perc`);
    
    return true; // Mindig sikeres a szimulációban
  }
}