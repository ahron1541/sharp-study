# Sharp Study Project Structure

## Overview
This repository contains a full-stack web application with:
- `backend/` — Express.js API server with Supabase integration, email OTP auth, and AI document generation.
- `frontend/` — React + Vite SPA with Tailwind CSS, authentication flows, dashboard, study guide, quiz, and accessibility features.

## Root Files
- `PROJECT_PROGRESS_REPORT.md`
- `backend/`
- `db_backups/`
- `frontend/`

## Backend Structure

### Root
- `.env`
- `.env.example`
- `.gitignore`
- `package.json`
- `package-lock.json`
- `app js backup/`
- `src/`

### Backend `package.json`
- `start`: `node src/app.js`
- `dev`: `nodemon src/app.js`
- Dependencies include:
  - `express`, `cors`, `helmet`, `cookie-parser`
  - `@supabase/supabase-js`
  - `bcrypt`, `bcryptjs`
  - `express-rate-limit`, `express-slow-down`
  - `nodemailer`
  - `pdf-parse`, `mammoth`, `multer`
  - `@google/generative-ai`
  - `winston`, `zod`

### Backend `src/`
- `app.js`
- `config/`
  - `supabase.js`
- `features/`
  - `admin/`
    - `admin.routes.js`
  - `ai/`
    - `ai.routes.js`
    - `ai.controller.js`
    - `ai.service.js`
  - `auth/`
    - `auth.routes.js`
    - `auth.controller.js`
- `middleware/`
  - `auth.middleware.js`
  - `rateLimit.middleware.js`
  - `sanitize.middleware.js`
  - `validate.middleware.js`

### Backend API routes
Active routes:
- `GET /health` — health check
- `POST /api/auth/signup/request-otp`
- `POST /api/auth/signup/verify-otp`
- `GET /api/auth/signup/check-username`
- `POST /api/auth/signup/complete`
- `POST /api/auth/login`
- `POST /api/auth/forgot-password/request-otp`
- `POST /api/auth/forgot-password/verify-otp`
- `POST /api/auth/forgot-password/reset`
- `GET /api/auth/preferences` — authenticated
- `PATCH /api/auth/preferences` — authenticated
- `POST /api/ai/generate` — authenticated + AI rate limit

Disabled / future route stubs in `src/app.js`:
- `/api/documents`
- `/api/study-guides`
- `/api/flashcards`
- `/api/quizzes`

### Backend Authentication and Security
- `src/middleware/auth.middleware.js`
  - verifies Supabase bearer token
  - loads `req.user`
  - supports admin role checks
- `src/middleware/rateLimit.middleware.js`
  - general API limiter: 100 requests / 15 min
  - AI generation limiter: 10 requests / hour per user
  - login brute-force limiter: 10 attempts / hour
  - slowdown middleware for repeated requests
- `src/config/supabase.js`
  - exports `supabaseAdmin`
  - uses `SUPABASE_SERVICE_ROLE_KEY`

### AI and File Processing
- `src/features/ai/ai.service.js`
  - uses `@google/generative-ai`
  - creates `study_guide`, `flashcards`, `quiz`
  - uses Geminis model: `gemini-1.5-flash`
- `src/features/ai/ai.controller.js`
  - file upload with `multer`
  - extracts text from `PDF`, `DOCX`, `PPTX`
  - stores document records in Supabase
  - generates content and saves output sets

### Authentication Flow
- signup OTP email flow with Supabase and `nodemailer`
- username availability check
- signup completion with hashed password storage
- login via email or username
- password reset via OTP email
- preferences saved in `profiles` table

## Frontend Structure

### Root
- `.env`
- `.gitignore`
- `eslint.config.js`
- `index.html`
- `package.json`
- `README.md`
- `tailwind.config.js`
- `vite.config.js`
- `public/`
  - `index.html`
  - `manifest.json`
  - `sw.js`

### Frontend `package.json`
- `dev`: `vite`
- `build`: `vite build`
- `preview`: `vite preview`
- `lint`: `eslint .`
- Dependencies include:
  - `react`, `react-dom`, `react-router-dom`
  - `@tiptap/react`, `@tiptap/starter-kit`
  - `@supabase/supabase-js`
  - `tailwindcss`, `@tailwindcss/vite`
  - `framer-motion`, `lucide-react`, `react-hot-toast`
  - `i18next`, `react-i18next`
  - `react-dropzone`, `dompurify`

### Frontend `src/`
- `App.jsx`
- `App.css`
- `index.css`
- `main.jsx`
- `main-copy.html`
- `router/`
  - `AppRouter.jsx`
- `config/`
  - `api.js`
  - `shared/utils/`
    - `sanitize.js`
    - `validators.js`
- `i18n/`
  - `index.js`
  - `locales/en/auth.json`
  - `locales/fil/auth.json`
