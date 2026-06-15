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

    it('returns schedule as empty array', async () => {
      const status = await service.getRoomStatus('MMH Balaton');
      expect(status.schedule).toEqual([]);
    });
  });

  describe('bookRoom — in-memory state', () => {
    it('returns true', async () => {
      const result = await service.bookRoom('MMH Séd', 30, 'Kovács Péter');
      expect(result).toBe(true);
    });

    it('booking flips a free room to occupied immediately', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-01-01T11:00:00')); // Séd is free at odd hour
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

    it('each service instance has isolated booking state', async () => {
      const other = new MockCalendarService();
      jest.useFakeTimers().setSystemTime(new Date('2026-01-01T11:00:00'));
      await service.bookRoom('MMH Séd', 30, 'Test');
      const statusInOther = await other.getRoomStatus('MMH Séd');
      expect(statusInOther.isOccupied).toBe(false); // other instance has no booking
      jest.useRealTimers();
    });
  });
});
