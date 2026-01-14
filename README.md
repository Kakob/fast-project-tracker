# Project Tracker

A fast, minimal-click project/task management app with better UX than Notion's projects and tasks.

## Features

- **Kanban Board**: Drag-and-drop cards between status columns (To Do, In Progress, Done, Archived)
- **List View**: Hierarchical list with inline editing, expandable sub-items, and quick-add
- **Calendar View**: Month view with items positioned by due date, drag to reschedule
- **Infinite Nesting**: Any item can contain sub-items (Project > Task > Subtask > ...)
- **Optimistic Updates**: Instant UI feedback with server sync in background
- **Keyboard Shortcuts**: Press `n` to quickly add items

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS
- **State**: Zustand (UI state) + TanStack Query (server state)
- **Backend**: Supabase (PostgreSQL + Auth + RLS)

## Quick Start

### 1. Supabase Setup

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Install Supabase CLI: `npm install -g supabase`
3. Link to your project: `supabase link --project-ref YOUR_PROJECT_REF`
4. Run the database setup:
   ```bash
   supabase db reset
   ```

### 2. Web App Setup

1. Navigate to the web directory: `cd web`
2. Install dependencies: `npm install`
3. Create `.env.local` file:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```
4. Run the development server: `npm run dev`
5. Open [http://localhost:3000](http://localhost:3000)

### 3. First Run

1. Sign in with email magic link or Google OAuth
2. Add your first item using the quick-add input or press `n`
3. Try the different views: Board, List, Calendar
4. Click an item to open the details panel
5. Drag items between columns in Board view or between days in Calendar view

## Project Structure

```
/supabase/
  schema.sql        # Database schema (profiles, items tables)
/web/
  app/
    (tracker)/      # Main app routes
      board/        # Kanban view
      list/         # List view
      calendar/     # Calendar view
    auth/           # Auth callback
    sign-in/        # Sign-in page
  components/
    tracker-layout.tsx  # Main app shell
    item/               # Item components
  lib/
    hooks/          # TanStack Query hooks
    stores/         # Zustand stores
  types/            # TypeScript types
```

## Development

```bash
cd web
npm run dev       # Start dev server
npm run build     # Production build
npm run lint      # Run linter
```

## Database

Two tables with Row Level Security:

- **profiles**: User profile data (linked to Supabase Auth)
- **items**: Tasks/projects with self-referential `parent_id` for infinite nesting

Item statuses: `todo`, `in_progress`, `done`, `archived`
Item priorities: `none`, `low`, `medium`, `high`, `urgent`

## License

MIT
