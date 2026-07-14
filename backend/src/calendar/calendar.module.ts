import { Module, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';
import { MockCalendarService } from './mock-calendar.service';
import { GraphCalendarService } from './graph-calendar.service';
import { RoomsModule } from '../rooms/rooms.module';
import { RoomsService } from '../rooms/rooms.service';

@Module({
  imports: [ConfigModule, RoomsModule],
  controllers: [CalendarController],
  providers: [
    {
      // CalendarService must be an abstract class, not an interface —
      // TypeScript erases interfaces at runtime so they can't be used as injection tokens.
      provide: CalendarService,
      useFactory: (configService: ConfigService, roomsService: RoomsService) => {
        const logger = new Logger('CalendarModule');
        const rawValue = configService.get<string>('USE_MOCK_DATA');

        // Any value other than the exact string 'false' keeps mock mode active
        const useMock = rawValue?.trim() !== 'false';

        if (useMock) {
          logger.warn(`MockCalendarService loaded (USE_MOCK_DATA="${rawValue}")`);
          return new MockCalendarService();
        }
        logger.log('GraphCalendarService loaded (live mode)');
        return new GraphCalendarService(roomsService);
      },
      inject: [ConfigService, RoomsService],
    },
  ],
  exports: [CalendarService],
})
export class CalendarModule {}
