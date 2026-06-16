import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';
import type { Room } from './room.model';

const mockRoom: Room = { id: 'mmh-sed', name: 'MMH Séd', calendarEmail: '', order: 0 };

const mockRoomsService = {
  findAll: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  reset: jest.fn(),
};

describe('RoomsController', () => {
  let controller: RoomsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RoomsController],
      providers: [{ provide: RoomsService, useValue: mockRoomsService }],
    }).compile();

    controller = module.get<RoomsController>(RoomsController);
    jest.clearAllMocks();
    mockRoomsService.findAll.mockReturnValue([mockRoom]);
    mockRoomsService.create.mockReturnValue(mockRoom);
    mockRoomsService.update.mockReturnValue(mockRoom);
    mockRoomsService.reset.mockReturnValue([mockRoom]);
  });

  describe('findAll()', () => {
    it('returns rooms from service', () => {
      const result = controller.findAll();
      expect(result).toEqual([mockRoom]);
      expect(mockRoomsService.findAll).toHaveBeenCalledTimes(1);
    });
  });

  describe('create()', () => {
    it('creates a room with name and calendarEmail', () => {
      const result = controller.create({ name: 'MMH Séd', calendarEmail: '' });
      expect(result).toEqual(mockRoom);
      expect(mockRoomsService.create).toHaveBeenCalledWith('MMH Séd', '');
    });

    it('defaults calendarEmail to empty string when omitted', () => {
      controller.create({ name: 'Test' });
      expect(mockRoomsService.create).toHaveBeenCalledWith('Test', '');
    });

    it('throws BadRequestException when name is empty', () => {
      expect(() => controller.create({ name: '' })).toThrow(BadRequestException);
    });

    it('throws BadRequestException when name is whitespace only', () => {
      expect(() => controller.create({ name: '   ' })).toThrow(BadRequestException);
    });

    it('wraps service errors as BadRequestException', () => {
      mockRoomsService.create.mockImplementation(() => {
        throw new Error('already exists');
      });
      expect(() => controller.create({ name: 'MMH Séd' })).toThrow(BadRequestException);
    });
  });

  describe('update()', () => {
    it('delegates to service and returns updated room', () => {
      const result = controller.update('mmh-sed', { name: 'New Name' });
      expect(result).toEqual(mockRoom);
      expect(mockRoomsService.update).toHaveBeenCalledWith('mmh-sed', { name: 'New Name' });
    });

    it('throws NotFoundException for unknown room id', () => {
      mockRoomsService.update.mockImplementation(() => {
        throw new Error('not found');
      });
      expect(() => controller.update('unknown', { name: 'x' })).toThrow(NotFoundException);
    });
  });

  describe('remove()', () => {
    it('returns { success: true }', () => {
      const result = controller.remove('mmh-sed');
      expect(result).toEqual({ success: true });
      expect(mockRoomsService.remove).toHaveBeenCalledWith('mmh-sed');
    });

    it('throws NotFoundException for unknown room id', () => {
      mockRoomsService.remove.mockImplementation(() => {
        throw new Error('not found');
      });
      expect(() => controller.remove('unknown')).toThrow(NotFoundException);
    });
  });

  describe('reset()', () => {
    it('returns the reset room list from service', () => {
      const result = controller.reset();
      expect(result).toEqual([mockRoom]);
      expect(mockRoomsService.reset).toHaveBeenCalled();
    });
  });
});
