import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, HttpException } from '@nestjs/common';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';
import { RoomStatus } from './domain/room-status.model';

const mockStatus: RoomStatus = {
  roomId: 'MMH Séd',
  isOccupied: false,
  currentMeetingTitle: null,
  currentMeetingOrganizer: null,
  currentMeetingEnd: null,
  nextMeetingStart: '2026-01-01T12:00:00.000Z',
  schedule: [],
};

const mockCalendarService = {
  getRoomStatus: jest.fn().mockResolvedValue(mockStatus),
  bookRoom: jest.fn().mockResolvedValue(true),
  checkIn: jest.fn().mockResolvedValue(true),
  releaseNow: jest.fn().mockResolvedValue(true),
  extendMeeting: jest.fn().mockResolvedValue(true),
  getDiagnostics: jest.fn().mockReturnValue({ lastOkAt: null, lastErrorAt: null }),
};

describe('CalendarController', () => {
  let controller: CalendarController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CalendarController],
      providers: [
        { provide: CalendarService, useValue: mockCalendarService },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('true') },
        },
      ],
    }).compile();

    controller = module.get<CalendarController>(CalendarController);
    jest.clearAllMocks();
    mockCalendarService.getRoomStatus.mockResolvedValue(mockStatus);
    mockCalendarService.bookRoom.mockResolvedValue(true);
    mockCalendarService.checkIn.mockResolvedValue(true);
    mockCalendarService.releaseNow.mockResolvedValue(true);
    mockCalendarService.extendMeeting.mockResolvedValue(true);
  });

  describe('health()', () => {
    it('returns ok status in mock mode', () => {
      const result = controller.health();
      expect(result.status).toBe('ok');
      expect(result.mode).toBe('mock');
      expect(result.timestamp).toBeDefined();
    });

    it('returns graph mode when USE_MOCK_DATA is false', () => {
      // Re-create controller with USE_MOCK_DATA=false
      const configService = { get: jest.fn().mockReturnValue('false') } as any;
      const ctrl = new CalendarController(mockCalendarService as any, configService);
      const result = ctrl.health();
      expect(result.mode).toBe('graph');
    });
  });

  describe('getStatus()', () => {
    it('returns room status from service', async () => {
      const result = await controller.getStatus('MMH Séd');
      expect(result).toEqual(mockStatus);
      expect(mockCalendarService.getRoomStatus).toHaveBeenCalledWith('MMH Séd');
    });

    it('passes roomId to service unchanged', async () => {
      await controller.getStatus('MMH Balaton');
      expect(mockCalendarService.getRoomStatus).toHaveBeenCalledWith('MMH Balaton');
    });
  });

  describe('bookRoom()', () => {
    it('books a room and returns success', async () => {
      const result = await controller.bookRoom('MMH Séd', {
        durationMinutes: 30,
        organizer: 'Kovács Péter',
      });
      expect(result).toEqual({ success: true });
      expect(mockCalendarService.bookRoom).toHaveBeenCalledWith(
        'MMH Séd', 30, 'Kovács Péter', undefined, undefined,
      );
    });

    it('rejects a duration longer than 24 hours', async () => {
      await expect(
        controller.bookRoom('MMH Séd', { durationMinutes: 24 * 60 + 1, organizer: 'Test' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a non-integer duration', async () => {
      await expect(
        controller.bookRoom('MMH Séd', { durationMinutes: 12.5 as number, organizer: 'Test' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when durationMinutes is missing', async () => {
      await expect(
        controller.bookRoom('MMH Séd', { durationMinutes: 0, organizer: 'Test' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('falls back to Névtelen foglaló when organizer is empty', async () => {
      await controller.bookRoom('MMH Séd', { durationMinutes: 30, organizer: '' });
      expect(mockCalendarService.bookRoom).toHaveBeenCalledWith(
        'MMH Séd', 30, 'Névtelen foglaló', undefined, undefined,
      );
    });

    it('passes title and startTime through to service', async () => {
      const startTime = '2026-01-01T14:00:00.000Z';
      await controller.bookRoom('MMH Séd', { durationMinutes: 60, organizer: 'Test', title: 'Design review', startTime });
      expect(mockCalendarService.bookRoom).toHaveBeenCalledWith('MMH Séd', 60, 'Test', 'Design review', startTime);
    });
  });

  describe('checkIn()', () => {
    it('returns success when a meeting is running', async () => {
      const result = await controller.checkIn('MMH Séd');
      expect(result).toEqual({ success: true });
      expect(mockCalendarService.checkIn).toHaveBeenCalledWith('MMH Séd');
    });

    it('returns 409 when nothing is running', async () => {
      mockCalendarService.checkIn.mockResolvedValue(false);
      await expect(controller.checkIn('MMH Séd')).rejects.toThrow(HttpException);
    });
  });

  describe('release()', () => {
    it('releases the current meeting', async () => {
      const result = await controller.release('MMH Séd');
      expect(result).toEqual({ success: true });
      expect(mockCalendarService.releaseNow).toHaveBeenCalledWith('MMH Séd');
    });

    it('returns 409 when nothing to release', async () => {
      mockCalendarService.releaseNow.mockResolvedValue(false);
      await expect(controller.release('MMH Séd')).rejects.toThrow(HttpException);
    });
  });

  describe('extend()', () => {
    it('extends the current meeting', async () => {
      const result = await controller.extend('MMH Séd', { minutes: 15 });
      expect(result).toEqual({ success: true });
      expect(mockCalendarService.extendMeeting).toHaveBeenCalledWith('MMH Séd', 15);
    });

    it('rejects an invalid extension', async () => {
      await expect(controller.extend('MMH Séd', { minutes: 0 })).rejects.toThrow(BadRequestException);
      await expect(controller.extend('MMH Séd', { minutes: 999 })).rejects.toThrow(BadRequestException);
    });
  });
});
