import 'dotenv/config';
import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { customMongoSanitize } from './middlewares/mongoSanitize.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';
import { Server } from 'socket.io';
import mongoose from 'mongoose';

const app = express();
const server = http.createServer(app);

// Setup Socket.io
const io = new Server(server, {
  cors: {
    origin: '*', // Restrict this in production
    methods: ['GET', 'POST']
  }
});

// Middlewares
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(customMongoSanitize);
app.use(morgan('dev'));

import authRoutes from './routes/authRoutes.js';
import taskRoutes from './routes/taskRoutes.js';
import financeRoutes from './routes/financeRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import whatsappRoutes from './routes/whatsappRoutes.js';
import emailRoutes from './routes/emailRoutes.js';

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});
app.use('/api', limiter);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/email', emailRoutes);

// Basic route
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'API is running smoothly.' });
});

// Error Handling Middlewares
app.use(notFoundHandler);
app.use(errorHandler);

// Database Connection
const PORT = process.env.PORT || 3300;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-assistant';

import { connectToWhatsApp, initializeAllWhatsAppConnections } from './services/whatsappService.js';
import { initCronJobs } from './services/cronService.js';

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB Atlas');
    
    // Initialize background services
    initializeAllWhatsAppConnections();
    
    server.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ Failed to connect to MongoDB', err);
    process.exit(1);
  });

import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

// Socket.io connection handling
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    console.log('Socket missing token');
    return next(new Error('Authentication error'));
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    (socket as any).userId = decoded.id;
    next();
  } catch (err) {
    console.error('Socket JWT verify error:', err, 'Token:', token, 'Secret:', JWT_SECRET);
    next(new Error('Authentication error'));
  }
});

io.on('connection', (socket) => {
  const userId = (socket as any).userId.toString();
  console.log('⚡ A user connected', socket.id, 'User:', userId);
  socket.join(userId);

  // Initialize WhatsApp connection for this user
  connectToWhatsApp(userId).catch(err => {
    console.error('❌ Error initializing WhatsApp for user', userId, err);
  });

  socket.on('disconnect', () => {
    console.log('🔴 User disconnected', socket.id);
  });
});

// Initialize scheduled cron jobs
initCronJobs();

export { io };

// trigger restart
