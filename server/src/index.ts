import './config/env';
import connectDB from './config/db';
import app from './app';

// Refuse to boot without required secrets: a missing JWT_SECRET would make tokens forgeable.
const missingEnv = ['JWT_SECRET', 'MONGO_URI'].filter((key) => !process.env[key]);
if (missingEnv.length > 0) {
  console.error(`❌ Missing required environment variables: ${missingEnv.join(', ')}`);
  process.exit(1);
}

const PORT = process.env.PORT || 3000;

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
