const paymentService = require("../services/payment.service");

function parseBookingId(value) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const reference = String(value).trim().toUpperCase();
  if (/^BK-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(reference)) return reference;
  if (!/^\d+$/.test(reference)) return null;
  const legacyId = Number(reference);
  return Number.isSafeInteger(legacyId) && legacyId > 0 ? reference : null;
}

function sendBookingError(res, error) {
  const message = error.message || "Could not process booking request";
  if (message.includes("Booking not found")) {
    return res.status(404).json({ success: false, message: "Booking not found" });
  }
  if (message.includes("already cancelled")) {
    return res.status(409).json({ success: false, message: "Booking is already cancelled" });
  }
  if (message.includes("Only confirmed bookings")) {
    return res.status(409).json({ success: false, message });
  }
  console.error("Booking API error:", error);
  return res.status(500).json({ success: false, message: "Could not process booking request" });
}

async function getBooking(req, res) {
  const bookingId = parseBookingId(req.params.bookingId);
  const userEmail = req.query.email;
  if (!bookingId || typeof userEmail !== "string" || !userEmail.trim()) {
    return res.status(400).json({
      success: false,
      message: "A valid bookingId and email are required",
    });
  }

  try {
    const booking = await paymentService.getBookingById(bookingId, userEmail);
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }
    return res.status(200).json({ success: true, data: booking });
  } catch (error) {
    return sendBookingError(res, error);
  }
}

async function lookupBooking(req, res) {
  const bookingId = parseBookingId(req.body?.bookingId);
  const userEmail = req.body?.email;
  if (!bookingId || typeof userEmail !== "string" || !userEmail.trim()) {
    return res.status(400).json({
      success: false,
      message: "A valid bookingId and email are required",
    });
  }

  try {
    const booking = await paymentService.getBookingById(bookingId, userEmail);
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }
    return res.status(200).json({ success: true, data: booking });
  } catch (error) {
    return sendBookingError(res, error);
  }
}

async function cancelBooking(req, res) {
  const bookingId = parseBookingId(req.params.bookingId);
  const userEmail = req.body?.email;
  if (!bookingId || typeof userEmail !== "string" || !userEmail.trim()) {
    return res.status(400).json({
      success: false,
      message: "A valid bookingId and email are required",
    });
  }

  try {
    await paymentService.cancelBooking(bookingId, userEmail.trim());
    const booking = await paymentService.getBookingById(bookingId, userEmail);
    return res.status(200).json({ success: true, data: booking });
  } catch (error) {
    return sendBookingError(res, error);
  }
}

module.exports = { getBooking, lookupBooking, cancelBooking };
