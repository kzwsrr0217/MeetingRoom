import { ConflictException } from '@nestjs/common';
import { MockCalendarService } from './mock-calendar.service';

describe('MockCalendarService', () => {
  let service: MockCalendarService;

  beforeEach(() => {
    service = new MockCalendarService();
  });

  describe('getRoomStatus — time-based simulation', () => {
    it('Balaton is always occupied', async () => {
      const status = await service.getRoomStatus('MMH Balaton');
      expect(status.roomId).toBe('MMH Balaton');
      expect(status.isOccupied).toBe(true);
      expect(status.currentMeetingTitle).toBe('Vezetőségi értekezlet');
      expect(status.currentMeetingOrganizer).toBe('Dr. Kovács István');
      expect(status.currentMeetingEnd).not.toBeNull();
      expect(status.nextMeetingStart).toBeNull();
    });

    it('Mars is free before 15:00', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-01-01T13:00:00'));
      const status = await service.getRoomStatus('MMH Mars');
      expect(status.isOccupied).toBe(false);
      expect(status.nextMeetingStart).not.toBeNull();
      jest.useRealTimers();
    });

    it('Mars is occupied at 15:00 or later', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-01-01T15:30:00'));
      const status = await service.getRoomStatus('MMH Mars');
      expect(status.isOccupied).toBe(true);
      expect(status.currentMeetingTitle).toBe('Mars Colonization Sync');
      jest.useRealTimers();
    });

    it('Séd is occupied on even hours', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-01-01T10:00:00'));
      const status = await service.getRoomStatus('MMH Séd');
      expect(status.isOccupied).toBe(true);
      expect(status.currentMeetingTitle).toBe('Heti Séd-Review');
      jest.useRealTimers();
    });

    it('Séd is free on odd hours', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-01-01T11:00:00'));
      const status = await service.getRoomStatus('MMH Séd');
      expect(status.isOccupied).toBe(false);
      jest.useRealTimers();
    });

    it('matches ad-hoc occupancy by slug id (mmh-balaton), not just the name', async () => {
      const status = await service.getRoomStatus('mmh-balaton');
      expect(status.isOccupied).toBe(true);
      expect(status.currentMeetingTitle).toBe('Vezetőségi értekezlet');
    });

    it('matches accent-stripped slug id (mmh-sed) on even hours', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-01-01T10:00:00'));
      const status = await service.getRoomStatus('mmh-sed');
      expect(status.isOccupied).toBe(true);
      expect(status.currentMeetingTitle).toBe('Heti Séd-Review');
      jest.useRealTimers();
    });

    it('unknown room is free by default', async () => {
      const status = await service.getRoomStatus('MMH Tihany');
      expect(status.isOccupied).toBe(false);
      expect(status.currentMeetingTitle).toBeNull();
      expect(status.currentMeetingOrganizer).toBeNull();
    });

    it('free room has nextMeetingStart and no currentMeetingEnd', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-01-01T11:00:00'));
      const status = await service.getRoomStatus('MMH Séd');
      expect(status.currentMeetingEnd).toBeNull();
      expect(status.nextMeetingStart).not.toBeNull();
      jest.useRealTimers();
    });

    it('occupied room has currentMeetingEnd and no nextMeetingStart', async () => {
      const status = await service.getRoomStatus('MMH Balaton');
      expect(status.currentMeetingEnd).not.toBeNull();
      expect(status.nextMeetingStart).toBeNull();
    });

    it('returns simulated schedule for time-based rooms', async () => {
      const status = await service.getRoomStatus('MMH Balaton');
      expect(status.schedule.length).toBeGreaterThan(0);
      expect(status.schedule[0]).toHaveProperty('start');
      expect(status.schedule[0]).toHaveProperty('title');
    });
  });

  describe('bookRoom — in-memory state', () => {
    it('returns true', async () => {
      const result = await service.bookRoom('MMH Séd', 30, 'Kovács Péter');
      expect(result).toBe(true);
    });

    it('booking flips a free room to occupied immediately', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-01-01T11:00:00')); // odd hour — Séd is free
      await service.bookRoom('MMH Séd', 30, 'Kovács Péter');
      const status = await service.getRoomStatus('MMH Séd');
      expect(status.isOccupied).toBe(true);
      expect(status.currentMeetingOrganizer).toBe('Kovács Péter');
      expect(status.currentMeetingEnd).not.toBeNull();
      jest.useRealTimers();
    });

    it('booking respects duration — room is free after it expires', async () => {
      const start = new Date('2026-01-01T11:00:00');
      jest.useFakeTimers().setSystemTime(start);
      await service.bookRoom('MMH Séd', 30, 'Nagy Anna');

      // 31 minutes later — booking has expired
      jest.setSystemTime(new Date('2026-01-01T11:31:00'));
      const status = await service.getRoomStatus('MMH Séd');
      expect(status.isOccupied).toBe(false); // back to odd-hour = free
      jest.useRealTimers();
    });

    it('booking sets the correct end time', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-01-01T11:00:00'));
      await service.bookRoom('MMH Tihany', 60, 'Teszt');
      const status = await service.getRoomStatus('MMH Tihany');
      const end = new Date(status.currentMeetingEnd!);
      expect(end.getHours()).toBe(12);
      expect(end.getMinutes()).toBe(0);
      jest.useRealTimers();
    });

    it('accepts optional startTime for future booking', async () => {
      const result = await service.bookRoom('MMH Bakony', 60, 'Nagy Anna', '2026-01-01T14:00:00.000Z');
      expect(result).toBe(true);
    });

    it('rejects a second overlapping booking with ConflictException', async () => {
      const start = new Date(Date.now() + 60 * 60000).toISOString(); // +1h
      await service.bookRoom('MMH Tihany', 60, 'Első', 'Megbeszélés', start);
      await expect(
        service.bookRoom('MMH Tihany', 60, 'Második', 'Másik', start),
      ).rejects.toThrow(ConflictException);
    });

    it('allows a booking in a free slot that does not overlap', async () => {
      const first = new Date(Date.now() + 60 * 60000).toISOString();     // +1h, 30 min
      const later = new Date(Date.now() + 3 * 60 * 60000).toISOString(); // +3h, 30 min
      await service.bookRoom('MMH Tihany', 30, 'Első', undefined, first);
      const result = await service.bookRoom('MMH Tihany', 30, 'Második', undefined, later);
      expect(result).toBe(true);
    });

    it('active booking appears in schedule so the timeline can render it', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-01-01T11:00:00'));
      await service.bookRoom('MMH Tihany', 60, 'Kovács Péter');
      const status = await service.getRoomStatus('MMH Tihany');
      expect(status.schedule).toHaveLength(1);
      expect(status.schedule[0].title).toBe('Gyors foglalás (60 perc)');
      expect(status.schedule[0].organizer).toBe('Kovács Péter');
      expect(status.schedule[0].start).toBe(new Date('2026-01-01T11:00:00').toISOString());
      expect(status.schedule[0].end).toBe(new Date('2026-01-01T12:00:00').toISOString());
      jest.useRealTimers();
    });

    it('each service instance has isolated booking state', async () => {
      const other = new MockCalendarService();
      jest.useFakeTimers().setSystemTime(new Date('2026-01-01T11:00:00'));
      await service.bookRoom('MMH Séd', 30, 'Test');
      const statusInOther = await other.getRoomStatus('MMH Séd');
      expect(statusInOther.isOccupied).toBe(false); // other instance has no booking
      jest.useRealTimers();
    });
  });

  describe('meeting lifecycle — check-in / no-show / release / extend', () => {
    it('a running booking initially requires check-in', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-01-01T11:00:00'));
      await service.bookRoom('MMH Tihany', 30, 'Késő');
      const status = await service.getRoomStatus('MMH Tihany');
      expect(status.isOccupied).toBe(true);
      expect(status.checkInRequired).toBe(true);
      expect(status.currentMeetingCheckedIn).toBe(false);
      expect(status.autoReleaseAt).not.toBeNull();
      jest.useRealTimers();
    });

    it('auto-releases a no-show booking after the grace period', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-01-01T11:00:00'));
      await service.bookRoom('MMH Tihany', 30, 'Késő');
      jest.setSystemTime(new Date('2026-01-01T11:11:00')); // past the 10-min grace
      const status = await service.getRoomStatus('MMH Tihany');
      expect(status.isOccupied).toBe(false);
      jest.useRealTimers();
    });

    it('a checked-in booking is not auto-released', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-01-01T11:00:00'));
      await service.bookRoom('MMH Tihany', 30, 'Pontos');
      expect(await service.checkIn('MMH Tihany')).toBe(true);
      jest.setSystemTime(new Date('2026-01-01T11:11:00'));
      const status = await service.getRoomStatus('MMH Tihany');
      expect(status.isOccupied).toBe(true);
      expect(status.currentMeetingCheckedIn).toBe(true);
      expect(status.checkInRequired).toBe(false);
      jest.useRealTimers();
    });

    it('checkIn returns false when no meeting is running', async () => {
      expect(await service.checkIn('MMH Tihany')).toBe(false);
    });

    it('releaseNow frees the room immediately', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-01-01T11:00:00'));
      await service.bookRoom('MMH Tihany', 60, 'X');
      expect(await service.releaseNow('MMH Tihany')).toBe(true);
      const status = await service.getRoomStatus('MMH Tihany');
      expect(status.isOccupied).toBe(false);
      jest.useRealTimers();
    });

    it('releaseNow returns false when nothing is running', async () => {
      expect(await service.releaseNow('MMH Tihany')).toBe(false);
    });

    it('extendMeeting moves the end time out', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-01-01T11:00:00'));
      await service.bookRoom('MMH Tihany', 30, 'X'); // ends 11:30
      expect(await service.extendMeeting('MMH Tihany', 15)).toBe(true);
      const status = await service.getRoomStatus('MMH Tihany');
      const end = new Date(status.currentMeetingEnd!);
      expect(end.getHours()).toBe(11);
      expect(end.getMinutes()).toBe(45);
      jest.useRealTimers();
    });
  });
});
