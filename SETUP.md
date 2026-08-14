# Backend Setup — Step 1

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → New project.
2. Choose a region close to Minnesota (US East or US West).
3. Note your **Project URL** and **anon key** (Dashboard → Project Settings → API).

## 2. Apply the schema

Open **Dashboard → SQL Editor → New query**, paste the contents of `schema.sql`, and run it.  
This creates four tables (`user_profiles`, `team_overrides`, `schedule`, `reports`), enables RLS, and adds the trigger that auto-creates a profile row on signup.

## 3. Wire up the client

Edit `supabase-client.js` and replace the two placeholder strings:

```js
const SUPABASE_URL  = 'https://YOUR_PROJECT_REF.supabase.co';
const SUPABASE_ANON = 'YOUR_ANON_KEY';
```

## 4. Enable email auth (and optionally Google SSO)

- Dashboard → Authentication → Providers → **Email** — enable, turn off "Confirm email" during dev.
- For school SSO: enable **Google** provider, use a Google OAuth client scoped to `@gustavus.edu`.

## 5. Create the first admin user

In the Supabase Dashboard → Authentication → Users → **Invite user** (or Add user).  
Then in the SQL Editor set their role:

```sql
UPDATE public.user_profiles SET role = 'admin' WHERE id = '<paste-user-uuid>';
```

## 6. Serve the pages over HTTPS

The `.dc.html` files load `supabase-client.js` as an ES module from the CDN, which requires
HTTPS. During development the easiest option is:

```sh
# Python 3 one-liner (serves current directory)
python3 -m http.server 8080
# Then open http://localhost:8080/MIAC%20Scouting%20Hub.dc.html
```

Or use the [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer)
VS Code extension.

## 7. Update the .dc.html pages (async calls)

The persistence functions in `data.js` and `auth.js` are now **async** (they return Promises).
Any place a page calls them needs an `await`. For example, in a page's `async render()`:

```js
// Before (sync, localStorage):
const team = getTeam(abbr);

// After (async, Supabase):
const team = await getTeam(abbr);
```

Find all calls to: `getTeam`, `getModel`, `loadOverride`, `saveOverride`, `clearOverride`,
`isCustom`, `getSchedule`, `saveSchedule`, `clearSchedule`, `isCustomSchedule`,
`getNonConfOpponents`, `getNextMatch`, `getReports`, `addReport`, `removeReport`,
`getReport`, `genPlayer`, `getCurrentUser`, `getCurrentUserId`, `canEdit`, `isAdmin`,
`getUsers`, `addUser`, `removeUser`, `setRole`.

Mark the containing function `async` and `await` each call.

## 8. Edge Functions (for admin user management)

`addUser` and `removeUser` in `auth.js` call Supabase Edge Functions named `invite-user`
and `delete-user`. These need to be deployed to wrap the Supabase admin SDK (which cannot
run in a browser). Create them in `supabase/functions/invite-user/index.ts` etc. and deploy
with `supabase functions deploy`. Until then, user management only works from the Dashboard.

---

## What's next (Steps 2–4)

- **Step 2**: SIDEARM roster importer — Node/Python scraper that emits `parseRosterCSV` rows
  per team, then calls `saveOverride` via the service-role key (server-side only).
- **Step 3**: Replace generated sample data with real imported data; keep coach editor as override.
- **Step 4**: Host images in Supabase Storage; add mobile CSS breakpoints.
