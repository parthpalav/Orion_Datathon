import { describe, expect, it, beforeAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import type { Application } from 'express';
import User from './models/User';
import type { IUser } from './models/User';

let app: Application;

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret';
  app = (await import('./app')).default;
});

afterEach(() => vi.restoreAllMocks());

describe('app', () => {
  it('reports health without auth', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('rejects chat without a token', async () => {
    const res = await request(app).post('/api/chat').send({ message: 'hi' });
    expect(res.status).toBe(401);
  });

  it('rejects news with a token signed by the wrong secret', async () => {
    const token = jwt.sign({ userId: 'u1' }, 'wrong-secret');
    const res = await request(app).get('/api/news').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it('returns 400, not 500, for malformed JSON', async () => {
    const res = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{bad');
    expect(res.status).toBe(400);
  });

  it.each([
    ['+44 7700 900123', '+447700900123'],
    ['098765 43210', '+919876543210'],
    [undefined, undefined],
  ])('saves the normalized signup phone number for %s', async (phoneNumber, expected) => {
    vi.spyOn(User, 'findOne').mockResolvedValue(null);
    const save = vi.spyOn(User.prototype, 'save').mockImplementation(async function (this: IUser) {
      return this;
    });

    const res = await request(app).post('/api/auth/register').send({
      fullName: 'Test User', email: 'test@example.com', password: 'test-password', phoneNumber,
    });

    expect(res.status).toBe(201);
    expect(save).toHaveBeenCalledOnce();
    expect(save.mock.contexts[0]).toHaveProperty('phoneNumber', expected);
  });

  it('rejects an impossible phone number during signup', async () => {
    const res = await request(app).post('/api/auth/register').send({
      fullName: 'Test User', email: 'test@example.com', password: 'test-password', phoneNumber: '+44 12',
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Please enter a valid mobile number');
  });
  it('rejects a route plan without a token', async () => {
    const res = await request(app).post('/api/routes/plan').send({});
    expect(res.status).toBe(401);
  });

  it('validates route plan coordinates before calling Mapbox', async () => {
    const token = jwt.sign({ userId: 'u1' }, 'test-secret');
    const res = await request(app).post('/api/routes/plan').set('Authorization', `Bearer ${token}`).send({ origin: 'Andheri' });
    expect(res.status).toBe(400);
  });

  it.each([
    { startOffset: 120, endOffset: 60, message: 'Choose an end time after the start time' },
    { startOffset: 60, endOffset: 1501, message: 'Choose a window of up to 24 hours' },
    { startOffset: -60, endOffset: 2, message: 'Choose a window that ends at least 5 minutes from now' },
  ])('rejects invalid departure windows before calling Mapbox', async ({ startOffset, endOffset, message }) => {
    const now = Date.now();
    const token = jwt.sign({ userId: 'u1' }, 'test-secret');
    const res = await request(app).post('/api/routes/plan').set('Authorization', `Bearer ${token}`).send({
      origin: [72.84, 19.11],
      destination: [72.86, 19.07],
      departureWindow: {
        start: new Date(now + startOffset * 60_000).toISOString(),
        end: new Date(now + endOffset * 60_000).toISOString(),
      },
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe(message);
  });
});
