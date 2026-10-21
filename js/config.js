/*
  config.js — where the backend lives.

  ONLY the *publishable* key may go here (it starts with "sb_publishable_").
  It is safe to be public: the database rules in supabase/setup.sql decide
  what a browser may do with it (read, create a request, move its status
  forward; never delete).

  NEVER put a secret / service-role key, database password or access token
  in this file or anywhere else in this repo. The repo is public.

  Leave both values empty ("") for LOCAL DEMO MODE: requests then only go
  to localStorage + BroadcastChannel (same browser only), as before.
*/

export const SUPABASE_URL = "";
export const SUPABASE_PUBLISHABLE_KEY = "";
