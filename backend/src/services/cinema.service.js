const supabase = require("../config/supabase");

async function getCinemaById(cinemaId) {
  const { data, error } = await supabase
    .from("cinemas")
    .select("cinemaid, areaid, cinemaname, locate")
    .eq("cinemaid", cinemaId)
    .maybeSingle();

  if (error) {
    console.error("Supabase query failed:", error);
    throw error;
  }

  return data;
}

async function getCinemaRooms(cinemaId) {
  const { data, error } = await supabase
    .from("rooms")
    .select("roomid, roomname")
    .eq("cinemaid", cinemaId);

  if (error) throw error;

  return data;
}

module.exports = { 
    getCinemaById,
    getCinemaRooms
};