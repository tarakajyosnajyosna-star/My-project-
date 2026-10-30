const { createClient } = require("@supabase/supabase-js");

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn("Supabase credentials are missing. Copy backend/.env.example to backend/.env and configure it.");
}

const supabase = createClient(
  process.env.SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-key",
  { auth: { autoRefreshToken: false, persistSession: false } }
);

module.exports = supabase;
