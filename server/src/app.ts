import express, { Application, NextFunction, Request, Response } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { requireAuth } from './middleware/auth';
import authRoutes from './routes/auth';
import mlRoutes from './routes/ml';
import chatRoutes from './routes/chat';
import newsRoutes from './routes/news';

// Initialize Express app
const app: Application = express();
const corsOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

// Render sits behind one proxy; needed so rate limits see the real client IP.
app.set('trust proxy', 1);

// Middleware
app.use(cors({
  origin: corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

const limiter = (limit: number) =>
  rateLimit({ windowMs: 15 * 60 * 1000, limit, standardHeaders: 'draft-7', legacyHeaders: false });

// Routes
app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'BigD API Server',
    status: 'running',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      ml: '/api/ml',
      chat: '/api/chat',
      news: '/api/news'
    }
  });
});

app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/auth', limiter(30), authRoutes);
app.use('/api/ml', mlRoutes);
app.use('/api/news', limiter(60), requireAuth, newsRoutes);
app.use('/api/chat', limiter(40), requireAuth, chatRoutes);

// Last-resort handler: log the real error, return a generic message.
app.use((err: Error & { status?: number; type?: string }, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  const status = err.status && err.status < 500 ? err.status : 500;
  res.status(status).json({ success: false, message: status === 500 ? 'Internal server error' : err.message });
});

export default app;
