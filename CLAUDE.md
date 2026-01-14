# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Project Tracker - a fast, minimal-click project/task management app with Kanban, List, and Calendar views. Built with Next.js and Supabase.

## Common Commands

### Web App (Next.js)
```bash
cd web
npm install           # Install dependencies
npm run dev           # Dev server on 0.0.0.0:3000 (accessible on local network)
npm run dev:local     # Dev server on localhost only
npm run build         # Production build
npm run lint          # ESLint
```

### Supabase
```bash
supabase db reset     # Reset database (runs schema.sql)
```

## Architecture

### Project Structure
- `/web` - Next.js web frontend
- `/supabase` - Database schema and RLS policies

### Database (Supabase PostgreSQL)
Two tables with Row Level Security:
- `profiles` - User profile (id, email, display_name, photo_url)
- `items` - Tasks/projects with infinite nesting via self-referential `parent_id`

Item fields: title, description, status (todo/in_progress/done/archived), priority (none/low/medium/high/urgent), due_date, position

### Web App (`/web`)
- **Framework**: Next.js 14 App Router
- **State**: Zustand (UI state) + TanStack Query (server state with optimistic updates)
- **Styling**: Tailwind CSS
- **Auth**: Supabase Auth (email magic link + Google OAuth)

Key directories:
- `app/(tracker)/` - Main app routes (board, list, calendar views)
- `components/` - React components (tracker-layout, item/, views/, ui/)
- `lib/stores/` - Zustand stores (ui-store.ts)
- `lib/hooks/` - TanStack Query hooks (use-items.ts)
- `types/` - TypeScript types and display configs

### Data Flow
- Items fetched via TanStack Query with caching
- Mutations use optimistic updates for instant UI feedback
- UI state (selected item, expanded items, editing state) managed in Zustand
- Parent-child relationships computed client-side with `buildItemTree()`

### Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```
