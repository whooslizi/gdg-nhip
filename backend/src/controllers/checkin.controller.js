// Door check-in. Business outcomes are always 200 with a `result` field so the scanner can show
// them; only malformed requests and real failures are 4xx/5xx. `tokens` and `checkIn` are
// injected so tests need neither the signing key nor Supabase.
function checkInHandler(tokens, checkIn) {
  return async function checkInTicket(req, res) {
    const { token, showtimeId } = req.body ?? {};
    if (typeof token !== "string" || token.length > 512 || !Number.isInteger(showtimeId) || showtimeId <= 0) {
      return res.status(400).json({
        success: false,
        message: "token must be a string and showtimeId a positive integer",
      });
    }
    if (!tokens.configured()) {
      return res.status(503).json({
        success: false,
        code: "QR_NOT_CONFIGURED",
        message: "Ticket QR codes are not configured on the server",
      });
    }

    const ticket = tokens.verify(token);
    if (!ticket) return res.status(200).json({ success: true, data: { result: "invalid" } });
    // Signed for another showtime: say so without touching the database.
    if (ticket.showtimeId !== showtimeId) {
      return res.status(200).json({
        success: true,
        data: { result: "wrong_showtime", bookingCode: ticket.code, showtimeId: ticket.showtimeId },
      });
    }

    try {
      const data = await checkIn(ticket.code, ticket.showtimeId, ticket.version, req.admin.username);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      console.error("Check-in failed:", error);
      return res.status(500).json({ success: false, message: "Internal server error" });
    }
  };
}

module.exports = { checkInHandler };
