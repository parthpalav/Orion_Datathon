import { describe, expect, it, beforeAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import type { Application } from 'express';

let app: Application;

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret';
  app = (await import('./app')).default;
});

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
});
