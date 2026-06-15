import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('API routes (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    process.env.USE_MOCK_DATA = 'true';
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /api/health returns ok in mock mode', () => {
    return request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect(res => {
        expect(res.body.status).toBe('ok');
        expect(res.body.mode).toBe('mock');
        expect(res.body.timestamp).toBeDefined();
      });
  });

  it('GET /api/calendar/room/:roomId/status returns room status', () => {
    return request(app.getHttpServer())
      .get('/api/calendar/room/MMH%20Balaton/status')
      .expect(200)
      .expect(res => {
        expect(res.body.roomId).toBe('MMH Balaton');
        expect(res.body.isOccupied).toBe(true);
        expect(res.body).toHaveProperty('currentMeetingTitle');
        expect(res.body).toHaveProperty('currentMeetingEnd');
        expect(res.body).toHaveProperty('schedule');
      });
  });

  it('POST /api/calendar/room/:roomId/book returns true', () => {
    return request(app.getHttpServer())
      .post('/api/calendar/room/MMH%20S%C3%A9d/book')
      .send({ durationMinutes: 30, organizer: 'Teszt Felhasználó' })
      .expect(201)
      .expect(res => {
        // NestJS serializes boolean primitives as plain text "true"
        expect(res.text).toBe('true');
      });
  });

  it('POST /api/calendar/room/:roomId/book returns 400 when durationMinutes missing', () => {
    return request(app.getHttpServer())
      .post('/api/calendar/room/MMH%20S%C3%A9d/book')
      .send({ organizer: 'Teszt' })
      .expect(400);
  });

  it('POST /api/calendar/room/:roomId/checkin returns success', () => {
    return request(app.getHttpServer())
      .post('/api/calendar/room/MMH%20S%C3%A9d/checkin')
      .expect(201)
      .expect({ success: true });
  });
});
