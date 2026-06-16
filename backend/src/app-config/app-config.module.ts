import { Module } from '@nestjs/common';
import { AppConfigController } from './app-config.controller';
import { CalendarModule } from '../calendar/calendar.module';

@Module({
  imports: [CalendarModule],
  controllers: [AppConfigController],
})
export class AppConfigModule {}
