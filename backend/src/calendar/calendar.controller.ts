import { Controller, Get, Post, Param, Body, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CalendarService } from './calendar.service';
import { RoomStatus } from './domain/room-status.model';

@Controller('api')
export class CalendarController {
  private readonly logger = new Logger(CalendarController.name);

  constructor(
    private readonly calendarService: CalendarService,
    private readonly configService: ConfigService,
  ) {}

  @Get('health')
  health() {
    const useMock = this.configService.get<string>('USE_MOCK_DATA')?.trim() !== 'false';
    return {
      status: 'ok',
      mode: useMock ? 'mock' : 'graph',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('calendar/room/:roomId/status')
  async getStatus(@Param('roomId') roomId: string): Promise<RoomStatus> {
    return this.calendarService.getRoomStatus(roomId);
  }

  @Post('calendar/room/:roomId/book')
  async bookRoom(
    @Param('roomId') roomId: string,
    // ÚJ: startTime hozzáadva a Body-hoz
    @Body() bookingData: { durationMinutes: number; organizer: string; startTime?: string }
  ) {
    this.logger.log(`Beérkező adatok: ${JSON.stringify(bookingData)}`);

    if (!bookingData || !bookingData.durationMinutes) {
      throw new BadRequestException('Hiányzó foglalási adatok (durationMinutes)!');
    }

    return this.calendarService.bookRoom(
      roomId, 
      bookingData.durationMinutes, 
      bookingData.organizer || 'Névtelen foglaló',
      bookingData.startTime // Átadjuk a Service-nek
    );
  }

  @Post('calendar/room/:roomId/checkin')
  async checkIn(@Param('roomId') roomId: string) {
    this.logger.log(`[PoC] Check-in megerősítve a(z) ${roomId} teremben!`);
    return { success: true };
  }
}