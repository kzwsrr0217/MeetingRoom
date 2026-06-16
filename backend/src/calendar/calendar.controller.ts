import { Controller, Get, Post, Param, Body, Logger, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
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
    try {
      return await this.calendarService.getRoomStatus(roomId);
    } catch (err: any) {
      // Microsoft Graph returns 401 when the delegated token is expired or invalid
      const code = err?.statusCode ?? err?.code ?? err?.status;
      if (code === 401 || code === 403) {
        throw new HttpException(
          'A Graph API token lejárt vagy érvénytelen. Frissítse az /admin oldalon.',
          HttpStatus.UNAUTHORIZED,
        );
      }
      throw new HttpException('A szobastátusz lekérése sikertelen.', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  @Post('calendar/room/:roomId/book')
  async bookRoom(
    @Param('roomId') roomId: string,
    @Body() bookingData: { durationMinutes: number; organizer: string; title?: string; startTime?: string }
  ) {
    this.logger.log(`Beérkező adatok: ${JSON.stringify(bookingData)}`);

    if (!bookingData || !bookingData.durationMinutes) {
      throw new BadRequestException('Hiányzó foglalási adatok (durationMinutes)!');
    }

    return this.calendarService.bookRoom(
      roomId,
      bookingData.durationMinutes,
      bookingData.organizer || 'Névtelen foglaló',
      bookingData.title,
      bookingData.startTime,
    );
  }

  @Post('calendar/room/:roomId/checkin')
  async checkIn(@Param('roomId') roomId: string) {
    this.logger.log(`[PoC] Check-in megerősítve a(z) ${roomId} teremben!`);
    return { success: true };
  }
}