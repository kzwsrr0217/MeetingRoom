import {
  Controller, Get, Post, Patch, Delete, Body, Param,
  BadRequestException, NotFoundException, UseGuards,
} from '@nestjs/common';
import { RoomsService } from './rooms.service';
import type { Room } from './room.model';
import { AdminKeyGuard } from '../common/admin-key.guard';

const MAX_NAME_LEN = 128;
// Loose sanity check — Exchange validates the real address; we just reject junk.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateName(name: unknown): string {
  if (typeof name !== 'string' || !name.trim()) throw new BadRequestException('name is required');
  const trimmed = name.trim();
  if (trimmed.length > MAX_NAME_LEN) throw new BadRequestException('name is too long');
  return trimmed;
}

function validateEmail(email: unknown): string {
  const trimmed = typeof email === 'string' ? email.trim() : '';
  if (trimmed && !EMAIL_RE.test(trimmed)) throw new BadRequestException('calendarEmail is not a valid email');
  return trimmed;
}

@Controller('api/rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get()
  findAll(): Room[] {
    return this.roomsService.findAll();
  }

  @UseGuards(AdminKeyGuard)
  @Post()
  create(@Body() body: { name: string; calendarEmail?: string }): Room {
    const name = validateName(body?.name);
    const calendarEmail = validateEmail(body?.calendarEmail);
    try {
      return this.roomsService.create(name, calendarEmail);
    } catch (e: any) {
      throw new BadRequestException(e.message);
    }
  }

  @UseGuards(AdminKeyGuard)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() body: { name?: string; calendarEmail?: string; order?: number },
  ): Room {
    const patch: { name?: string; calendarEmail?: string; order?: number } = {};
    if (body?.name !== undefined) patch.name = validateName(body.name);
    if (body?.calendarEmail !== undefined) patch.calendarEmail = validateEmail(body.calendarEmail);
    if (body?.order !== undefined) {
      if (!Number.isInteger(body.order) || body.order < 0) throw new BadRequestException('order must be a non-negative integer');
      patch.order = body.order;
    }
    try {
      return this.roomsService.update(id, patch);
    } catch (e: any) {
      throw new NotFoundException(e.message);
    }
  }

  @UseGuards(AdminKeyGuard)
  @Delete(':id')
  remove(@Param('id') id: string): { success: true } {
    try {
      this.roomsService.remove(id);
      return { success: true };
    } catch (e: any) {
      throw new NotFoundException(e.message);
    }
  }

  @UseGuards(AdminKeyGuard)
  @Post('reset')
  reset(): Room[] {
    return this.roomsService.reset();
  }
}
