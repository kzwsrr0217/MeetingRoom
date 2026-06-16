import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';
import { MockCalendarService } from './mock-calendar.service';
import { GraphCalendarService } from './graph-calendar.service';

@Module({
  imports: [ConfigModule],
  controllers: [CalendarController],
  providers: [
    {
      // CalendarService must be an abstract class, not an interface —
      // TypeScript erases interfaces at runtime so they can't be used as injection tokens.
      provide: CalendarService,
      useFactory: (configService: ConfigService) => {
        const rawValue = configService.get<string>('USE_MOCK_DATA');

        console.log(`\n🔍 [DEBUG] USE_MOCK_DATA from .env: "${rawValue}"`);

        // Any value other than the exact string 'false' keeps mock mode active
        const useMock = rawValue?.trim() !== 'false';

        if (useMock) {
          console.log('👷 WARNING: MockCalendarService loaded (mock mode)\n');
          return new MockCalendarService();
        } else {
          console.log('🚀 WARNING: GraphCalendarService loaded (live mode)\n');
          return new GraphCalendarService();
        }
      },
      inject: [ConfigService],
    },
  ],
  exports: [CalendarService],
})
export class CalendarModule {}
