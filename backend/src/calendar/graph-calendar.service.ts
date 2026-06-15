import { Injectable } from '@nestjs/common';
import { Client } from '@microsoft/microsoft-graph-client';
import { CalendarService } from './calendar.service';
import { RoomStatus } from './domain/room-status.model';

@Injectable()
export class GraphCalendarService implements CalendarService {
  private graphClient: Client;

  constructor() {
    // POC: Replace with a fresh 1-hour token from https://developer.microsoft.com/en-us/graph/graph-explorer
    // Sign in → click your avatar → "Access token" → copy here → restart backend
    // See docs/ADMIN_GUIDE.md for full instructions.
    const TEMP_TOKEN = process.env.GRAPH_TEMP_TOKEN ?? '';


    this.graphClient = Client.init({
      authProvider: (done) => {
        done(null, TEMP_TOKEN);
      },
    });
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

  // ÚJ: A startTime opcionális paraméter bekerült!
  async bookRoom(roomId: string, durationMinutes: number, organizer: string, startTime?: string): Promise<boolean> {
    console.log(`\n🔄 [GRAPH API] Kérés indítása az Outlook felé...`);
    
    // Ha van startTime, azt használjuk, különben a mostani pillanatot
    const start = startTime ? new Date(startTime) : new Date();
    const end = new Date(start.getTime() + durationMinutes * 60000);

    const event = {
      subject: `Kioszk foglalás: ${organizer}`,
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