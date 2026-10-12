# Setting up the ASA Kenya backend (Supabase)

You do this once. After that, officials add opportunities at `/admin.html` and nothing needs redeploying.

Status: the SQL passed 106 automated checks on a local Postgres, and the admin page and Graduate Hub passed browser tests against a mock server. **Nothing has been tested against your real Supabase project yet. Step 9 is that test; please do it.**

## 1. Run the SQL (safe to repeat)
1. Supabase dashboard, open your project, then **SQL Editor**, then **New query**.
2. Paste the whole of `supabase/migrations/001_opportunities_and_roles.sql` and press **Run**. Expect "Success".
3. New query: paste `supabase/migrations/002_graduate_hub.sql` and **Run**.
Both files can be run again without harm. They create tables with Row Level Security (RLS) switched on, so the public can only read published opportunities and approved portfolios.

## 2. Check the security rules (optional, recommended)
Paste `supabase/tests/rls_checks.sql` into the SQL Editor and run it. It makes test users inside a transaction and **always rolls back**, so it leaves no data. The result appears as a red error message beginning "ALL n CHECKS PASSED". That wording is expected. If it says "x OF n CHECKS FAILED", send me the list. (The test file needs the local stub only on a laptop; on Supabase it uses the real `auth` schema. If it complains about test users, skip it and rely on step 9.)

## 3. Turn off public sign-ups
**Authentication, then Sign In / Providers (or Settings)**: switch **Allow new users to sign up** off. Keep **Email** enabled. This stops strangers creating accounts. Staff accounts are created by you in step 4.

## 4. Create staff accounts
**Authentication, then Users, then Add user, then Create new user.** Enter the email and a password, and tick **Auto Confirm User**. Do this for yourself first, then each official.

## 5. Give roles (this is what makes someone staff)
A new user can log in but has **no access** until you give a role. In the SQL Editor:
```sql
-- first admin (you)
insert into public.staff_roles (user_id, role)
select id, 'admin' from auth.users where email = 'YOUR-EMAIL@example.com';

-- an official who can add and submit, but not publish
insert into public.staff_roles (user_id, role)
select id, 'editor' from auth.users where email = 'OFFICIAL@example.com';
```
Roles: **editor** adds and edits their own drafts and submits for approval. **admin** approves, publishes, archives, deletes, and sees sign-ups. Nobody can promote themselves; only this SQL does it.

## 6. Storage (poster and PDF uploads)
Migration 001 creates the public bucket `opportunity-files` (5 MB limit; JPEG, PNG, WebP and PDF only) and its policies. Check under **Storage**: the bucket should exist. Uploads go to `<user id>/<random name>`. Users can only upload into their own folder.

## 7. Netlify and keys
This site is plain HTML with no build step, so **Netlify environment variables are not used**. The Supabase URL and the **publishable** key are in `config.js`; that key is designed to be public, and the database rules do the protecting.
- Never put the **secret / service_role** key or the database password in this repo or any page.
- If you ever rotate the publishable key, edit `config.js` and push.
Deploy by pushing to GitHub (Netlify publishes `main`).

## 8. Fill in official links
Edit `config.js`: put the confirmed BORAQS address in `OFFICIAL_LINKS.BORAQS`. Until then the roadmap shows "link to be confirmed".

## 9. Test (local, then live)
Run locally: in the project folder run `python3 -m http.server 8000` and open http://localhost:8000/admin.html. Then repeat on your live site.
1. **Public site, empty:** Student Hub and `#graduates` show "nothing published yet", with no errors.
2. **Login:** `/admin.html`. A wrong password shows a message. Your admin login works. Log out works.
3. **Editor flow:** log in as an editor, add an opportunity with a PDF or image, and **Submit for approval**. Check it is **not** on the public site.
4. **Admin flow:** log in as admin, open **Awaiting approval**, **Preview**, then **Confirm: publish**. Reload the public site: it appears with no redeploy. **Archive** it: it disappears.
5. **Editor limits:** the editor sees no Publish or Delete buttons.
6. **Forms:** submit the graduate interest form, the alert opt-in and a portfolio. In admin, open **Sign-ups and portfolios** to see them. Approve the portfolio and see it on the hub.
7. **Anonymous check:** in a private window, open `YOUR-URL/rest/v1/opportunities?select=*` with only the apikey header (or just trust the SQL test in step 2). The public must not be able to read drafts or `created_by`.

## 10. Email alerts
The site does **not** send emails, and says so on the page. The sign-up list records interest only. Sending later needs an email service (Supabase Edge Function plus a provider such as Resend); tell me when you want it. Do not announce alerts until that exists.

## Troubleshooting
- "The database tables are not set up yet": run step 1.
- "You do not have permission": the account has no role (step 5), or an editor tried an admin action.
- Password reset email: set **Authentication, then URL Configuration, then Site URL** to your site address.
- Upload refused: file over 5 MB or not JPG, PNG, WebP or PDF.
