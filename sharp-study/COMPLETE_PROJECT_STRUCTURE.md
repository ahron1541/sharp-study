# Sharp Study - Complete Project Structure & Architecture Documentation

## Table of Contents
1. [Project Overview](#project-overview)
2. [Complete Folder Structure](#complete-folder-structure)
3. [Architecture Diagram](#architecture-diagram)
4. [File Connections & Workflow](#file-connections--workflow)
5. [Data Flow Diagrams](#data-flow-diagrams)
6. [API Endpoints Reference](#api-endpoints-reference)

---

## Project Overview

**Sharp Study** is a full-stack web application that helps students generate study materials (study guides, flashcards, quizzes) from uploaded documents using AI.

### Technology Stack

#### Frontend
- **React 18** with Vite for build tooling
- **React Router DOM** for client-side routing
- **Tailwind CSS** for styling
- **Supabase JS** for authentication
- **i18next** for internationalization (English & Filipino)
- **Framer Motion** for animations
- **Lucide React** for icons
- **TipTap** for rich text editing

#### Backend
- **Node.js** with Express.js
- **Supabase** for database and authentication
- **Google Gemini AI** for content generation
- **Nodemailer** for email OTP
- **Multer** for file uploads
- **Winston** for logging
- **Zod** for validation

---

## Complete Folder Structure

```
sharp-study/
│
├── PROJECT_PROGRESS_REPORT.md          # Project progress tracking
├── PROJECT_STRUCTURE.md                # Basic structure documentation
├── COMPLETE_PROJECT_STRUCTURE.md       # This comprehensive documentation
│
├── db_backups/                         # Database backup files
│
├── backend/                            # Express.js API Server
│   ├── .env                            # Environment variables (secret)
│   ├── .env.example                    # Environment variables template
│   ├── .gitignore                      # Git ignore rules
│   ├── package.json                    # Dependencies and scripts
│   ├── package-lock.json               # Locked dependency versions
│   ├── app js backup/                  # Backup of app.js
│   │
│   └── src/
│       ├── app.js                      # Main Express application entry point
│       │
│       ├── config/
│       │   └── supabase.js             # Supabase client configuration
│       │
│       ├── features/
│       │   ├── admin/
│       │   │   └── admin.routes.js     # Admin-only routes
│       │   │
│       │   ├── ai/
│       │   │   ├── ai.routes.js        # AI generation route definitions
│       │   │   ├── ai.controller.js    # AI request handling logic
│       │   │   └── ai.service.js       # Google Gemini AI integration
│       │   │
│       │   └── auth/
│       │       ├── auth.routes.js      # Authentication route definitions
│       │       └── auth.controller.js  # Authentication logic
│       │
│       └── middleware/
│           ├── auth.middleware.js      # JWT/Supabase token verification
│           ├── rateLimit.middleware.js # Rate limiting for API protection
│           ├── sanitize.middleware.js  # Input sanitization
│           └── validate.middleware.js  # Request validation with Zod
│
└── frontend/                           # React + Vite SPA
    ├── .gitignore                      # Git ignore rules
    ├── eslint.config.js                # ESLint configuration
    ├── index.html                      # HTML entry point
    ├── package.json                    # Dependencies and scripts
    ├── package-lock.json               # Locked dependency versions
    ├── README.md                       # Frontend documentation
    ├── tailwind.config.js              # Tailwind CSS configuration
    ├── vite.config.js                  # Vite build configuration
    │
    ├── public/                         # Static assets (not processed)
    │   ├── favicon.svg                 # Browser tab icon
    │   ├── icons.svg                   # SVG icon sprite
    │   ├── index.html                  # Fallback HTML
    │   ├── manifest.json               # PWA manifest
    │   └── sw.js                       # Service worker for offline support
    │
    └── src/
        ├── main.jsx                    # React application entry point
        ├── App.jsx                     # Root component with routing
        ├── App.css                     # Root component styles
        ├── index.css                   # Global styles
        ├── main-copy.html              # Backup HTML file
        │
        ├── assets/                     # Processed static assets
        │   ├── hero.png                # Hero section image
        │   ├── react.svg               # React logo
        │   ├── vite.svg                # Vite logo
        │   ├── icons/                  # Icon assets
        │   │   └── buttons/
        │   │       ├── back_button_light_mode.svg
        │   │       └── back_button_dark_mode.svg
        │   └── logo/                   # Logo assets
        │       ├── verso_w_name.svg
        │       └── verso_logo.svg
        │
        ├── config/                     # Application configuration
        │   ├── api.js                  # API client configuration
        │   └── shared/
        │       └── utils/
        │           ├── sanitize.js     # Input sanitization utilities
        │           └── validators.js   # Validation utilities
        │
        ├── i18n/                       # Internationalization
        │   ├── index.js                # i18next configuration
        │   └── locales/
        │       ├── en/
        │       │   └── auth.json       # English auth translations
        │       └── fil/
        │           └── auth.json       # Filipino auth translations
        │
        ├── router/
        │   └── AppRouter.jsx           # Main application router
        │
        ├── shared/                     # Shared components and utilities
        │   ├── components/
        │   │   ├── AuthTabs.jsx        # Login/Register tab component
        │   │   ├── Breadcrumb.jsx      # Navigation breadcrumb
        │   │   ├── Button.jsx          # Reusable button component
        │   │   ├── CookieConsent.jsx   # GDPR cookie consent
        │   │   ├── Modal.jsx           # Reusable modal component
        │   │   ├── Navbar.jsx          # Navigation bar
        │   │   ├── OfflineScreen.jsx   # Offline mode screen
        │   │   ├── ProtectedRoute.jsx  # Auth route guard
        │   │   ├── SessionTimeout.jsx  # Session expiration handler
        │   │   ├── SkeletonCard.jsx    # Loading skeleton
        │   │   ├── SkeletonLoader.jsx  # Generic loader
        │   │   ├── SkeletonLoader.css  # Loader styles
        │   │   ├── Spinner.jsx         # Loading spinner
        │   │   └── Tooltip.jsx         # Tooltip component
        │   │
        │   └── utils/
        │       ├── sanitize.js         # XSS prevention utilities
        │       └── validators.js       # Form validation utilities
        │
        ├── styles/                     # Global style files
        │   ├── globals.css             # Global CSS resets
        │   ├── index.css               # Main styles index
        │   └── tokens.css              # CSS custom properties (design tokens)
        │
        └── features/                   # Feature-based modules
            │
            ├── accessibility/          # Accessibility features
            │   ├── components/
            │   │   └── AccessibilityPanel.jsx  # A11y settings panel
            │   └── context/
            │       └── AccessibilityContext.jsx # A11y state management
            │
            ├── admin/                  # Admin functionality
            │   └── pages/
            │       └── AdminPage.jsx   # Admin dashboard
            │
            ├── auth/                   # Authentication feature
            │   ├── context/
            │   │   └── AuthContext.jsx # Auth state management
            │   │
            │   ├── forgot-password/
            │   │   ├── components/
            │   │   │   └── ForgotPasswordFlow.jsx
            │   │   └── hooks/
            │   │       └── useForgotPassword.js
            │   │
            │   ├── login/
            │   │   ├── components/
            │   │   │   └── LoginForm.jsx
            │   │   └── hooks/
            │   │       └── useLoginForm.js
            │   │
            │   ├── otp/
            │   │   ├── components/
            │   │   │   └── OTPInput.jsx
            │   │   └── hooks/
            │   │       └── useOTP.js
            │   │
            │   ├── pages/
            │   │   ├── DashboardPage.jsx     # Post-login redirect
            │   │   ├── ForgotPasswordPage.jsx
            │   │   ├── LoginPage.jsx
            │   │   └── RegisterPage.jsx
            │   │
            │   ├── shared/
            │   │   ├── components/
            │   │   │   ├── AuthLayout.jsx    # Auth page layout
            │   │   │   ├── PasswordInput.jsx
            │   │   │   ├── PasswordStrength.jsx
            │   │   │   ├── PillButton.jsx
            │   │   │   └── PillInput.jsx
            │   │   └── services/
            │   │       └── auth.service.js   # API calls for auth
            │   │
            │   └── signup/
            │       ├── components/
            │       │   ├── SignupStepper.jsx
            │       │   ├── Step1EmailOTP.jsx
            │       │   ├── Step2UserDetails.jsx
            │       │   └── Step3Success.jsx
            │       └── hooks/
            │           └── useSignupForm.js
            │
            ├── dashboard/                # Main dashboard feature
            │   ├── components/
            │   │   ├── AppShell.jsx      # Main layout shell
            │   │   ├── DashboardEmptyState.jsx
            │   │   ├── MaterialCard.jsx  # Document card component
            │   │   ├── SkeletonMaterialCard.jsx
            │   │   ├── Sidebar.jsx       # Navigation sidebar
            │   │   └── TopBar.jsx        # Top navigation bar
            │   │
            │   ├── hooks/
            │   │   ├── useDashboard.js   # Dashboard data fetching
            │   │   └── useStreak.js      # Study streak tracking
            │   │
            │   └── pages/
            │       ├── DashboardPage.jsx # Main dashboard view
            │       └── DashboardPage - Copy.jsx # Backup
            │
            ├── errors/                   # Error handling
            │   └── pages/
            │       └── NotFoundPage.jsx  # 404 page
            │
            ├── flashcards/               # Flashcards feature
            │   └── pages/
            │       └── FlashcardsPage.jsx
            │
            ├── landing/                  # Landing/marketing page
            │   ├── components/
            │   │   ├── FeaturesSection.jsx
            │   │   ├── HeroSection.jsx
            │   │   ├── HeroSection.module.css
            │   │   ├── LandingFooter.jsx
            │   │   ├── LandingNav.jsx
            │   │   └── ShowcaseSection.jsx
            │   └── pages/
            │       └── LandingPage.jsx
            │
            ├── quiz/                     # Quiz feature
            │   └── pages/
            │       └── QuizPage.jsx
            │
            ├── settings/                 # User settings
            │   ├── components/
            │   │   ├── AccountSecurityPanel.jsx
            │   │   ├── LivePreviewCard.jsx
            │   │   └── PersonalizationPanel.jsx
            │   ├── hooks/
            │   │   └── useSettings.js
            │   └── pages/
            │       └── SettingsPage.jsx
            │
            ├── study-guide/              # Study guide viewer/editor
            │   ├── components/
            │   │   ├── StudyGuideEditor.jsx
            │   │   ├── TableOfContents.jsx
            │   │   └── TTSButton.jsx     # Text-to-speech
            │   └── pages/
            │       └── StudyGuidePage.jsx
            │
            ├── theme/                    # Theme management
            │   ├── constants/
            │   │   └── themes.js         # Theme definitions
            │   ├── hooks/
            │   │   └── useTheme.js       # Theme state hook
            │   └── services/
            │       └── preferences.service.js # Theme API calls
            │
            └── upload/                   # File upload feature
                └── components/
                    └── UploadModal.jsx   # Document upload modal
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (React + Vite)                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │   Landing   │    │    Auth     │    │  Dashboard  │    │   Settings  │  │
│  │    Page     │───▶│    Flow     │───▶│     Page    │───▶│     Page    │  │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘  │
│                          │                  │                   │          │
│                          ▼                  ▼                   ▼          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    AuthContext (State Management)                    │   │
│  │                    ThemeContext                                      │   │
│  │                    AccessibilityContext                              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                          │                                                  │
│                          ▼                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    Shared Components Layer                           │   │
│  │   Button │ Modal │ Navbar │ ProtectedRoute │ SkeletonLoader │ etc.  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                          │                                                  │
│                          ▼                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    API Client (config/api.js)                        │   │
│  │              Fetch wrapper with auth token injection                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                   │
                                   │ HTTP/REST API
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BACKEND (Express.js)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    Middleware Chain                                  │   │
│  │  CORS │ Helmet │ CookieParser │ RateLimit │ Auth │ Validate │ etc.  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                          │                                                  │
│                          ▼                                                  │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                     │
│  │    Auth     │    │     AI      │    │    Admin    │                     │
│  │   Routes    │    │   Routes    │    │   Routes    │                     │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘                     │
│         │                  │                  │                             │
│         ▼                  ▼                  ▼                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                     │
│  │    Auth     │    │     AI      │    │    Admin    │                     │
│  │  Controller │    │  Controller │    │  Controller │                     │
│  └──────┬──────┘    └──────┬──────┘    └─────────────┘                     │
│         │                  │                                               │
│         ▼                  ▼                                               │
│  ┌─────────────┐    ┌─────────────┐                                        │
│  │   Auth      │    │     AI      │                                        │
│  │   Service   │    │   Service   │                                        │
│  └──────┬──────┘    └──────┬──────┘                                        │
│         │                  │                                               │
└─────────┼──────────────────┼───────────────────────────────────────────────┘
          │                  │
          ▼                  ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│    Supabase     │  │  Google Gemini  │  │    Nodemailer   │
│   (Database     │  │     (AI)        │  │    (Email)      │
│   & Auth)       │  │                 │  │                 │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

---

## File Connections & Workflow

### 1. Application Entry Points

#### Frontend Entry Flow
```
frontend/index.html
        │
        ▼
frontend/src/main.jsx ─────────────────────────────────────────┐
        │                                                      │
        ▼                                                      │
frontend/src/App.jsx                                           │
        │                                                      │
        ├──▶ router/AppRouter.jsx (Route definitions)         │
        │                                                      │
        ├──▶ features/auth/context/AuthContext.jsx (Auth)     │
        │                                                      │
        ├──▶ features/theme/hooks/useTheme.js (Theming)       │
        │                                                      │
        ├──▶ features/accessibility/context/                  │
        │       AccessibilityContext.jsx (A11y)               │
        │                                                      │
        └──▶ i18n/index.js (Internationalization)             │
                                                                │
frontend/src/index.css (Global styles) ◀───────────────────────┘
```

#### Backend Entry Flow
```
backend/package.json (start: node src/app.js)
        │
        ▼
backend/src/app.js ────────────────────────────────────────────┐
        │                                                      │
        ├──▶ config/supabase.js (Database connection)         │
        │                                                      │
        ├──▶ middleware/ (Applied in order)                   │
        │       ├── auth.middleware.js                        │
        │       ├── rateLimit.middleware.js                   │
        │       ├── sanitize.middleware.js                    │
        │       └── validate.middleware.js                    │
        │                                                      │
        └──▶ features/ (Route modules)                        │
                ├── auth/auth.routes.js                       │
                ├── ai/ai.routes.js                           │
                └── admin/admin.routes.js                     │
                                                                │
backend/.env (Environment variables) ◀────────────────────────┘
```

---

### 2. Authentication Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SIGNUP FLOW (OTP-based)                           │
└─────────────────────────────────────────────────────────────────────────────┘

User Registration:
─────────────────

frontend/src/features/auth/pages/RegisterPage.jsx
        │
        ▼
frontend/src/features/auth/signup/components/SignupStepper.jsx
        │
        ├──▶ Step1EmailOTP.jsx
        │       │
        │       ▼
        │   frontend/src/features/auth/signup/hooks/useSignupForm.js
        │       │
        │       ▼
        │   frontend/src/features/auth/shared/services/auth.service.js
        │       │
        │       ▼ (POST /api/auth/signup/request-otp)
        │
        ├──▶ Step2UserDetails.jsx
        │       │
        │       ▼
        │   useSignupForm.js
        │       │
        │       ▼ (POST /api/auth/signup/verify-otp)
        │       ▼ (POST /api/auth/signup/complete)
        │
        └──▶ Step3Success.jsx


┌─────────────────────────────────────────────────────────────────────────────┐
│                              LOGIN FLOW                                     │
└─────────────────────────────────────────────────────────────────────────────┘

User Login:
───────────

frontend/src/features/auth/pages/LoginPage.jsx
        │
        ▼
frontend/src/features/auth/login/components/LoginForm.jsx
        │
        ▼
frontend/src/features/auth/login/hooks/useLoginForm.js
        │
        ▼
frontend/src/features/auth/shared/services/auth.service.js
        │
        ▼ (POST /api/auth/login)


┌─────────────────────────────────────────────────────────────────────────────┐
│                         BACKEND AUTH PROCESSING                             │
└─────────────────────────────────────────────────────────────────────────────┘

Backend Routes:
───────────────

backend/src/features/auth/auth.routes.js
        │
        ├──▶ POST /api/auth/signup/request-otp
        │       │
        │       ▼
        │   backend/src/features/auth/auth.controller.js
        │       │
        │       ├──▶ Creates Supabase user
        │       ├──▶ Sends OTP via Nodemailer
        │       └──▶ Stores temp data
        │
        ├──▶ POST /api/auth/signup/verify-otp
        │       │
        │       ▼
        │   auth.controller.js
        │       │
        │       └──▶ Verifies OTP with Supabase
        │
        ├──▶ POST /api/auth/signup/complete
        │       │
        │       ▼
        │   auth.controller.js
        │       │
        │       ├──▶ Creates profile in database
        │       └──▶ Hashes password
        │
        ├──▶ POST /api/auth/login
        │       │
        │       ▼
        │   auth.controller.js
        │       │
        │       ├──▶ Authenticates with Supabase
        │       └──▶ Returns JWT token
        │
        ├──▶ POST /api/auth/forgot-password/request-otp
        ├──▶ POST /api/auth/forgot-password/verify-otp
        └──▶ POST /api/auth/forgot-password/reset


Auth State Management:
──────────────────────

frontend/src/features/auth/context/AuthContext.jsx
        │
        ├──▶ Stores: user, loading, isAuthenticated
        ├──▶ Provides: signIn, signUp, signOut, refreshUser
        └──▶ Wraps entire app for global auth state
```

---

### 3. Dashboard & Document Management Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DASHBOARD LAYOUT                                  │
└─────────────────────────────────────────────────────────────────────────────┘

frontend/src/features/dashboard/pages/DashboardPage.jsx
        │
        ▼
frontend/src/features/dashboard/components/AppShell.jsx
        │
        ├──▶ Sidebar.jsx (Navigation)
        │       │
        │       └──▶ Links to: Dashboard, Study Guide, Flashcards, Quiz, Settings
        │
        ├──▶ TopBar.jsx (Header)
        │       │
        │       └──▶ User info, notifications, theme toggle
        │
        └──▶ Main Content Area
                │
                ├──▶ MaterialCard.jsx (Document cards)
                ├──▶ DashboardEmptyState.jsx (When no documents)
                └──▶ UploadModal.jsx (File upload trigger)


Data Fetching:
──────────────

frontend/src/features/dashboard/hooks/useDashboard.js
        │
        ▼ (GET /api/documents)
frontend/src/config/api.js
        │
        ▼ (with Bearer token from localStorage)
backend/src/app.js (authenticated route)
```

---

### 4. AI Document Processing Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        AI CONTENT GENERATION                                │
└─────────────────────────────────────────────────────────────────────────────┘

Upload & Generate:
──────────────────

frontend/src/features/upload/components/UploadModal.jsx
        │
        ▼ (File selection with react-dropzone)
frontend/src/config/api.js
        │
        ▼ (POST /api/ai/generate with multipart/form-data)
backend/src/features/ai/ai.routes.js
        │
        ▼
backend/src/features/ai/ai.controller.js
        │
        ├──▶ Multer middleware processes file upload
        ├──▶ Extract text from PDF/DOCX/PPTX
        │
        ▼
backend/src/features/ai/ai.service.js
        │
        ├──▶ Send to Google Gemini AI
        │     └──▶ Model: gemini-1.5-flash
        │
        ├──▶ Generate Study Guide
        ├──▶ Generate Flashcards
        └──▶ Generate Quiz
        │
        ▼
backend/src/config/supabase.js
        │
        └──▶ Store results in Supabase database
```

---

### 5. Theme & Personalization Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          THEME MANAGEMENT                                   │
└─────────────────────────────────────────────────────────────────────────────┘

frontend/src/features/theme/constants/themes.js
        │
        └──▶ Defines: light, dark, and custom theme palettes


frontend/src/features/theme/hooks/useTheme.js
        │
        ├──▶ Reads theme preference from localStorage
        ├──▶ Applies CSS variables to document root
        └──▶ Syncs with backend via preferences.service.js


frontend/src/features/theme/services/preferences.service.js
        │
        ▼ (GET/PATCH /api/auth/preferences)
backend/src/features/auth/auth.controller.js
        │
        └──▶ Stores preferences in profiles table


Settings Page:
──────────────

frontend/src/features/settings/pages/SettingsPage.jsx
        │
        ├──▶ PersonalizationPanel.jsx (Theme, language, accessibility)
        ├──▶ AccountSecurityPanel.jsx (Password, 2FA)
        └──▶ LivePreviewCard.jsx (Preview changes)
```

---

### 6. Internationalization (i18n) Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        INTERNATIONALIZATION                                 │
└─────────────────────────────────────────────────────────────────────────────┘

frontend/src/i18n/index.js
        │
        ├──▶ Initializes i18next
        ├──▶ Loads language resources
        └──▶ Detects browser language


Language Resources:
───────────────────

frontend/src/i18n/locales/en/auth.json    (English translations)
frontend/src/i18n/locales/fil/auth.json   (Filipino translations)


Usage in Components:
────────────────────

import { useTranslation } from 'react-i18next';

const Component = () => {
  const { t, i18n } = useTranslation();
  
  return <h1>{t('auth.login.title')}</h1>;
};
```

---

### 7. Accessibility Features Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        ACCESSIBILITY (A11y)                                 │
└─────────────────────────────────────────────────────────────────────────────┘

frontend/src/features/accessibility/context/AccessibilityContext.jsx
        │
        ├──▶ Font size adjustment
        ├──▶ High contrast mode
        ├──▶ Screen reader optimizations
        └──▶ Keyboard navigation enhancements


frontend/src/features/accessibility/components/AccessibilityPanel.jsx
        │
        └──▶ UI controls for accessibility settings
```

---

## Data Flow Diagrams

### User Authentication Data Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  User    │────▶│ React    │────▶│ API      │────▶│ Backend  │
│  Input   │     │ Form     │     │ Client   │     │ API      │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
                                      │                  │
                                      │                  ▼
                                      │           ┌──────────┐
                                      │           │ Supabase │
                                      │           │ Auth     │
                                      │           └──────────┘
                                      │                  │
                                      ▼                  ▼
                               ┌─────────────────────────┐
                               │ localStorage            │
                               │ (JWT Token)             │
                               └─────────────────────────┘
                                      │
                                      ▼
                               ┌─────────────────────────┐
                               │ AuthContext             │
                               │ (Global Auth State)     │
                               └─────────────────────────┘
```

### Document Processing Data Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  User    │────▶│ Upload   │────▶│ API      │────▶│ Backend  │
│  Selects │     │ Modal    │     │ Client   │     │ AI       │
│  File    │     └──────────┘     └──────────┘     └──────────┘
│           │                                          │
│  (PDF,    │                                          ▼
│   DOCX,   │                                 ┌──────────┐
│   PPTX)   │                                 │ Google   │
└──────────┘                                 │ Gemini   │
                                              │ AI       │
                                              └──────────┘
                                                    │
                                                    ▼
                                             ┌──────────┐
                                             │ Supabase │
                                             │ Database │
                                             └──────────┘
                                                    │
                                                    ▼
                                             ┌──────────┐
                                             │ Frontend │
                                             │ Display  │
                                             │ Results  │
                                             └──────────┘
```

---

## API Endpoints Reference

### Authentication Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/auth/signup/request-otp` | Request OTP for signup | No |
| POST | `/api/auth/signup/verify-otp` | Verify OTP code | No |
| GET | `/api/auth/signup/check-username` | Check username availability | No |
| POST | `/api/auth/signup/complete` | Complete signup with password | No |
| POST | `/api/auth/login` | User login | No |
| POST | `/api/auth/forgot-password/request-otp` | Request password reset OTP | No |
| POST | `/api/auth/forgot-password/verify-otp` | Verify reset OTP | No |
| POST | `/api/auth/forgot-password/reset` | Reset password | No |
| GET | `/api/auth/preferences` | Get user preferences | Yes |
| PATCH | `/api/auth/preferences` | Update user preferences | Yes |

### AI Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/ai/generate` | Generate study materials from document | Yes |

### Health Check

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Server health check |

---

## Key File Relationships

### Frontend Core Files

| File | Purpose | Dependencies |
|------|---------|--------------|
| `main.jsx` | App entry point | App.jsx, index.css |
| `App.jsx` | Root component | AppRouter, AuthContext, Theme |
| `AppRouter.jsx` | Route definitions | All page components |
| `AuthContext.jsx` | Auth state | auth.service.js |
| `api.js` | HTTP client | localStorage (tokens) |

### Backend Core Files

| File | Purpose | Dependencies |
|------|---------|--------------|
| `app.js` | Express server | All routes, middleware, config |
| `supabase.js` | DB client | .env variables |
| `auth.middleware.js` | Token verification | supabase.js |
| `auth.controller.js` | Auth logic | supabase.js, nodemailer |
| `ai.service.js` | AI generation | @google/generative-ai |

---

## Summary

This documentation provides a complete overview of the Sharp Study project structure, including:

1. **Complete file tree** - Every file and folder in the project
2. **Architecture diagrams** - Visual representation of system components
3. **Workflow explanations** - How data flows through the application
4. **File connections** - Dependencies and relationships between files
5. **API reference** - All available endpoints

The project follows a **feature-based architecture** where each major feature (auth, dashboard, AI, settings, etc.) has its own directory containing components, hooks, services, and pages. This structure promotes modularity, maintainability, and scalability.