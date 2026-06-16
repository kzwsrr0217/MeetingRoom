import { Injectable, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { Room } from './room.model';

const DATA_FILE = path.join(process.cwd(), 'data', 'rooms.json');

const DEFAULT_ROOMS: Room[] = [
  { id: 'mmh-sed',         name: 'MMH Séd',         calendarEmail: '', order: 0 },
  { id: 'mmh-balaton',     name: 'MMH Balaton',      calendarEmail: '', order: 1 },
  { id: 'mmh-mars',        name: 'MMH Mars',          calendarEmail: '', order: 2 },
  { id: 'mmh-tihany',      name: 'MMH Tihany',        calendarEmail: '', order: 3 },
  { id: 'mmh-bakony',      name: 'MMH Bakony',        calendarEmail: '', order: 4 },
  { id: 'mmh-kis-balaton', name: 'MMH Kis Balaton',   calendarEmail: '', order: 5 },
];

@Injectable()
export class RoomsService implements OnModuleInit {
  private rooms: Room[] = [];

  onModuleInit() {
    this.load();
  }

  private load() {
    try {
      if (fs.existsSync(DATA_FILE)) {
        this.rooms = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
      } else {
        this.rooms = [...DEFAULT_ROOMS];
        this.save();
      }
    } catch {
      this.rooms = [...DEFAULT_ROOMS];
    }
  }

  private save() {
    try {
      fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
      fs.writeFileSync(DATA_FILE, JSON.stringify(this.rooms, null, 2), 'utf-8');
    } catch (e) {
      console.error('[RoomsService] Failed to save rooms.json:', e);
    }
  }

  private slugify(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
  }

  findAll(): Room[] {
    return [...this.rooms].sort((a, b) => a.order - b.order);
  }

  create(name: string, calendarEmail = ''): Room {
    const id = this.slugify(name);
    if (this.rooms.find(r => r.id === id)) {
      throw new Error(`Room with id "${id}" already exists`);
    }
    const order = this.rooms.length;
    const room: Room = { id, name, calendarEmail, order };
    this.rooms.push(room);
    this.save();
    return room;
  }

  update(id: string, patch: Partial<Pick<Room, 'name' | 'calendarEmail' | 'order'>>): Room {
    const room = this.rooms.find(r => r.id === id);
    if (!room) throw new Error(`Room "${id}" not found`);
    if (patch.name !== undefined) room.name = patch.name;
    if (patch.calendarEmail !== undefined) room.calendarEmail = patch.calendarEmail;
    if (patch.order !== undefined) room.order = patch.order;
    this.save();
    return room;
  }

  remove(id: string): void {
    const idx = this.rooms.findIndex(r => r.id === id);
    if (idx === -1) throw new Error(`Room "${id}" not found`);
    this.rooms.splice(idx, 1);
    // Re-number order
    this.rooms.forEach((r, i) => (r.order = i));
    this.save();
  }

  reset(): Room[] {
    this.rooms = [...DEFAULT_ROOMS];
    this.save();
    return this.findAll();
  }
}
