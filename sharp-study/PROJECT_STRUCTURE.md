# Sharp Study - Project Documentation

## Overview

**Sharp Study** is a full-stack study application that helps students with ADHD and Dyslexia learn more effectively. Users can upload documents (PDF, DOCX, PPTX, TXT) and the AI generates:
- Study Guides
- Flashcards
- Quizzes

---

## Tech Stack

### Frontend
- **Framework**: React 19 + Vite 8
- **Styling**: Tailwind CSS 4, CSS Modules
- **State**: React Context API
- **Routing**: React Router DOM 7
- **HTTP**: Fetch API with custom wrapper
- **i18n**: i18next (English, Filipino)
- **Icons**: Lucide React, React Icons

### Backend
- **Runtime**: Node.js (Express 5)
- **Database**: Supabase (PostgreSQL)
- **AI**: Google Gemini API
- **File Processing**: pdf-parse, mammoth

### Deployment
- **Frontend**: Vercel
- **Backend**: Render

---

## Project Structure

```
sharp-study/
├── backend/                    # Express API Server
│   ├── src/
│   │   ├── app.js             # Express app entry point
│   │   ├── config/
│   │   │   └── supabase.js    # Supabase client config
│   │   ├── features/
│   │   │   ├── ai/           # AI generation (Gemini)
│   │   │   │   ├── ai.controller.js
│   │   │   │   ├── ai.routes.js
│   │   │   │   └── ai.service.js
│   │   │   ├── auth/         # Authentication
│   │   │   │   ├── auth.controller.js
│   │   │   │   └── auth.routes.js
│   │   │   ├── dashboard/    # Dashboard data
│   │   │   │   ├── dashboard.controller.js
│   │   │   │   ├── dashboard.routes.js
│   │   │   │   └── dashboard.cache.js
│   │   │   └── admin/        # Admin panel
│   │   │       └── admin.routes.js
│   │   ├── middleware/
│   │   │   ├── auth.middleware.js
│   │   │   ├── rateLimit.middleware.js
│   │   │   ├── sanitize.middleware.js
│   │   │   └── validate.middleware.js
│   │   └── utils/
│   │       ├── cache.js
│   │       └── httpCache.js
│   └── package.json
│
├── frontend/                   # React SPA
│   ├── src/
│   │   ├── main.jsx         # React entry point
│   │   ├── App.jsx          # Root component
│   │   ├── index.css        # Global styles
│   │   ├── App.css          # App styles
│   │   ├── assets/          # Images, icons
│   │   ├── config/
│   │   │   ├── api.js       # API configuration
│   │   │   └── shared/
│   │   │       └── utils/
│   │   │           ├── sanitize.js
│   │   │           └── validators.js
│   │   ├── features/       # Feature modules
│   │   │   ├── auth/       # Auth flow (login, register, forgot-password, OTP)
│   │   │   ├── dashboard/ # Main dashboard
│   │   │   ├── library/   # Document library
│   │   │   ├── flashcards/# Flashcard study
│   │   │   ├── quiz/       # Quiz taking
│   │   │   ├── study-guide/# Study guide reading
│   │   │   ├── upload/    # File upload modal
│   │   │   ├── settings/  # User settings
│   │   │   ├── theme/     # Theme management
│   │   │   ├── landing/    # Public landing page
│   │   │   ├── accessibility/# Accessibility settings
│   │   │   └── errors/    # Error pages
│   │   ├── i18n/           # Internationalization
│   │   ├── router/        # React Router config
│   │   ├── shared/        # Reusable components
│   │   └── styles/        # Style tokens
│   ├── public/             # Static assets
│   ├── index.html
│   └── package.json
│
└── db_backups/              # Database backups
```

---

## Installed Packages

### Backend Dependencies

```json
{
  "@google/generative-ai": "^0.24.1",
  "@supabase/supabase-js": "^2.104.0",
  "adm-zip": "^0.5.17",
  "bcrypt": "^6.0.0",
  "bcryptjs": "^3.0.3",
  "cookie-parser": "^1.4.7",
  "cors": "^2.8.6",
  "crypto": "^1.0.1",
  "csurf": "^1.11.0",
  "dotenv": "^17.4.2",
  "express": "^5.2.1",
  "express-rate-limit": "^8.3.2",
  "express-slow-down": "^3.1.0",
  "helmet": "^8.1.0",
  "mammoth": "^1.12.0",
  "multer": "^2.1.1",
  "nodemailer": "^8.0.5",
  "pdf-parse": "^2.4.5",
  "resend": "^6.12.2",
  "winston": "^3.19.0",
  "zod": "^4.3.6"
}
```

**Dev Dependencies:**
- `nodemon`: ^3.1.14

### Frontend Dependencies

```json
{
  "@puckeditor/core": "^0.21.2",
  "@supabase/supabase-js": "^2.104.0",
  "@tailwindcss/vite": "^4.2.3",
  "@tiptap/extension-heading": "^3.22.4",
  "@tiptap/pm": "^3.22.4",
  "@tiptap/react": "^3.22.4",
  "@tiptap/starter-kit": "^3.22.4",
  "dompurify": "^3.4.0",
  "framer-motion": "^12.38.0",
  "i18next": "^26.0.6",
  "i18next-browser-languagedetector": "^8.2.1",
  "lucide-react": "^1.8.0",
  "react": "^19.2.5",
  "react-dom": "^19.2.5",
  "react-dropzone": "^15.0.0",
  "react-hot-toast": "^2.6.0",
  "react-i18next": "^17.0.4",
  "react-icons": "^5.6.0",
  "react-router-dom": "^7.14.1",
  "sass": "^1.99.0",
  "tailwindcss": "^4.2.3",
  "workbox-window": "^7.4.0"
}
```

