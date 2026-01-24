import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Initialize dotenv for environment variables
dotenv.config();

// Get current directory (for ES modules)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import routes
import paymentRoutes from './routes/payment.js';
import webhookRoutes from './routes/webhooks.js';

// Initialize Express
const app = express();
const PORT = process.env.PORT || 5000;

// ==================== MIDDLEWARE ====================

// CORS Configuration - Allow only frontend domain in production
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ==================== ROUTES ====================

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Payment Gateway Backend is running',
    timestamp: new Date().toISOString(),
  });
});

// Payment routes
app.use('/api/payment', paymentRoutes);

// Webhook routes
app.use('/api/webhook', webhookRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Endpoint ${req.method} ${req.path} does not exist`,
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// ==================== START SERVER ====================

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════╗
║   Payment Gateway Backend Server Running       ║
║   Port: ${PORT}                                    ║
║   Environment: ${process.env.NODE_ENV || 'development'} ║
║   Frontend URL: ${process.env.FRONTEND_URL || 'Not configured'} ║
╚════════════════════════════════════════════════╝
  `);
});

export default app;
