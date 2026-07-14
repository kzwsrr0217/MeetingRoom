import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('API routes (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    process.env.USE_MOCK_DATA = 'true';
    delete process.env.GRAPH_TEMP_TOKEN;
    delete process.env.ADMIN_API_KEY; // keep admin endpoints open for these tests

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  // ── Health ────────────────────────────────────────────────────────────────────

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

  // ── Calendar ──────────────────────────────────────────────────────────────────

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

  it('POST /api/calendar/room/:roomId/book returns { success: true }', () => {
    return request(app.getHttpServer())
      .post('/api/calendar/room/MMH%20S%C3%A9d/book')
      .send({ durationMinutes: 30, organizer: 'Teszt Felhasználó' })
      .expect(201)
      .expect(res => {
        expect(res.body).toEqual({ success: true });
      });
  });

  it('POST /api/calendar/room/:roomId/book returns 409 on an overlapping booking', async () => {
    await request(app.getHttpServer())
      .post('/api/calendar/room/MMH%20Tihany/book')
      .send({ durationMinutes: 60, organizer: 'Első' })
      .expect(201);

    return request(app.getHttpServer())
      .post('/api/calendar/room/MMH%20Tihany/book')
      .send({ durationMinutes: 60, organizer: 'Második' })
      .expect(409);
  });

  it('POST /api/calendar/room/:roomId/book stores title and reflects it in status', async () => {
    await request(app.getHttpServer())
      .post('/api/calendar/room/MMH%20Tihany/book')
      .send({ durationMinutes: 30, organizer: 'Kovács Péter', title: 'Design review' })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get('/api/calendar/room/MMH%20Tihany/status')
      .expect(200);

    expect(res.body.isOccupied).toBe(true);
    expect(res.body.currentMeetingTitle).toBe('Design review');
    expect(res.body.currentMeetingOrganizer).toBe('Kovács Péter');
  });

  it('POST /api/calendar/room/:roomId/book with future startTime creates advance booking', async () => {
    const startTime = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour from now

    await request(app.getHttpServer())
      .post('/api/calendar/room/MMH%20Bakony/book')
      .send({ durationMinutes: 30, organizer: 'Nagy Anna', title: 'Sprint planning', startTime })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get('/api/calendar/room/MMH%20Bakony/status')
      .expect(200);

    // Room should be free now but have the future booking in schedule
    expect(res.body.isOccupied).toBe(false);
    const futureBooking = res.body.schedule.find((e: { title: string }) => e.title === 'Sprint planning');
    expect(futureBooking).toBeDefined();
    expect(futureBooking.organizer).toBe('Nagy Anna');
  });

  it('POST /api/calendar/room/:roomId/book returns 400 when durationMinutes missing', () => {
    return request(app.getHttpServer())
      .post('/api/calendar/room/MMH%20S%C3%A9d/book')
      .send({ organizer: 'Teszt' })
      .expect(400);
  });

  it('POST /checkin succeeds for a running kiosk booking', async () => {
    await request(app.getHttpServer())
      .post('/api/calendar/room/MMH%20Tihany/book')
      .send({ durationMinutes: 30, organizer: 'Teszt' })
      .expect(201);

    return request(app.getHttpServer())
      .post('/api/calendar/room/MMH%20Tihany/checkin')
      .expect(201)
      .expect({ success: true });
  });

  it('POST /checkin returns 409 when no meeting is running', () => {
    return request(app.getHttpServer())
      .post('/api/calendar/room/MMH%20Tihany/checkin')
      .expect(409);
  });

  it('POST /release frees a running kiosk booking', async () => {
    await request(app.getHttpServer())
      .post('/api/calendar/room/MMH%20Tihany/book')
      .send({ durationMinutes: 30, organizer: 'Teszt' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/calendar/room/MMH%20Tihany/release')
      .expect(201)
      .expect({ success: true });

    const res = await request(app.getHttpServer())
      .get('/api/calendar/room/MMH%20Tihany/status')
      .expect(200);
    expect(res.body.isOccupied).toBe(false);
  });

  it('POST /extend lengthens a running kiosk booking', async () => {
    await request(app.getHttpServer())
      .post('/api/calendar/room/MMH%20Tihany/book')
      .send({ durationMinutes: 30, organizer: 'Teszt' })
      .expect(201);

    const before = await request(app.getHttpServer()).get('/api/calendar/room/MMH%20Tihany/status');
    const endBefore = new Date(before.body.currentMeetingEnd).getTime();

    await request(app.getHttpServer())
      .post('/api/calendar/room/MMH%20Tihany/extend')
      .send({ minutes: 15 })
      .expect(201)
      .expect({ success: true });

    const after = await request(app.getHttpServer()).get('/api/calendar/room/MMH%20Tihany/status');
    const endAfter = new Date(after.body.currentMeetingEnd).getTime();
    expect(endAfter - endBefore).toBe(15 * 60000);
  });

  it('POST /book with isPrivate masks the meeting in status', async () => {
    await request(app.getHttpServer())
      .post('/api/calendar/room/MMH%20Bakony/book')
      .send({ durationMinutes: 30, organizer: 'Titkos', title: 'Bizalmas', isPrivate: true })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get('/api/calendar/room/MMH%20Bakony/status')
      .expect(200);

    expect(res.body.currentMeetingPrivate).toBe(true);
    expect(res.body.currentMeetingTitle).toBe('Privát megbeszélés');
    expect(res.body.currentMeetingOrganizer).toBeNull();
  });

  it('POST /extend rejects an invalid duration', () => {
    return request(app.getHttpServer())
      .post('/api/calendar/room/MMH%20Tihany/extend')
      .send({ minutes: 0 })
      .expect(400);
  });

  // ── Rooms CRUD ────────────────────────────────────────────────────────────────

  describe('Rooms API', () => {
    beforeEach(() =>
      // Ensure clean default state before each rooms test
      request(app.getHttpServer()).post('/api/rooms/reset'),
    );

    it('GET /api/rooms returns 6 default rooms', () => {
      return request(app.getHttpServer())
        .get('/api/rooms')
        .expect(200)
        .expect(res => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body).toHaveLength(6);
          expect(res.body[0].name).toBe('MMH Séd');
          expect(res.body[0]).toHaveProperty('id');
          expect(res.body[0]).toHaveProperty('calendarEmail');
          expect(res.body[0]).toHaveProperty('order');
        });
    });

    it('POST /api/rooms creates a new room', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/rooms')
        .send({ name: 'MMH Jupiter', calendarEmail: 'jupiter@test.hu' })
        .expect(201);

      expect(res.body.id).toBe('mmh-jupiter');
      expect(res.body.name).toBe('MMH Jupiter');
      expect(res.body.calendarEmail).toBe('jupiter@test.hu');
      expect(res.body.order).toBe(6);
    });

    it('POST /api/rooms returns 400 when name is missing', () => {
      return request(app.getHttpServer())
        .post('/api/rooms')
        .send({ calendarEmail: 'test@test.hu' })
        .expect(400);
    });

    it('POST /api/rooms returns 400 on duplicate room name', async () => {
      await request(app.getHttpServer())
        .post('/api/rooms')
        .send({ name: 'MMH Duplicate' });

      return request(app.getHttpServer())
        .post('/api/rooms')
        .send({ name: 'MMH Duplicate' })
        .expect(400);
    });

    it('PATCH /api/rooms/:id updates the room name', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/api/rooms')
        .send({ name: 'MMH Original' });

      const id = createRes.body.id;

      const patchRes = await request(app.getHttpServer())
        .patch(`/api/rooms/${id}`)
        .send({ name: 'MMH Updated' })
        .expect(200);

      expect(patchRes.body.name).toBe('MMH Updated');
    });

    it('PATCH /api/rooms/:id returns 404 for unknown id', () => {
      return request(app.getHttpServer())
        .patch('/api/rooms/nonexistent-id')
        .send({ name: 'x' })
        .expect(404);
    });

    it('DELETE /api/rooms/:id removes the room', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/api/rooms')
        .send({ name: 'MMH ToDelete' });

      const id = createRes.body.id;

      await request(app.getHttpServer())
        .delete(`/api/rooms/${id}`)
        .expect(200)
        .expect({ success: true });

      const listRes = await request(app.getHttpServer()).get('/api/rooms');
      expect(listRes.body.find((r: any) => r.id === id)).toBeUndefined();
    });

    it('DELETE /api/rooms/:id returns 404 for unknown id', () => {
      return request(app.getHttpServer())
        .delete('/api/rooms/nonexistent-id')
        .expect(404);
    });

    it('POST /api/rooms/reset restores 6 default rooms', async () => {
      await request(app.getHttpServer())
        .post('/api/rooms')
        .send({ name: 'MMH Extra' });

      const res = await request(app.getHttpServer())
        .post('/api/rooms/reset')
        .expect(201);

      expect(res.body).toHaveLength(6);
      expect(res.body[0].name).toBe('MMH Séd');
    });
  });

  // ── Config: Graph token ───────────────────────────────────────────────────────

  describe('Config: Graph token', () => {
    it('GET /api/config/graph-token/status returns hasToken false when env not set', () => {
      return request(app.getHttpServer())
        .get('/api/config/graph-token/status')
        .expect(200)
        .expect(res => {
          expect(res.body.hasToken).toBe(false);
          expect(res.body.expiresAt).toBeNull();
        });
    });

    it('PUT /api/config/graph-token returns 400 when token is empty', () => {
      return request(app.getHttpServer())
        .put('/api/config/graph-token')
        .send({ token: '' })
        .expect(400);
    });
  });

  // ── Config: Preset names ──────────────────────────────────────────────────────

  describe('Config: Preset names', () => {
    it('GET /api/config/preset-names returns an array of strings', () => {
      return request(app.getHttpServer())
        .get('/api/config/preset-names')
        .expect(200)
        .expect(res => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBeGreaterThan(0);
          expect(typeof res.body[0]).toBe('string');
        });
    });

    it('PUT /api/config/preset-names saves and returns the name list', async () => {
      const names = ['E2E Felhasználó', 'Másik Teszt'];

      const res = await request(app.getHttpServer())
        .put('/api/config/preset-names')
        .send({ names })
        .expect(200);

      expect(res.body).toEqual(names);
    });

    it('PUT /api/config/preset-names returns 400 when names is not an array', () => {
      return request(app.getHttpServer())
        .put('/api/config/preset-names')
        .send({ names: 'not-an-array' })
        .expect(400);
    });

    it('PUT /api/config/preset-names filters out empty strings', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/config/preset-names')
        .send({ names: ['Alice', '', '  ', 'Bob'] })
        .expect(200);

      expect(res.body).toEqual(['Alice', 'Bob']);
    });
  });
});
