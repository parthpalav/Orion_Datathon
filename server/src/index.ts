import './config/env';
import express, { Application, NextFunction, Request, Response } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { requireAuth } from './middleware/auth';
import connectDB from './config/db';
import authRoutes from './routes/auth';
import mlRoutes from './routes/ml';
import chatRoutes from './routes/chat';
import newsRoutes from './routes/news';

// Refuse to boot without required secrets: a missing JWT_SECRET would make tokens forgeable.
const missingEnv = ['JWT_SECRET', 'MONGO_URI'].filter((key) => !process.env[key]);
if (missingEnv.length > 0) {
  console.error(`❌ Missing required environment variables: ${missingEnv.join(', ')}`);
  process.exit(1);
}

// Initialize Express app
const app: Application = express();
const PORT = process.env.PORT || 3000;
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

// Start server
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();
  } catch (error) {
    // Without the DB every auth request hangs, so exit and let the host restart us.
    console.error('❌ MongoDB connection failed, exiting:', (error as Error).message);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🌐 API: http://localhost:${PORT}`);
  });
};

startServer();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});
