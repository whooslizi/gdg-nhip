const supabase = require("../config/supabase");

async function getAllEvents() {
  const { data, error } = await supabase
    .from("events")
    .select("*");

  if (error) {
    console.error("Supabase query failed:", error);
    throw error;
  }

  return data;
}

async function getEventById(eventId) {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("eventid", eventId)
    .maybeSingle();

  if (error) {
    console.error("Supabase query failed:", error);
    throw error;
  }

  return data;
}

async function getEventShowtimes(eventId) {
  const { data, error } = await supabase
    .from("showtimes")
    .select("showtimeid, startat, endat, status")
    .eq("eventid", eventId)
    .order("startat", { ascending: true });

  if (error) {
    console.error("Supabase query failed:", error);
    throw error;
  }

  return data;
}

module.exports = {
  getAllEvents,
  getEventById,
  getEventShowtimes,
};
