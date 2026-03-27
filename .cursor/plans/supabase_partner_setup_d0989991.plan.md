---
name: Supabase Partner Setup
overview: Add two committed files to the repo — a `.env.example` template and a `SUPABASE_SETUP.md` guide — so the partner knows exactly what to create after pulling.
todos:
  - id: "1"
    content: Create .env.example at project root with the two variable names and empty values
    status: pending
  - id: "2"
    content: Create SUPABASE_SETUP.md at project root with step-by-step partner instructions
    status: pending
isProject: false
---

# Supabase Partner Setup Guide Plan

## Goal

Commit two files to the repo that tell the partner exactly what `.env` to create and how.

## Files to create

### 1. `.env.example` (project root)

A committed template showing the required variable names with empty values. Git-safe because it contains no real secrets.

```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

### 2. `SUPABASE_SETUP.md` (project root)

A short setup guide committed to the repo. After the partner runs `git pull`, they see this file and follow the steps.

Content outline:

- **Step 1** — Create a file named `.env` at the project root (same level as `package.json`)
- **Step 2** — Copy the contents of `.env.example` into it
- **Step 3** — Fill in the two values (partner gets them directly from you, e.g. via iMessage/Discord — they are the same keys already in your `.env`)
- **Step 4** — Confirm `.env` is in `.gitignore` (it already is — do not commit it)
- **Step 5** — Restart the Expo dev server (`npx expo start`) so the new env vars are picked up

The doc also notes:

- Both partners use the **same** Supabase project URL and anon key
- The anon key is the "public" key from Supabase → Settings → API; never use the `service_role` key in the app
- The `.env` file must never be pushed to GitHub

## What does NOT change

- `[lib/supabase.ts](lib/supabase.ts)` — already reads from `process.env`, no edits needed
- `[app/_layout.tsx](app/_layout.tsx)` — no changes
- `.gitignore` — `.env` is already listed on line 35, no changes needed

