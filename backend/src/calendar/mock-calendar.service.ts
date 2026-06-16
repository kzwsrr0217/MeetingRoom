import { Injectable } from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { RoomStatus } from './domain/room-status.model';

interface ActiveBooking {
  start: Date;
  end: Date;
  title: string;
  organizer: string;
}

type ScheduleEntry = { start: string; end: string; title: string; organizer: string };

@Injectable()
export class MockCalendarService extends CalendarService {
  // In-memory store: bookings made via the kiosk persist until they expire
  private readonly activeBookings = new Map<string, ActiveBooking>();

  // Fixed daily schedule per room for demo purposes (relative to today)
  private getSimulatedSchedule(roomId: string): ScheduleEntry[] {
    const at = (h: number, m = 0): string => {
      const d = new Date();
      d.setHours(h, m, 0, 0);
      return d.toISOString();
    };

    if (roomId.includes('Balaton')) {
      return [
        { start: at(8, 0),  end: at(9, 0),  title: 'Vezetőségi értekezlet',  organizer: 'Dr. Kovács István' },
        { start: at(10, 0), end: at(11, 30), title: 'Q2 Tervezési megbeszélés', organizer: 'Szabó Péter' },
        { start: at(13, 30), end: at(14, 30), title: 'Ügyfél bemutató',        organizer: 'Horváth Kata' },
        { start: at(15, 0), end: at(16, 30), title: 'Sprint Review',           organizer: 'Dr. Kovács István' },
      ];
    }
    if (roomId.includes('Mars')) {
      return [
        { start: at(15, 0), end: at(17, 0), title: 'Mars Colonization Sync', organizer: 'Elon M. (SpaceX)' },
      ];
    }
    if (roomId.includes('Séd')) {
      return [
        { start: at(8,  0), end: at(9,  0), title: 'Heti Séd-Review', organizer: 'Nagy Anna' },
        { start: at(10, 0), end: at(11, 0), title: 'Heti Séd-Review', organizer: 'Nagy Anna' },
        { start: at(12, 0), end: at(13, 0), title: 'Heti Séd-Review', organizer: 'Nagy Anna' },
        { start: at(14, 0), end: at(15, 0), title: 'Heti Séd-Review', organizer: 'Nagy Anna' },
        { start: at(16, 0), end: at(17, 0), title: 'Heti Séd-Review', organizer: 'Nagy Anna' },
      ];
    }
    return [];
  }

  async getRoomStatus(roomId: string): Promise<RoomStatus> {
    const now = new Date();
    const currentHour = now.getHours();

    // Clean expired booking
    const booking = this.activeBookings.get(roomId);
    if (booking && booking.end <= now) this.activeBookings.delete(roomId);

    const pending = this.activeBookings.get(roomId) ?? null;
    const isCurrent = pending !== null && pending.start <= now;

    if (isCurrent) {
      const simulated = this.getSimulatedSchedule(roomId);
      const merged = [
        { start: pending.start.toISOString(), end: pending.end.toISOString(), title: pending.title, organizer: pending.organizer },
        ...simulated.filter(e => e.start !== pending.start.toISOString()),
      ].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

      return {
        roomId,
        isOccupied: true,
        currentMeetingTitle: pending.title,
        currentMeetingOrganizer: pending.organizer,
        currentMeetingEnd: pending.end.toISOString(),
        nextMeetingStart: null,
        schedule: merged,
      };
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

    // Include a future booking in the schedule so the timeline shows it
    const simulated = this.getSimulatedSchedule(roomId);
    const schedule = pending
      ? [
          ...simulated.filter(e => e.start !== pending.start.toISOString()),
          { start: pending.start.toISOString(), end: pending.end.toISOString(), title: pending.title, organizer: pending.organizer },
        ].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
      : simulated;

    return {
      roomId,
      isOccupied,
      currentMeetingTitle: isOccupied ? title : null,
      currentMeetingOrganizer: isOccupied ? organizer : null,
      currentMeetingEnd: isOccupied ? hourEnd.toISOString() : null,
      nextMeetingStart: isOccupied ? null : (pending ? pending.start.toISOString() : hourEnd.toISOString()),
      schedule,
    };
  }

  async bookRoom(
    roomId: string,
    durationMinutes: number,
    organizer: string,
    title?: string,
    startTime?: string,
  ): Promise<boolean> {
    const start = startTime ? new Date(startTime) : new Date();
    const end = new Date(start.getTime() + durationMinutes * 60000);
    const resolvedTitle = title?.trim() || `Gyors foglalás (${durationMinutes} perc)`;

    this.activeBookings.set(roomId, { start, end, title: resolvedTitle, organizer });

    console.log(
      `[Mock] Foglalás rögzítve: ${roomId} | ${resolvedTitle} | Kezdés: ${start.toLocaleTimeString('hu-HU')} | Vége: ${end.toLocaleTimeString('hu-HU')} | Szervező: ${organizer}`,
    );
    return true;
  }
}
