import { Controller, Get, Post, Patch, Delete, Body, Param, BadRequestException, NotFoundException } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import type { Room } from './room.model';

@Controller('api/rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get()
  findAll(): Room[] {
    return this.roomsService.findAll();
  }

  @Post()
  create(@Body() body: { name: string; calendarEmail?: string }): Room {
    if (!body?.name?.trim()) {
      throw new BadRequestException('name is required');
    }
    try {
      return this.roomsService.create(body.name.trim(), body.calendarEmail?.trim() ?? '');
    } catch (e: any) {
      throw new BadRequestException(e.message);
    }
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() body: { name?: string; calendarEmail?: string; order?: number },
  ): Room {
    try {
      return this.roomsService.update(id, body);
    } catch (e: any) {
      throw new NotFoundException(e.message);
    }
  }

  @Delete(':id')
  remove(@Param('id') id: string): { success: true } {
    try {
      this.roomsService.remove(id);
      return { success: true };
    } catch (e: any) {
      throw new NotFoundException(e.message);
    }
  }

  @Post('reset')
  reset(): Room[] {
    return this.roomsService.reset();
  }
}
