require("dotenv").config();

const Redis = require("ioredis");
const { createClient } = require("@supabase/supabase-js");

// Must match backend/src/services/hold-queue.service.js.
const QUEUE_NAME = "seat-holds";
const SEAT_CHANNEL = "nhip:seat-changes";

function need(name) {
  if (!process.env[name]) throw new Error(`Missing ${name} in .env`);
  return process.env[name];
}

// BullMQ workers and subscriber connections need maxRetriesPerRequest: null.
const redis = () => new Redis(need("REDIS_URL"), { maxRetriesPerRequest: null });

// Service-role key: the database grants nothing to the public role.
const supabase = () => createClient(need("SUPA_URL"), need("SUPA_KEY"));

module.exports = { redis, supabase, QUEUE_NAME, SEAT_CHANNEL };
