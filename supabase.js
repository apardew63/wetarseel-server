require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

// Public anon client (safe to expose in frontend if needed)
const supabaseAnon = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Admin client (⚠️ only for backend, has elevated privileges)
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = { supabaseAnon, supabaseAdmin };
