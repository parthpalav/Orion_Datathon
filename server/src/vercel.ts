import './config/env';
import { Request, Response } from 'express';
import connectDB from './config/db';
import app from './app';

// Serverless instances are reused between requests, so connect once and share the promise.
let db: Promise<void> | undefined;

export default async function handler(req: Request, res: Response) {
  db ??= connectDB().catch((error) => {
    db = undefined; // let the next request retry
    throw error;
  });
  try {
    await db;
  } catch {
    res.status(503).json({ success: false, message: 'Database unavailable' });
    return;
  }
  return app(req, res);
}
