# Setting up the ASA Kenya backend (Supabase)

You do this once. After that, officials add opportunities at `/admin.html` and nothing needs redeploying.

Status: the SQL passed 135 automated checks on a local Postgres, and the admin dashboard, Graduate Hub, events and announcements passed browser tests against a mock server. **Nothing has been tested against your real Supabase project yet. Step 9 is that test; please do it.**

## 1. Run the SQL (safe to repeat)
1. Supabase dashboard, open your project, then **SQL Editor**, then **New query**.
2. Paste the whole of `supabase/migrations/001_opportunities_and_roles.sql` and press **Run**. Expect "Success".
3. New query: paste `supabase/migrations/002_graduate_hub.sql` and **Run**.
4. New query: paste `supabase/migrations/003_events_and_announcements.sql` and **Run** (events and announcements for the dashboard).
5. New query: paste `supabase/migrations/004_staff_management.sql` and **Run** (lets administrators manage staff roles from the dashboard instead of writing SQL).
Both files can be run again without harm. They create tables with Row Level Security (RLS) switched on, so the public can only read published opportunities and approved portfolios.

## 2. Check the security rules (optional, recommended)
Paste `supabase/tests/rls_checks.sql` (run it after 001, 002 and 003) into the SQL Editor and run it. It makes test users inside a transaction and **always rolls back**, so it leaves no data. The result appears as a red error message beginning "ALL n CHECKS PASSED". That wording is expected. If it says "x OF n CHECKS FAILED", send me the list. (The test file needs the local stub only on a laptop; on Supabase it uses the real `auth` schema. If it complains about test users, skip it and rely on step 9.)

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
Roles: **editor** adds and edits their own opportunity drafts and submits them for approval. **admin** approves, publishes, unpublishes, archives and deletes opportunities, manages events and announcements, and sees sign-ups and portfolios. After migration 004, administrators can also manage roles from the dashboard's **Staff and roles** page; the database still checks admin rights on every change, and nobody can change their own role there.

## 6. Storage (poster and PDF uploads)

The website's upload forms accept files up to **25 MB**. After deploying this change, run migration `009_larger_uploads.sql` in the Supabase SQL Editor to apply the new bucket limit to the live project. This is a larger practical cap, not unlimited storage: your Supabase project's plan-level maximum, total storage quota, bandwidth and request limits still apply. The current browser implementation uses standard Storage uploads (not resumable/TUS uploads), so for files above 6 MB, Supabase recommends resumable uploads for greater reliability on unstable connections. For consistently larger files, integrate the Supabase resumable upload protocol before increasing this cap further.
Migration 001 creates the public bucket `opportunity-files` (25 MB limit; JPEG, PNG, WebP and PDF only) and its policies. Check under **Storage**: the bucket should exist. Uploads go to `<user id>/<random name>`. Users can only upload into their own folder.

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
- "Staff management is not switched on yet" on the Staff and roles page: run migration 004 (step 1.5), then reload.

## The dashboard
Open `https://asakenya.netlify.app/admin` (it redirects to `/admin/login` when you are signed out). Menu: Overview (statistics and analytics), Opportunities (search, filters, sorting, CSV export), Add opportunity, Events, Announcements, Sign-ups and portfolios, Staff and roles. Events and announcements are administrator-only. The login page is not linked from the public site and is marked noindex.
What appears on the public site, with no redeploy:
- Published **opportunities** in the Student Hub and the Graduate Hub finder.
- Published **events** on the Events page (they sit alongside the events already built into the site).
- Published **announcements** in the Journal section.
Drafts, pending and archived items are never public. Unpublish or archive removes an item from the site at once.

## Student Hub submissions (migration 005)
Run `supabase/migrations/005_student_submissions.sql` in the SQL Editor (after 001-003; 004 is optional staff management). It creates the `student_submissions` table and a PRIVATE `student-submissions` bucket (5 MB; JPG, PNG, WebP, PDF).
- Students submit from the Student Hub page ("Submit an opportunity"). Records start as pending and are visible only to administrators.
- Admin: **Student submissions** in the sidebar. Open a submission, open or download its attachment (short-lived signed link), approve or reject, or "Create opportunity draft" to publish it through Opportunities. Approving alone never publishes.
- Without migration 005 the admin section shows "not switched on yet" and the public form shows an unavailable message.
- Category pages still use the contact form (Formspree) for their own "Submit" buttons.
