import * as fs from 'fs';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AppConfigController } from './app-config.controller';
import { CalendarService } from '../calendar/calendar.service';

jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

// Minimal valid 3-part JWT with exp claim
const makeJwt = (exp: number) =>
  [
    Buffer.from('{"alg":"none"}').toString('base64url'),
    Buffer.from(JSON.stringify({ exp, sub: 'test' })).toString('base64url'),
    'sig',
  ].join('.');

const FUTURE_JWT = makeJwt(9999999999); // year 2286

const mockCalendarService = {
  updateToken: jest.fn(),
  getRoomStatus: jest.fn(),
  bookRoom: jest.fn(),
};

describe('AppConfigController', () => {
  let controller: AppConfigController;

  beforeEach(async () => {
    jest.resetAllMocks();
    delete process.env.GRAPH_TEMP_TOKEN;

    mockFs.existsSync.mockReturnValue(false);
    mockFs.mkdirSync.mockImplementation(() => undefined as any);
    mockFs.writeFileSync.mockImplementation(() => undefined);
    mockFs.readFileSync.mockReturnValue('' as any);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppConfigController],
      providers: [{ provide: CalendarService, useValue: mockCalendarService }],
    }).compile();

    controller = module.get<AppConfigController>(AppConfigController);
  });

  afterEach(() => {
    delete process.env.GRAPH_TEMP_TOKEN;
  });

  // ── getTokenStatus ───────────────────────────────────────────────────────────

  describe('getTokenStatus()', () => {
    it('returns hasToken false when GRAPH_TEMP_TOKEN is not set', () => {
      const result = controller.getTokenStatus();
      expect(result).toEqual({ hasToken: false, expiresAt: null });
    });

    it('returns hasToken true with expiresAt when a valid JWT is in env', () => {
      process.env.GRAPH_TEMP_TOKEN = FUTURE_JWT;
      const result = controller.getTokenStatus();
      expect(result.hasToken).toBe(true);
      expect(result.expiresAt).not.toBeNull();
    });

    it('returns a future expiresAt date for a future token', () => {
      process.env.GRAPH_TEMP_TOKEN = FUTURE_JWT;
      const result = controller.getTokenStatus();
      expect(new Date(result.expiresAt!).getTime()).toBeGreaterThan(Date.now());
    });
  });

  // ── updateToken ──────────────────────────────────────────────────────────────

  describe('updateToken()', () => {
    beforeEach(() => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('USE_MOCK_DATA=true\n' as any);
    });

    it('throws BadRequestException when token is empty', () => {
      expect(() => controller.updateToken({ token: '' })).toThrow(BadRequestException);
    });

    it('throws BadRequestException when token is whitespace only', () => {
      expect(() => controller.updateToken({ token: '   ' })).toThrow(BadRequestException);
    });

    it('calls calendarService.updateToken with the trimmed token', () => {
      controller.updateToken({ token: ` ${FUTURE_JWT} ` });
      expect(mockCalendarService.updateToken).toHaveBeenCalledWith(FUTURE_JWT);
    });

    it('sets process.env.GRAPH_TEMP_TOKEN', () => {
      controller.updateToken({ token: FUTURE_JWT });
      expect(process.env.GRAPH_TEMP_TOKEN).toBe(FUTURE_JWT);
    });

    it('returns { success: true } with expiresAt', () => {
      const result = controller.updateToken({ token: FUTURE_JWT });
      expect(result.success).toBe(true);
      expect(result.expiresAt).not.toBeNull();
    });

    it('writes the updated .env via fs', () => {
      controller.updateToken({ token: FUTURE_JWT });
      expect(mockFs.writeFileSync).toHaveBeenCalled();
    });
  });

  // ── getPresetNames ───────────────────────────────────────────────────────────

  describe('getPresetNames()', () => {
    it('returns default names when config file does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);
      const names = controller.getPresetNames();
      expect(Array.isArray(names)).toBe(true);
      expect(names.length).toBeGreaterThan(0);
      expect(names).toContain('Kovács Péter');
    });

    it('returns names from config.json when the file exists', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({ presetNames: ['Alice', 'Bob'] }) as any,
      );
      const names = controller.getPresetNames();
      expect(names).toEqual(['Alice', 'Bob']);
    });
  });

  // ── setPresetNames ───────────────────────────────────────────────────────────

  describe('setPresetNames()', () => {
    it('throws BadRequestException when names is not an array', () => {
      expect(() =>
        controller.setPresetNames({ names: 'invalid' as any }),
      ).toThrow(BadRequestException);
    });

    it('saves and returns the name list', () => {
      mockFs.existsSync.mockReturnValue(false);
      const result = controller.setPresetNames({ names: ['Alice', 'Bob'] });
      expect(result).toEqual(['Alice', 'Bob']);
    });

    it('writes to config.json', () => {
      mockFs.existsSync.mockReturnValue(false);
      controller.setPresetNames({ names: ['Alice', 'Bob'] });
      expect(mockFs.writeFileSync).toHaveBeenCalled();
    });

    it('filters out empty and whitespace-only strings', () => {
      mockFs.existsSync.mockReturnValue(false);
      const result = controller.setPresetNames({ names: ['Alice', '', '  ', 'Bob'] });
      expect(result).toEqual(['Alice', 'Bob']);
    });

    it('accepts an empty array', () => {
      mockFs.existsSync.mockReturnValue(false);
      const result = controller.setPresetNames({ names: [] });
      expect(result).toEqual([]);
    });
  });
});