**Dev Dependencies:**
- `eslint`: ^9.39.4
- `@vitejs/plugin-react`: ^6.0.1
- `vite`: ^8.0.9

---

## Commands

### Backend

```bash
# Install dependencies
cd backend
npm install

# Start server (production)
npm start

# Start server (development with nodemon)
npm run dev
```

### Frontend

```bash
# Install dependencies
cd frontend
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

---

## Database Schema (Supabase)

### Tables

```sql
-- Users profile (links to Supabase Auth)
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  email text NOT NULL,
  full_name text,
  role text DEFAULT 'student',
  is_blocked boolean DEFAULT false,
  username text UNIQUE,
  first_name text,
  middle_name text,
  last_name text,
  login_attempts integer DEFAULT 0,
  locked_until timestamp with time zone,
  password_hash text,
  preferences jsonb DEFAULT '{"xp": 0, "level": 1, "streak": {"current": 0, "longest": 0}}'
);

-- Uploaded documents
CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES public.profiles(id),
  title text NOT NULL,
  file_url text,
  file_type text,
  file_size_bytes bigint,
  extracted_text text,
  status text DEFAULT 'processing',
  is_archived boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- Generated study guides
CREATE TABLE public.study_guides (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES public.profiles(id),
  document_id uuid REFERENCES public.documents(id),
  title text NOT NULL,
  content text NOT NULL,
  is_archived boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- Flashcard sets
CREATE TABLE public.flashcard_sets (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES public.profiles(id),
  document_id uuid REFERENCES public.documents(id),
  title text NOT NULL,
  is_archived boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- Individual flashcards
CREATE TABLE public.flashcards (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  set_id uuid REFERENCES public.flashcard_sets(id),
  front text NOT NULL,
  back text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Quizzes
CREATE TABLE public.quizzes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES public.profiles(id),
  document_id uuid REFERENCES public.documents(id),
  title text NOT NULL,
  is_archived boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- Quiz questions
CREATE TABLE public.quiz_questions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  quiz_id uuid REFERENCES public.quizzes(id),
  question text NOT NULL,
  options jsonb NOT NULL,
  correct_index integer NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- OTP codes for auth
CREATE TABLE public.otp_codes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email text NOT NULL,
  code text NOT NULL,
  purpose text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  used boolean DEFAULT false,
  ip_address text,
  created_at timestamp with time zone DEFAULT now()
);

-- Login attempts tracking
CREATE TABLE public.login_attempts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email text NOT NULL,
  ip_address text,
  succeeded boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);
```

---

## Environment Variables

### Backend (.env)

```env
# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_key

# Gemini AI
GEMINI_API_KEY=your_gemini_api_key

# App
NODE_ENV=development
PORT=10000
CORS_ORIGIN=http://localhost:5173
```

### Frontend (.env)

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_KEY=your_supabase_anon_key
```

---

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `POST /api/auth/forgot-password` - Send OTP for password reset
- `POST /api/auth/reset-password` - Reset password with OTP
- `POST /api/auth/verify-otp` - Verify OTP code

### AI Generation
- `POST /api/ai/generate` - Upload file and generate study materials
  - Accepts: PDF, DOCX, PPTX, TXT
  - Options: study_guide, flashcards, quiz

### Dashboard
- `GET /api/dashboard` - Get user's dashboard data
- `GET /api/dashboard/stats` - Get user statistics

### Documents
- `GET /api/documents` - List user's documents
- `GET /api/documents/:id` - Get document details
- `DELETE /api/documents/:id` - Delete document

### Study Guides
- `GET /api/study-guides` - List study guides
- `GET /api/study-guides/:id` - Get study guide content
- `DELETE /api/study-guides/:id` - Delete study guide

### Flashcards
- `GET /api/flashcard-sets` - List flashcard sets
- `GET /api/flashcard-sets/:id` - Get flashcards in set
- `DELETE /api/flashcard-sets/:id` - Delete flashcard set

### Quizzes
- `GET /api/quizzes` - List quizzes
- `GET /api/quizzes/:id` - Get quiz questions
- `POST /api/quizzes/:id/submit` - Submit quiz answers

---

## Key Features

### 1. File Upload & Text Extraction
- Upload PDF, DOCX, PPTX, TXT files
- Extract text using pdf-parse (PDF), mammoth (DOCX)
- Store extracted text in database

### 2. AI Generation
- Uses Google Gemini API
- Generates:
  - Study Guides (structured markdown)
  - Flashcards (JSON array)
  - Quiz Questions (JSON array with options)

### 3. User Preferences
- XP and Level system
- Daily streak tracking
- Theme customization (light/dark)
- Font size and family options
- Daily study goals

### 4. Accessibility
- ADHD-friendly UI (short sentences, clear structure)
- Dyslexia-friendly fonts
- Adjustable font sizes
- High contrast themes

---

## Deployment

### Backend to Render
1. Connect GitHub repo to Render
2. Set build command: `npm install`
3. Set start command: `npm start`
4. Add environment variables in Render dashboard

### Frontend to Vercel
1. Connect GitHub repo to Vercel
2. Framework preset: Vite
3. Build command: `npm run build`
4. Output directory: `dist`

---

## Common Commands for Development

```bash
# Pull latest changes
git pull origin main

# Install all dependencies
cd backend && npm install
cd ../frontend && npm install

# Start backend (from backend folder)
npm start

# Start frontend dev server (from frontend folder)
npm run dev

# Build frontend
cd frontend && npm run build

# Check for linting errors
cd frontend && npm run lint
```

---

## Notes

- The app uses Supabase for authentication and database
- AI generation requires a Google Gemini API key (free tier available)
- File size limit: 150MB
- Text extraction is capped at 50,000 characters in database
- AI prompts are optimized for ADHD/Dyslexia friendly content
