import * as fs from 'fs';
import { RoomsService } from './rooms.service';

jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('RoomsService', () => {
  let service: RoomsService;

  beforeEach(() => {
    jest.resetAllMocks();
    mockFs.existsSync.mockReturnValue(false);
    mockFs.mkdirSync.mockImplementation(() => undefined as any);
    mockFs.writeFileSync.mockImplementation(() => undefined);
    service = new RoomsService();
    service.onModuleInit();
  });

  // ── findAll ──────────────────────────────────────────────────────────────────

  describe('findAll()', () => {
    it('returns 6 default rooms on first boot', () => {
      expect(service.findAll()).toHaveLength(6);
    });

    it('returns rooms sorted by order', () => {
      const rooms = service.findAll();
      for (let i = 0; i < rooms.length - 1; i++) {
        expect(rooms[i].order).toBeLessThan(rooms[i + 1].order);
      }
    });

    it('first default room is MMH Séd', () => {
      expect(service.findAll()[0].name).toBe('MMH Séd');
    });
  });

  // ── create ───────────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('creates a room with slugified id', () => {
      const room = service.create('Test Tárgyaló');
      expect(room.id).toBe('test-targyalo');
      expect(room.name).toBe('Test Tárgyaló');
    });

    it('creates a room with calendarEmail', () => {
      const room = service.create('MMH Jupiter', 'jupiter@test.hu');
      expect(room.calendarEmail).toBe('jupiter@test.hu');
    });

    it('assigns order equal to current room count', () => {
      const room = service.create('New Room');
      expect(room.order).toBe(6); // 6 defaults already loaded
    });

    it('throws when a room with the same id already exists', () => {
      service.create('Unique Room');
      expect(() => service.create('Unique Room')).toThrow(/already exists/);
    });

    it('writes to file after create', () => {
      service.create('MMH Jupiter');
      expect(mockFs.writeFileSync).toHaveBeenCalled();
    });

    it('includes the new room in findAll()', () => {
      service.create('MMH Jupiter');
      const names = service.findAll().map(r => r.name);
      expect(names).toContain('MMH Jupiter');
    });
  });

  // ── update ───────────────────────────────────────────────────────────────────

  describe('update()', () => {
    it('updates the room name', () => {
      const created = service.create('Old Name');
      const updated = service.update(created.id, { name: 'New Name' });
      expect(updated.name).toBe('New Name');
    });

    it('updates calendarEmail', () => {
      const created = service.create('Test Room');
      const updated = service.update(created.id, { calendarEmail: 'test@example.com' });
      expect(updated.calendarEmail).toBe('test@example.com');
    });

    it('updates order', () => {
      const created = service.create('Test Room');
      const updated = service.update(created.id, { order: 0 });
      expect(updated.order).toBe(0);
    });

    it('throws NotFoundException for unknown room id', () => {
      expect(() => service.update('nonexistent', { name: 'x' })).toThrow(/not found/);
    });
  });

  // ── remove ───────────────────────────────────────────────────────────────────

  describe('remove()', () => {
    it('removes the room', () => {
      const created = service.create('To Remove');
      service.remove(created.id);
      expect(service.findAll().find(r => r.id === created.id)).toBeUndefined();
    });

    it('re-numbers order after removal so order is contiguous', () => {
      service.create('R1');
      service.create('R2');
      const [first] = service.findAll();
      service.remove(first.id);
      service.findAll().forEach((r, i) => {
        expect(r.order).toBe(i);
      });
    });

    it('throws for unknown room id', () => {
      expect(() => service.remove('nonexistent')).toThrow(/not found/);
    });
  });

  // ── reset ────────────────────────────────────────────────────────────────────

  describe('reset()', () => {
    it('restores 6 default rooms after adding extra', () => {
      service.create('Extra Room');
      service.reset();
      expect(service.findAll()).toHaveLength(6);
    });

    it('first room after reset is MMH Séd', () => {
      service.create('Extra Room');
      service.reset();
      expect(service.findAll()[0].name).toBe('MMH Séd');
    });
  });

  // ── load from file ───────────────────────────────────────────────────────────

  describe('load() from existing file', () => {
    it('reads rooms from file when it exists', () => {
      const stored = [{ id: 'test', name: 'Test Room', calendarEmail: '', order: 0 }];
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(stored) as any);
      const svc = new RoomsService();
      svc.onModuleInit();
      expect(svc.findAll()).toHaveLength(1);
      expect(svc.findAll()[0].name).toBe('Test Room');
    });
  });
});
