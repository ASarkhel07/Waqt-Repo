# Edit Display Name — Implementation Plan

## Overview
Add a Display Name section to Settings where the user edits `profiles.full_name`, persists it to Supabase, and keeps the Profile greeting in sync when they navigate back.

## Files changed
| File | Action |
|---|---|
| `app/settings.tsx` | Modified — Account section, fetch, save, validation, errors |
| `app/(tabs)/profile.tsx` | Modified — `useFocusEffect` to re-fetch on focus |
| `lib/supabase.ts` | No change |
| `app/_layout.tsx` | No change |
| Supabase Dashboard | Verify UPDATE RLS on `profiles` |

## Data flow
- **Read:** `getSession()` → `SELECT full_name FROM profiles WHERE id = user.id` → populate input
- **Write:** `UPDATE profiles SET full_name = ? WHERE id = user.id`
- **Sync:** `useFocusEffect` in `profile.tsx` re-fetches on every focus so greeting stays current

## Validation rules
- Trim whitespace before compare and save
- Empty after trim → save as `null` (Profile falls back to email prefix)
- Max 50 characters (`maxLength` on TextInput + handler check)
- Save disabled when trimmed value equals current `initialName`

## Error handling
- No session → "You must be signed in."
- Supabase SELECT/UPDATE error → show `error.message`
- Success → brief "Display name saved." confirmation

## Supabase RLS requirements
- SELECT policy: `auth.uid() = id` on `profiles`
- UPDATE policy: `auth.uid() = id` on `profiles`
- Row guaranteed to exist (created at signup in `auth.tsx`)

## Test plan
1. Open Settings → input shows current name (or empty with email placeholder)
2. Change name → Save → success → back → Profile shows new name
3. Save with only spaces → saves null → Profile shows email fallback
4. Save unchanged → button disabled
5. Clear name entirely → saves null → Profile shows email fallback
6. 51+ chars → blocked by maxLength
