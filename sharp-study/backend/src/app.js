require('dotenv').config(); // <-- THIS MUST BE LINE 1
const express = require('express');
const cors = require('cors');

// Currently active features
const authRoutes = require('./features/auth/auth.routes');

// --- Temporarily commented out until we build these folders! ---
// const documentRoutes = require('./features/documents/documents.routes');
// const studyGuideRoutes = require('./features/study-guides/study-guides.routes');
// const flashcardRoutes = require('./features/flashcards/flashcards.routes');
// const quizRoutes = require('./features/quizzes/quizzes.routes');

const app = express();

// Middleware
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5174', // Your new Vite port!
    'https://sharp-study.vercel.app',
  ],
}));
app.use(express.json());

// API Routes
app.use('/api/auth', authRoutes);

// --- Temporarily disabled routes ---
// app.use('/api/documents', documentRoutes);
// app.use('/api/study-guides', studyGuideRoutes);
// app.use('/api/flashcards', flashcardRoutes);
// app.use('/api/quizzes', quizRoutes);

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});