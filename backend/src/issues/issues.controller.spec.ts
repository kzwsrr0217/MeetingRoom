import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { IssuesController } from './issues.controller';
import { IssuesService, type Issue } from './issues.service';

const mockIssue: Issue = {
  id: '1', roomId: 'mmh-sed', type: 'av', note: 'Projektor nem megy', createdAt: '2026-01-01T00:00:00.000Z',
};

const mockIssuesService = {
  create: jest.fn().mockReturnValue(mockIssue),
  findAll: jest.fn().mockReturnValue([mockIssue]),
  remove: jest.fn(),
};

describe('IssuesController', () => {
  let controller: IssuesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [IssuesController],
      providers: [{ provide: IssuesService, useValue: mockIssuesService }],
    }).compile();
    controller = module.get<IssuesController>(IssuesController);
    jest.clearAllMocks();
    mockIssuesService.create.mockReturnValue(mockIssue);
    mockIssuesService.findAll.mockReturnValue([mockIssue]);
  });

  describe('create()', () => {
    it('creates an issue with a valid type', () => {
      const result = controller.create({ roomId: 'mmh-sed', type: 'av', note: 'Projektor nem megy' });
      expect(result).toEqual(mockIssue);
      expect(mockIssuesService.create).toHaveBeenCalledWith('mmh-sed', 'av', 'Projektor nem megy');
    });

    it('defaults an empty note', () => {
      controller.create({ roomId: 'mmh-sed', type: 'other' });
      expect(mockIssuesService.create).toHaveBeenCalledWith('mmh-sed', 'other', '');
    });

    it('rejects a missing roomId', () => {
      expect(() => controller.create({ type: 'av' })).toThrow(BadRequestException);
    });

    it('rejects an unknown type', () => {
      expect(() => controller.create({ roomId: 'mmh-sed', type: 'nonsense' })).toThrow(BadRequestException);
    });

    it('truncates an over-long note', () => {
      controller.create({ roomId: 'mmh-sed', type: 'av', note: 'x'.repeat(999) });
      const noteArg = mockIssuesService.create.mock.calls[0][2];
      expect(noteArg.length).toBe(500);
    });
  });

  describe('findAll()', () => {
    it('returns the issue list', () => {
      expect(controller.findAll()).toEqual([mockIssue]);
    });
  });

  describe('remove()', () => {
    it('removes an issue', () => {
      expect(controller.remove('1')).toEqual({ success: true });
      expect(mockIssuesService.remove).toHaveBeenCalledWith('1');
    });
  });
});
