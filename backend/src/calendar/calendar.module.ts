// backend/src/calendar/calendar.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';
import { MockCalendarService } from './mock-calendar.service';
import { GraphCalendarService } from './graph-calendar.service';

@Module({
  imports: [ConfigModule], // Biztosítjuk, hogy a ConfigService elérhető legyen
  controllers: [CalendarController],
  providers: [
    {
      // FONTOS: Ahhoz, hogy ez működjön, a CalendarService-nek egy "abstract class"-nak 
      // kell lennie, nem pedig "interface"-nek (a TypeScript az interface-eket törli futásidőben).
      provide: CalendarService,
      
      // A Factory futásidőben dönti el, melyiket inicializálja
useFactory: (configService: ConfigService) => {
        // Kiolvassuk a nyers értéket
        const rawValue = configService.get<string>('USE_MOCK_DATA');
        
        // EZ A RÖNTGEN: Kiírjuk a terminálba induláskor!
        console.log(`\n🔍 [DEBUG] A .env-ből olvasott érték: "${rawValue}"`);
        
        // Ha nem kifejezetten 'false' (szóközök nélkül), akkor Mock módban marad
        const useMock = rawValue?.trim() !== 'false';
        
        if (useMock) {
          console.log('👷‍♂️ FIGYELEM: MockCalendarService betöltve (Teszt mód)\n');
          return new MockCalendarService();
        } else {
          console.log('🚀 FIGYELEM: GraphCalendarService betöltve (Éles mód)\n');
          return new GraphCalendarService();
        }
      },
      // Itt már csak a ConfigService-t kell injektálni a Factory-ba
      inject: [ConfigService], 
    },
  ],
})
export class CalendarModule {}