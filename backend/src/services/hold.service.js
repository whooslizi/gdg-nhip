
const supabase = require("../config/supabase");

async function holdSeats(showtimeId, seatIds) {
  const { data, error } = await supabase.rpc("hold_seats", {
    p_showtime_id: showtimeId,
    p_seat_ids: seatIds,
  });

  if (error) {
    console.error("Hold seats failed:", error);
    throw error;
  }

  return data;
}

async function cancelHold(holdToken) {
  const { data, error } = await supabase.rpc("cancel_hold", {
    p_hold_token: holdToken,
  });

  if (error) {
    console.error("Cancel hold failed:", error);
    throw error;
  }

  return data;
}

module.exports = { holdSeats, cancelHold };

