const supabase = require("../config/supabase");

async function checkInBooking(bookingCode, showtimeId, qrVersion, adminUsername) {
  const { data, error } = await supabase.rpc("check_in_booking", {
    p_booking_code: bookingCode,
    p_showtime_id: showtimeId,
    p_qr_version: qrVersion,
    p_admin: adminUsername,
  });
  if (error) throw error;
  return data;
}

module.exports = { checkInBooking };
