"use client";

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  // This helps during local dev to surface missing envs in console
  // but won't crash the app at build time.
  console.warn("Supabase env vars are not set.");
}

export const supabase = createClient(supabaseUrl || "", supabaseAnonKey || "");

