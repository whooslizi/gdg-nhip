
const supabase = require("../config/supabase");

async function processMockPayment({
  holdToken,
  userName,
  userPhone,
  userEmail,
  price,
  result,
}) {
  const { data, error } = await supabase.rpc("process_mock_payment", {
    p_hold_token: holdToken,
    p_user_name: userName,
    p_user_phone: userPhone,
    p_user_email: userEmail,
    p_price: price,
    p_result: result,
  });

  if (error) {
    console.error("Mock payment failed:", error);
    throw error;
  }

  return data;
}

async function getPaymentById(paymentId) {
  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .select("paymentid, bookingid, method, createdat")
    .eq("paymentid", paymentId)
    .maybeSingle();

  if (paymentError) throw paymentError;
  if (!payment) return null;

  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select(
      "bookingid, username, userphone, useremail, price, status"
    )
    .eq("bookingid", payment.bookingid)
    .single();

  if (bookingError) throw bookingError;

  const { data: showtimeSeats, error: seatsError } = await supabase
    .from("showtime_seats")
    .select("showtimeid, seatid")
    .eq("bookingid", booking.bookingid)
    .eq("status", "booked");

  if (seatsError) throw seatsError;

  if (!showtimeSeats || showtimeSeats.length === 0) {
    return {
      paymentId: payment.paymentid,
      userName: booking.username,
      userEmail: booking.useremail,
      method: payment.method,
      createdAt: payment.createdat,
      price: booking.price,
      seats: [],
      eventId: null,
      startAt: null,
      endAt: null,
    };
  }

  const showtimeId = showtimeSeats[0].showtimeid;
  const seatIds = showtimeSeats.map((item) => item.seatid);
  const [
    { data: seats, error: seatDetailsError },
    { data: showtime, error: showtimeError },
  ] = await Promise.all([
    supabase
      .from("seats")
      .select("seatid, rowlabel, seatnumber, seattype")
      .in("seatid", seatIds),

    supabase
      .from("showtimes")
      .select("showtimeid, eventid, startat, endat")
      .eq("showtimeid", showtimeId)
      .single(),
  ]);

  if (seatDetailsError) throw seatDetailsError;
  if (showtimeError) throw showtimeError;

  if (showtimeSeats.some((item) => item.showtimeid !== showtimeId)) {
    throw new Error("Booking contains seats from multiple showtimes");
  }

  return {
    paymentId: payment.paymentid,
    userName: booking.username,
    userEmail: booking.useremail,
    method: payment.method,
    createdAt: payment.createdat,
    seats: seats.map((seat) => ({
      seatId: seat.seatid,
      rowLabel: seat.rowlabel,
      seatNumber: seat.seatnumber,
      seatType: seat.seattype,
    })),
    price: booking.price,
    eventId: showtime.eventid,
    startAt: showtime.startat,
    endAt: showtime.endat,
  };
}

module.exports = {
  processMockPayment,
  getPaymentById,
};
