import { Injectable } from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { RoomStatus } from './domain/room-status.model';

interface ActiveBooking {
  end: Date;
  title: string;
  organizer: string;
}

@Injectable()
export class MockCalendarService implements CalendarService {
  // In-memory store: bookings made via the kiosk persist until they expire
  private readonly activeBookings = new Map<string, ActiveBooking>();

  async getRoomStatus(roomId: string): Promise<RoomStatus> {
    const now = new Date();
    const currentHour = now.getHours();

    // Active kiosk booking takes priority over the time-based simulation
    const booking = this.activeBookings.get(roomId);
    if (booking) {
      if (booking.end > now) {
        return {
          roomId,
          isOccupied: true,
          currentMeetingTitle: booking.title,
          currentMeetingOrganizer: booking.organizer,
          currentMeetingEnd: booking.end.toISOString(),
          nextMeetingStart: null,
          schedule: [],
        };
      }
      this.activeBookings.delete(roomId);
    }

    // Time-based simulation (room-specific)
    let isOccupied = false;
    let title: string | null = null;
    let organizer: string | null = null;

    if (roomId.includes('Balaton')) {
      isOccupied = true;
      title = 'Vezetőségi értekezlet';
      organizer = 'Dr. Kovács István';
    } else if (roomId.includes('Mars')) {
      isOccupied = currentHour > 14;
      title = 'Mars Colonization Sync';
      organizer = 'Elon M. (SpaceX)';
    } else if (roomId.includes('Séd')) {
      isOccupied = currentHour % 2 === 0;
      title = 'Heti Séd-Review';
      organizer = 'Nagy Anna';
    }

    const hourEnd = new Date(now);
    hourEnd.setHours(currentHour + 1, 0, 0, 0);

    return {
      roomId,
      isOccupied,
      currentMeetingTitle: isOccupied ? title : null,
      currentMeetingOrganizer: isOccupied ? organizer : null,
      currentMeetingEnd: isOccupied ? hourEnd.toISOString() : null,
      nextMeetingStart: isOccupied ? null : hourEnd.toISOString(),
      schedule: [],
    };
  }

  async bookRoom(roomId: string, durationMinutes: number, organizer: string, startTime?: string): Promise<boolean> {
    const start = startTime ? new Date(startTime) : new Date();
    const end = new Date(start.getTime() + durationMinutes * 60000);

    this.activeBookings.set(roomId, {
      end,
      title: `Gyors foglalás (${durationMinutes} perc)`,
      organizer,
    });

    console.log(`[Mock] Foglalás rögzítve: ${roomId} | Kezdés: ${start.toLocaleTimeString('hu-HU')} | Vége: ${end.toLocaleTimeString('hu-HU')} | Szervező: ${organizer}`);
    return true;
  }
}
