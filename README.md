# Yacht Crew Availability

A free, static crew-availability site. Captains and crew sign in with an email magic link (Supabase Auth). Crew keep a profile, availability windows, and CV. Captains search by role and dates and can post jobs.

## Live site

https://namboy91.github.io/yacht-crew-availability/

The frontend uses only the Supabase publishable (anon) key. Row Level Security on the project enforces who can read or write.

## Auth URL configuration

In the Supabase dashboard: **Authentication → URL Configuration**

- Site URL: `https://namboy91.github.io/yacht-crew-availability/`
- Redirect URLs: `https://namboy91.github.io/yacht-crew-availability/` and `https://namboy91.github.io/yacht-crew-availability/**`

## Local preview

Serve the `site` folder over HTTP (opening the file directly will not complete magic-link sign-in).
