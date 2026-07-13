# Google Sign-In — setup guide

This doc gets Google OAuth working end-to-end for the ATS. Nothing in the code
has to be edited — the wiring is already done. What's below is the manual
configuration on **Google Cloud** and **Supabase**.

## What it does

- Users can click **Sign in with Google** on `/login` or **Sign up with Google** on `/signup`.
- Google authenticates them → redirects back to `/auth/callback`.
- The DB trigger creates a `profiles` row with:
  - `status = 'active'` — if this is the very first user (bootstrap super_admin)
  - `status = 'pending'` — if their email domain is on `auth_allowed_domains` OR their address is on `auth_email_whitelist`. Awaits admin approval.
  - `status = 'rejected'` — otherwise. Callback signs them out and redirects to `/login?status=rejected` with a friendly banner.
- The domain gate lives in `is_email_allowed()` (Postgres function). See migration `20260713000002_auth_domain_whitelist.sql`.
- Default allowlisted domains: `webduratech.com`, `webdura.in`.

## 1. Google Cloud Console

1. Go to https://console.cloud.google.com
2. Create (or select) a project — e.g. **Webdura HRM**
3. **APIs & Services → OAuth consent screen**
   - User type: **External**
   - App name: `Webdura ATS`
   - User support email + developer contact: your address
   - Authorised domains: `webduratech.com`, `webdura.in`, `supabase.co`, `vercel.app`
   - Save
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**
   - Application type: **Web application**
   - Name: `Webdura ATS – Supabase`
   - **Authorised JavaScript origins**:
     - `https://ats-webdura.vercel.app`
     - `http://localhost:3000` (dev)
   - **Authorised redirect URIs** (this is Supabase's callback, *not* our app's):
     - `https://<your-project-ref>.supabase.co/auth/v1/callback`
   - Create → copy the **Client ID** and **Client secret**

Publishing status can stay in "Testing" while you're the only user. Add test
users if others need to sign in before you publish.

## 2. Supabase dashboard

1. Open your Supabase project → **Authentication → Providers → Google**
2. **Enable**
3. Paste the **Client ID** and **Client secret** from step 1.4
4. **Callback URL (for OAuth)** — Supabase shows the URL you already registered in Google.
5. Under **Authentication → URL Configuration**, set:
   - **Site URL**: `https://ats-webdura.vercel.app`
   - **Redirect URLs (allowlist)**: add
     - `https://ats-webdura.vercel.app/auth/callback`
     - `http://localhost:3000/auth/callback` (for local dev)

## 3. Run the migration

In the Supabase SQL editor, paste the contents of
`supabase/migrations/20260713000002_auth_domain_whitelist.sql` and run it.

That creates:
- `auth_allowed_domains` — seeded with `webduratech.com` and `webdura.in`
- `auth_email_whitelist` — empty
- `is_email_allowed(text)` helper
- Updated `handle_new_user()` trigger

## 4. Verify

1. Deploy the app (`git push origin main` — Vercel picks it up)
2. Open the login page in an incognito window
3. Click **Sign in with Google** and pick an `@webduratech.com` or `@webdura.in` account
4. You should land on `/login?status=pending` with the "Awaiting administrator approval" banner
5. As a super_admin (on a normal window), open **Settings → Users & roles**, filter by **Pending**, and click **Approve** on that row
6. The user can now sign in
7. Try again with a Gmail account — you should see the **Sign-in declined** banner instead of the pending banner

## 5. Managing the allowlist

Super_admins can add/remove entries from the UI:

- **Settings → Access control**
  - Add domains for whole companies
  - Add specific emails for one-off external users (contractors, external recruiters, etc.)

Removing a domain does **not** revoke existing users — it only prevents new
signups. To disable an existing user, use **Settings → Users & roles**.

## Failure modes

| Symptom | Cause / fix |
| --- | --- |
| Google returns "redirect_uri_mismatch" | The redirect URI in Google Cloud must match Supabase's callback URL exactly (`https://<ref>.supabase.co/auth/v1/callback`). Copy from Supabase. |
| Google returns "This app is blocked" | OAuth consent screen still in Testing and the user isn't a listed test user. Add them or publish the app. |
| User lands on `/login?status=rejected` unexpectedly | Their email domain isn't on `auth_allowed_domains` and their email isn't on `auth_email_whitelist`. Add one of them via Settings → Access control, then have the user try again. |
| First-ever super_admin bootstraps as `rejected` | Impossible with the current trigger — `v_first_user` branch runs before the domain check. If seen, verify the migration was actually applied. |
| Existing user suddenly can't sign in | Not a signup-gate issue — the gate only fires on user creation. Check `profiles.status` for the user; if `disabled` or `rejected`, an admin flipped them. |
