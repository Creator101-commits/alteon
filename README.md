<h1 align="center">Alteon</h1>
<p align="center"><strong>AI-powered student productivity for notes, assignments, scheduling, and study workflows in one academic workspace.</strong></p>

[![License: MIT][license-badge]][license-url]
[![Frontend: React + Vite][vite-badge]][vite-url]
[![Database: Supabase PostgreSQL][supabase-badge]][supabase-url]

Alteon is an all-in-one student productivity platform for planning, note-taking, assignments, and study workflows.

Architecture used:
- Frontend: React + Vite on Vercel
- Backend: Vercel serverless API routes under /api/*
- Data/Auth: Supabase PostgreSQL + Firebase Authentication
- Integrations: Groq AI and Google Calendar/Classroom APIs

Key features:
- AI-assisted notes with diff-style accept/reject edits
- Unified calendar + assignment tracking and sync
- Study tools (flashcards, Pomodoro, analytics)
- Dashboard workflows for daily planning and progress

<p align="center">
	<img src="images/alteon.png" alt="Alteon Dashboard" />
</p>

## Installation

### Prerequisites
- Node.js 18+
- npm 8+
- Git

### 1. Clone
```sh
git clone https://github.com/Creator101-commits/Alteon.git
cd Alteon
```

### 2. Install dependencies
```sh
npm install
```

### 3. Create environment file
Create a .env file in the repository root (see .env.example):

```env
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.your-project.supabase.co:5432/postgres

# Firebase
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_PROJECT_ID=your_firebase_project_id
VITE_FIREBASE_APP_ID=your_firebase_app_id

# Groq (server-side only)
GROQ_API_KEY=your_groq_api_key

# Google APIs
VITE_GOOGLE_CLIENT_ID=your_google_client_id
VITE_GOOGLE_API_KEY=your_google_api_key
```

### 4. Start development
```sh
npm run dev
```

Optional Vercel-style local API runtime:
```sh
vercel dev
```

## Usage example

### Daily student workflow
1. Sign in with Firebase authentication.
2. Connect Google Calendar and import events.
3. Create classes and assignments with due dates.
4. Draft notes with the rich editor and AI assistant.
5. Use dashboard + calendar to plan sessions.
6. Track progress with analytics and productivity tools.

### AI note workflow
1. Open a note and write your draft.
2. Launch AI assistant in the editor.
3. Ask for editing, expansion, summaries, or structure.
4. Review proposed diff-style changes.
5. Accept or reject changes before applying.

For detailed walkthroughs, see [docs/HOW_TO_USE.md](docs/HOW_TO_USE.md).

## Development setup

### Commands
```sh
npm run dev      # Start Vite dev server (default port 5173)
npm run build    # Production build
npm run start    # Start production server
npm run check    # Type checking
npm run db:push  # Push database schema changes
```

### Project structure
```text
Alteon/
├── src/                   # React app (components, pages, contexts, hooks)
├── api/                   # Vercel serverless API routes (/api/*)
├── lib/                   # Shared libraries (HAC scraping, utilities)
├── shared/                # Shared schema definitions
├── supabase/migrations/   # Drizzle SQL migrations
├── docs/                  # Documentation
├── scripts/               # Tooling scripts
└── images/, sounds/, etc. # Static assets
```

### Database setup (Supabase + Drizzle)
1. Create a Supabase project.
2. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.
3. Set DATABASE_URL from Supabase Database Settings.
4. Run npm run db:push or apply SQL in supabase/migrations/.

## System architecture

### Core stack
- Frontend: React 18, TypeScript, Vite, Tailwind CSS, Wouter
- UI/UX: Radix UI, Framer Motion, Tiptap, Recharts
- Backend: Vercel serverless API routes under /api/*
- Data: Supabase PostgreSQL + Supabase Storage
- Auth: Firebase Authentication (Google SSO)
- AI: Groq models for chat, writing help, and summarization

### Data flow
1. User interacts with React frontend.
2. Firebase handles authentication and session identity.
3. Frontend calls /api/* routes and trusted Supabase operations.
4. Serverless functions connect to Google APIs, HAC services, and AI providers.
5. Supabase stores notes, assignments, classes, and related entities.
6. React Query handles caching, optimistic updates, and invalidation.

### Security and reliability
- Firebase-authenticated user identity per request.
- Supabase Row Level Security and managed PostgreSQL backups.
- Serverless deployment for scale and low ops overhead.
- Cloudflare + Vercel edge network for performance and protection.

## Feature highlights

### Smart note-taking
- Rich text editor with advanced formatting
- Context-aware AI writing assistant
- Diff-style AI edit review (accept/reject)
- Auto-save and class/category organization
- Search, filtering, pinning, and print support

### Calendar and assignments
- Unified calendar view for events and deadlines
- Google Calendar sync (manual + auto sync)
- Assignment priority, status, and due-date tracking
- Calendar-linked assignment timeline

### Study and productivity tools
- Flashcards with spaced repetition
- Pomodoro timer with session tracking
- Mood tracking and journaling
- Analytics dashboard for patterns and progress

### AI assistance
- Multi-purpose study chat
- Summarization for text, PDF, and video workflows
- Quick prompts for outlining, editing, and expansion

## Configuration

### Google Calendar integration
1. Enable Google Calendar API in Google Cloud Console.
2. Create OAuth 2.0 credentials.
3. Add authorized redirect URIs.
4. Update Google environment variables.

### AI services
1. Create a Groq API key and set GROQ_API_KEY.
2. Configure Firebase project credentials.
3. Enable required Google APIs (Calendar/Classroom as needed).

## Release History

### Recent updates
- AI Writing Assistant integrated with diff-style accept/reject workflow
- Cleaner AI text insertion (markdown symbol cleanup)
- Light mode consistency improvements across major components
- Google Calendar auto-sync improvements
- Expanded loading states and error handling
- Mobile responsiveness and dashboard usability improvements

## Meta

- Project: Alteon
- Repository: https://github.com/Creator101-commits/Alteon
- License: MIT
- Main documentation: docs/HOW_TO_USE.md

Distributed under the MIT License. See [LICENSE](LICENSE) for details.

## Contributing

1. Fork the repository.
2. Create your feature branch (example: feature/amazing-feature).
3. Commit your changes with a clear message.
4. Push your branch.
5. Open a Pull Request.

### Development guidelines
- Follow TypeScript best practices.
- Keep API input validation strict.
- Add tests for meaningful logic changes.
- Update documentation when behavior changes.

## Support

- Documentation: [docs](docs/)
- Issues: [GitHub Issues](https://github.com/Creator101-commits/Alteon/issues)
- Email: support@alteon.com

## Roadmap

### Completed
- AI writing assistant with editable diff workflow
- Context-aware AI suggestions in notes
- Google Calendar synchronization
- Light mode optimization and theme consistency
- Auto-save improvements and network status feedback

### Upcoming
- Mobile app (React Native)
- Offline support with local sync strategy
- Advanced AI tutoring and study planning
- Collaborative study features
- LMS integrations (Canvas, Moodle, Blackboard)

## Acknowledgments

- React
- Radix UI
- Tailwind CSS
- Drizzle ORM
- Supabase
- Groq

---

Alteon - Empowering students with AI-driven productivity tools.

[license-badge]: https://img.shields.io/badge/license-MIT-green.svg?style=flat-square
[license-url]: LICENSE
[vite-badge]: https://img.shields.io/badge/frontend-React%20%2B%20Vite-646CFF.svg?style=flat-square
[vite-url]: https://vitejs.dev/
[supabase-badge]: https://img.shields.io/badge/database-Supabase-3ECF8E.svg?style=flat-square
[supabase-url]: https://supabase.com/