- `assets/`
  - `logo/`
    - `verso_w_name.svg`
    - `verso_logo.svg`
  - `icons/buttons/`
    - `back_button_light_mode.svg`
    - `back_button_dark_mode.svg`
- `shared/`
  - `components/`
    - `AuthTabs.jsx`
    - `Breadcrumb.jsx`
    - `Button.jsx`
    - `CookieConsent.jsx`
    - `Modal.jsx`
    - `Navbar.jsx`
    - `OfflineScreen.jsx`
    - `ProtectedRoute.jsx`
    - `SessionTimeout.jsx`
    - `SkeletonCard.jsx`
    - `Spinner.jsx`
    - `Tooltip.jsx`
  - `utils/`
    - `sanitize.js`
    - `validators.js`
- `features/`
  - `accessibility/`
    - `components/AccessibilityPanel.jsx`
    - `context/AccessibilityContext.jsx`
  - `admin/`
    - `pages/AdminPage.jsx`
  - `auth/`
    - `context/AuthContext.jsx`
    - `forgot-password/`
      - `components/ForgotPasswordFlow.jsx`
      - `hooks/useForgotPassword.js`
    - `login/`
      - `components/LoginForm.jsx`
      - `hooks/useLoginForm.js`
    - `otp/`
      - `components/OTPInput.jsx`
      - `hooks/useOTP.js`
    - `pages/`
      - `DashboardPage.jsx`
      - `ForgotPasswordPage.jsx`
      - `LoginPage.jsx`
      - `RegisterPage.jsx`
    - `shared/`
      - `components/`
        - `AuthLayout.jsx`
        - `PasswordInput.jsx`
        - `PasswordStrength.jsx`
        - `PillButton.jsx`
        - `PillInput.jsx`
      - `services/auth.service.js`
    - `signup/`
      - `components/`
        - `SignupStepper.jsx`
        - `Step1EmailOTP.jsx`
        - `Step2UserDetails.jsx`
        - `Step3Success.jsx`
      - `hooks/useSignupForm.js`
  - `dashboard/`
    - `components/`
      - `AppShell.jsx`
      - `DashboardEmptyState.jsx`
      - `MaterialCard.jsx`
      - `SkeletonMaterialCard.jsx`
      - `Sidebar.jsx`
      - `TopBar.jsx`
    - `hooks/`
      - `useDashboard.js`
      - `useStreak.js`
    - `pages/`
      - `DashboardPage.jsx`
      - `DashboardPage - Copy.jsx`
  - `errors/`
    - `pages/NotFoundPage.jsx`
  - `flashcards/`
    - `pages/FlashcardsPage.jsx`
  - `landing/`
    - `components/`
      - `FeaturesSection.jsx`
      - `HeroSection.jsx`
      - `LandingFooter.jsx`
      - `LandingNav.jsx`
      - `ShowcaseSection.jsx`
  - `quiz/`
    - `pages/QuizPage.jsx`
  - `settings/`
    - `components/`
      - `AccountSecurityPanel.jsx`
      - `LivePreviewCard.jsx`
      - `PersonalizationPanel.jsx`
    - `hooks/useSettings.js`
    - `pages/SettingsPage.jsx`
  - `study-guide/`
    - `components/`
      - `StudyGuideEditor.jsx`
      - `TableOfContents.jsx`
      - `TTSButton.jsx`
    - `pages/StudyGuidePage.jsx`
  - `theme/`
    - `constants/themes.js`
    - `hooks/useTheme.js`
    - `services/preferences.service.js`
  - `upload/`
    - `components/UploadModal.jsx`

### Frontend app features
- Routing with `react-router-dom`
- Auth flow with OTP signup and password reset
- Multilingual support via `i18next`
- Accessible dashboard and study guide experience
- File upload support for AI generation
- Theme and personalization settings

## API Integration
- Frontend API client in `src/config/api.js`
- Uses `fetch()` to call backend endpoints
- Adds JSON headers and Bearer auth token from `localStorage`
- Default backend host: `http://localhost:5000`

## Environment and Deployment Notes
- Backend uses `.env` values for:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `SUPABASE_ANON_KEY`
  - `EMAIL_USER`
  - `EMAIL_APP_PASSWORD`
  - `GEMINI_API_KEY`
- Frontend uses Vite env variables such as `VITE_API_URL`
- Backend CORS allows localhost ports and the deployed Vercel origin

## Recommended Next Steps
1. Add the missing backend route modules for documents, study guides, flashcards, and quizzes.
2. Keep `.env.example` in sync with required keys.
3. Expand frontend route definitions inside `src/router/AppRouter.jsx`.
4. Add tests for backend auth and AI generation flows.

---

> This file documents the current repository layout, technology stack, API endpoints, and backend/frontend architecture for the Sharp Study project.
