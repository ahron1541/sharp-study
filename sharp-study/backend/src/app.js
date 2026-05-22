require('dotenv').config(); // <-- THIS MUST BE LINE 1
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

// Currently active features
const authRoutes = require('./features/auth/auth.routes');
const aiRoutes = require('./features/ai/ai.routes');
const adminRoutes = require('./features/admin/admin.routes');
const dashboardRoutes = require('./features/dashboard/dashboard.routes');
const flashcardRoutes = require('./features/flashcards/flashcards.routes');
const gamificationRoutes = require('./features/gamification/gamification.routes');
const studyGuideRoutes = require('./features/study-guides/studyGuide.routes');
const quizRoutes = require('./features/quizzes/quizzes.routes');
const streakRoutes = require('./features/streaks/streaks.routes');

// --- Temporarily commented out until we build these folders! ---
// const documentRoutes = require('./features/documents/documents.routes');

const app = express();
app.set('trust proxy', 1);

const allowedOrigins = new Set([
  'http://localhost:5173',
  'http://localhost:5174',
  'https://sharp-study.vercel.app',
  process.env.FRONTEND_URL,
  process.env.APP_URL,
].filter(Boolean));

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204,
};

// Middleware
app.disable('x-powered-by');
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));
app.use(express.json({ limit: '1mb' }));
app.set('etag', 'strong');

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/flashcards', flashcardRoutes);
app.use('/api/gamification', gamificationRoutes);
app.use('/api/study-guides', studyGuideRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/streak', streakRoutes);

// --- Temporarily disabled routes ---
// app.use('/api/documents', documentRoutes);

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
