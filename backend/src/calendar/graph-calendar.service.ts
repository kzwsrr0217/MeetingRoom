import { Injectable } from '@nestjs/common';
import { Client } from '@microsoft/microsoft-graph-client';
import { CalendarService } from './calendar.service';
import { RoomStatus } from './domain/room-status.model';

@Injectable()
export class GraphCalendarService extends CalendarService {
  private graphClient: Client;
  private currentToken: string;

  constructor() {
    super();
    this.currentToken = process.env.GRAPH_TEMP_TOKEN ?? '';
    this.initClient();
  }

  private initClient() {
    this.graphClient = Client.init({
      authProvider: (done) => done(null, this.currentToken),
    });
  }

  // Called by AppConfigController when admin pastes a new token
  override updateToken(token: string): void {
    this.currentToken = token;
    this.initClient();
    console.log('[GraphCalendarService] Token updated via admin UI');
  }

async getRoomStatus(roomId: string): Promise<any> {
    try {
      // 1. Kiszámoljuk a mai nap kezdetét és végét
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      // 2. Lekérjük a teljes mai napot az Outlookból (a calendarView garantálja az ismétlődő események kibontását is)
      const result = await this.graphClient
        .api(`/me/calendarview?startDateTime=${startOfDay.toISOString()}&endDateTime=${endOfDay.toISOString()}`)
        .header('Prefer', 'outlook.timezone="UTC"') // Biztosítjuk a helyes időzónát
        .get();

      const events = result.value || [];
      const now = new Date();

      // 3. Megkeressük, van-e ÉPP MOST futó esemény
      const currentEvent = events.find((e: any) => {
        const start = new Date(e.start.dateTime);
        const end = new Date(e.end.dateTime);
        return start <= now && end >= now;
      });

      const isOccupied = !!currentEvent;

      // 4. Formázzuk a teljes napi listát a Frontend Timeline-nak
      const dailySchedule = events.map((e: any) => ({
        start: e.start.dateTime,
        end: e.end.dateTime,
        title: e.subject || 'Foglalt',
        organizer: e.organizer?.emailAddress?.name || 'Rendszer'
      }));

      // 5. Megkeressük a következő esemény kezdetét
      const nextEvent = events
        .filter((e: any) => new Date(e.start.dateTime) > now)
        .sort((a: any, b: any) => new Date(a.start.dateTime).getTime() - new Date(b.start.dateTime).getTime())[0];

      // 6. Visszaküldjük a kiegészített adatcsomagot
      return {
        roomId,
        isOccupied,
        currentMeetingTitle: isOccupied ? currentEvent.subject : null,
        currentMeetingOrganizer: isOccupied ? currentEvent.organizer?.emailAddress?.name ?? 'Ismeretlen szervező' : null,
        currentMeetingEnd: isOccupied ? currentEvent.end.dateTime : null,
        nextMeetingStart: nextEvent ? nextEvent.start.dateTime : null,
        schedule: dailySchedule
      };
    } catch (error: any) {
      console.error('Graph API hiba a lekérdezésnél:', error.body || error);
      throw error;
    }
  }

  async bookRoom(roomId: string, durationMinutes: number, organizer: string, title?: string, startTime?: string): Promise<boolean> {
    console.log(`\n🔄 [GRAPH API] Kérés indítása az Outlook felé...`);

    const start = startTime ? new Date(startTime) : new Date();
    const end = new Date(start.getTime() + durationMinutes * 60000);
    const subject = title?.trim() ? title.trim() : `Kioszk foglalás: ${organizer}`;

    const event = {
      subject,
      start: { dateTime: start.toISOString(), timeZone: 'UTC' },
      end: { dateTime: end.toISOString(), timeZone: 'UTC' },
    };

    try {
      const response = await this.graphClient.api('/me/events').post(event);
      console.log(`✅ [GRAPH API SIKER] Az Outlook elfogadta! Esemény ID: ${response.id}\n`);
      return true;

    } catch (error: any) {
      console.error(`❌ [GRAPH API HIBA] A Microsoft elutasította a kérést!`);
      if (error.body) {
        console.error(JSON.stringify(error.body, null, 2));
      } else {
        console.error(error.message || error);
      }
      console.log(`\n`);
      return false;
    }
  }
}