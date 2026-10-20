require("dotenv").config();

const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPA_URL;
const supabaseKey = process.env.SUPA_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing SUPA_URL or SUPA_KEY in .env");
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;