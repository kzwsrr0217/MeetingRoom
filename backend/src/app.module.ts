import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CalendarModule } from './calendar/calendar.module';
import { RoomsModule } from './rooms/rooms.module';
import { AppConfigModule } from './app-config/app-config.module';
import { IssuesModule } from './issues/issues.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    CalendarModule,
    RoomsModule,
    AppConfigModule,
    IssuesModule,
  ],
})
export class AppModule {}
