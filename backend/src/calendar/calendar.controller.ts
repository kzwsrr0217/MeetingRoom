import {
  Controller, Get, Post, Param, Body, Logger, UseGuards,
  BadRequestException, HttpException, HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CalendarService } from './calendar.service';
import { RoomStatus } from './domain/room-status.model';
import { RateLimitGuard } from '../common/rate-limit.guard';

const MAX_DURATION_MINUTES = 24 * 60; // a single kiosk booking can't exceed one day
const MAX_TEXT_LEN = 256;

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
    const azureConfigured =
      !!process.env.AZURE_TENANT_ID && !!process.env.AZURE_CLIENT_ID && !!process.env.AZURE_CLIENT_SECRET;
    const auth = useMock
      ? 'none'
      : azureConfigured
        ? 'msal'
        : process.env.GRAPH_TEMP_TOKEN
          ? 'temp-token'
          : 'unconfigured';
    return {
      status: 'ok',
      mode: useMock ? 'mock' : 'graph',
      auth,
      // Readiness signal: in live mode, whether the app is credential-ready and the
      // last Graph call outcome (no extra API call is made here).
      ready: useMock || auth !== 'unconfigured',
      ...(useMock ? {} : { graph: this.calendarService.getDiagnostics() }),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('calendar/room/:roomId/status')
  async getStatus(@Param('roomId') roomId: string): Promise<RoomStatus> {
    try {
      return await this.calendarService.getRoomStatus(roomId);
    } catch (err: any) {
      throw this.mapGraphError(err, 'A szobastátusz lekérése sikertelen.');
    }
  }

  @UseGuards(RateLimitGuard)
  @Post('calendar/room/:roomId/book')
  async bookRoom(
    @Param('roomId') roomId: string,
    @Body() bookingData: { durationMinutes: number; organizer: string; title?: string; startTime?: string },
  ) {
    this.logger.log(`Beérkező adatok: ${JSON.stringify(bookingData)}`);

    const durationMinutes = Number(bookingData?.durationMinutes);
    if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) {
      throw new BadRequestException('Érvénytelen foglalási időtartam (durationMinutes)!');
    }
    if (durationMinutes > MAX_DURATION_MINUTES) {
      throw new BadRequestException(`A foglalás nem lehet hosszabb, mint ${MAX_DURATION_MINUTES} perc.`);
    }
    if (bookingData.title && bookingData.title.length > MAX_TEXT_LEN) {
      throw new BadRequestException('A tárgy túl hosszú.');
    }
    if (bookingData.organizer && bookingData.organizer.length > MAX_TEXT_LEN) {
      throw new BadRequestException('A szervező neve túl hosszú.');
    }
    if (bookingData.startTime && Number.isNaN(Date.parse(bookingData.startTime))) {
      throw new BadRequestException('Érvénytelen kezdési időpont (startTime)!');
    }

    try {
      const ok = await this.calendarService.bookRoom(
        roomId,
        durationMinutes,
        bookingData.organizer?.trim() || 'Névtelen foglaló',
        bookingData.title,
        bookingData.startTime,
      );
      return { success: ok };
    } catch (err: any) {
      // ConflictException (409) and other HttpExceptions propagate as-is
      if (err instanceof HttpException) throw err;
      throw this.mapGraphError(err, 'A foglalás nem sikerült.');
    }
  }

  // ── Meeting lifecycle (on-panel actions, like booking — not admin-guarded) ──

  @UseGuards(RateLimitGuard)
  @Post('calendar/room/:roomId/checkin')
  async checkIn(@Param('roomId') roomId: string) {
    try {
      const ok = await this.calendarService.checkIn(roomId);
      if (!ok) throw new HttpException('Nincs jelenleg futó megbeszélés.', HttpStatus.CONFLICT);
      this.logger.log(`Check-in megerősítve: ${roomId}`);
      return { success: true };
    } catch (err: any) {
      if (err instanceof HttpException) throw err;
      throw this.mapGraphError(err, 'A check-in sikertelen.');
    }
  }

  @UseGuards(RateLimitGuard)
  @Post('calendar/room/:roomId/release')
  async release(@Param('roomId') roomId: string) {
    try {
      const ok = await this.calendarService.releaseNow(roomId);
      if (!ok) throw new HttpException('Nincs felszabadítható megbeszélés.', HttpStatus.CONFLICT);
      this.logger.log(`Terem felszabadítva: ${roomId}`);
      return { success: true };
    } catch (err: any) {
      if (err instanceof HttpException) throw err;
      throw this.mapGraphError(err, 'A felszabadítás sikertelen.');
    }
  }

  @UseGuards(RateLimitGuard)
  @Post('calendar/room/:roomId/extend')
  async extend(@Param('roomId') roomId: string, @Body() body: { minutes: number }) {
    const minutes = Number(body?.minutes);
    if (!Number.isInteger(minutes) || minutes <= 0 || minutes > 120) {
      throw new BadRequestException('Érvénytelen hosszabbítás (minutes: 1–120).');
    }
    try {
      const ok = await this.calendarService.extendMeeting(roomId, minutes);
      if (!ok) throw new HttpException('Nincs hosszabbítható megbeszélés.', HttpStatus.CONFLICT);
      this.logger.log(`Megbeszélés meghosszabbítva: ${roomId} +${minutes} perc`);
      return { success: true };
    } catch (err: any) {
      if (err instanceof HttpException) throw err;
      throw this.mapGraphError(err, 'A hosszabbítás sikertelen.');
    }
  }

  /** Microsoft Graph returns 401/403 when the token is expired or lacks permission. */
  private mapGraphError(err: any, fallbackMessage: string): HttpException {
    const code = err?.statusCode ?? err?.code ?? err?.status;
    if (code === 401 || code === 403) {
      return new HttpException(
        'A Graph API token lejárt vagy érvénytelen. Frissítse az /admin oldalon.',
        HttpStatus.UNAUTHORIZED,
      );
    }
    return new HttpException(fallbackMessage, HttpStatus.SERVICE_UNAVAILABLE);
  }
}
