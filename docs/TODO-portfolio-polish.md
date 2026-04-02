# Portfolio Polish To-Do

Improvements to make this project stand out for entry-level SWE interviews.

## High Priority

- [ ] **Add tests** — even 5-10 tests changes the conversation
  - [ ] Unit tests for `buildItemTree()` and `flattenItemTree()` (pure functions, easy wins)
  - [ ] Unit tests for `formatDuration()` and `formatDurationShort()`
  - [ ] Hook tests for a couple of mutations (create item, toggle timer)
- [ ] **Add error toasts** — mutations currently fail silently
  - [ ] Install `sonner` or `react-hot-toast`
  - [ ] Add success/error feedback on create, update, delete, and timer actions
- [ ] **Break up `projects/page.tsx`** (1,081 lines) — interviewers will open this file
  - [ ] Extract `ProjectCard` component
  - [ ] Extract `ProjectTaskList` component
  - [ ] Extract shared keyboard navigation into a custom hook
- [ ] **README with visuals** — recruiters spend 30 seconds on a repo
  - [ ] Screenshot or GIF of Board view
  - [ ] Screenshot or GIF of timer + time summary
  - [ ] Screenshot of keyboard shortcuts modal
  - [ ] Brief "why I built this" section (better than Notion, cheaper than Toggl)
  - [ ] Tech stack list with brief rationale

## Nice to Have

- [ ] Add loading/disabled state to buttons during mutations
- [ ] Add input validation with `zod` on forms
- [ ] Add an error boundary component
- [ ] Highlight overdue items visually in list/board views
- [ ] Add search/filter UI


 Must do

  1. Commit your uncommitted work — You have 13 modified files and
  several untracked files (timer components, time entries hook,
  archive view, migration). That's a large chunk of features
  sitting only on your local machine.
  2. Run the time_entries migration on your Supabase project — The
  migration file exists locally
  (supabase/migrations/20260324000000_add_time_entries.sql) but
  needs to be applied to your hosted Supabase database. Run:
  supabase db push
  2. or apply it manually in the Supabase SQL editor.
  3. Set environment variables on your host — Your .env files are
  gitignored (good), so you'll need to configure
  NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in
  your deploy platform's environment settings (Vercel, Netlify,
  etc.).

  Should do

  4. Configure Supabase Auth redirect URLs — In your Supabase
  dashboard under Auth > URL Configuration, add your production
  domain to the allowed redirect URLs, otherwise magic links and
  Google OAuth will break.
  5. Set up Google OAuth (if you want it) — You'll need to register
   your production domain in the Google Cloud Console and update
  the credentials in Supabase Auth > Providers.

  Nice to have

  6. Custom domain — Most deploy platforms give you a .vercel.app
  or similar subdomain by default, which works fine for a portfolio
   piece.