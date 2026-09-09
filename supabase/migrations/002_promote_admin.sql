-- Promote a user to admin (moderation queue + verification queue + overview).
-- Replace the email, then run in the Supabase SQL editor.

update public.profiles
set role = 'admin'
where email = 'you@example.com';
