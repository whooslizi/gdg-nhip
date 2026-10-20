const {
  holdSeats,
  cancelHold: cancelHoldService,
} = require("../services/hold.service");

async function createHold(req, res) {
  try {
    const { showtimeId, seatIds } = req.body;

    if (
      !Number.isInteger(showtimeId) ||
      showtimeId <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "showtimeId must be a positive integer",
      });
    }

    if (
      !Array.isArray(seatIds) ||
      seatIds.length === 0 ||
      !seatIds.every(
        (id) => Number.isInteger(id) && id > 0
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "seatIds must be a non-empty array of positive integers",
      });
    }

    if (new Set(seatIds).size !== seatIds.length) {
      return res.status(400).json({
        success: false,
        message: "seatIds contains duplicate IDs",
      });
    }

    const result = await holdSeats(showtimeId, seatIds);

    return res.status(201).json({
      success: true,
      message: "Seats held successfully",
      data: result,
    });
  } catch (error) {
    console.error("Create hold failed:", error.message);

    const message = error.message || "";

    if (message.includes("Showtime not found")) {
      return res.status(404).json({
        success: false,
        message: "Showtime not found",
      });
    }

    if (
      message.includes("unavailable")
    ) {
      return res.status(409).json({
        success: false,
        message: "Some seats are unavailable",
      });
    }

    if (
      message.includes("Invalid showtime") ||
      message.includes("Duplicate seat IDs") ||
      message.includes("do not exist for this showtime")
    ) {
      return res.status(400).json({
        success: false,
        message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}

async function cancelHold(req, res) {
  try {
    const { holdToken } = req.body;

    if (typeof holdToken !== "string" || !holdToken.trim()) {
      return res.status(400).json({
        success: false,
        message: "holdToken is required",
      });
    }

    const result = await cancelHoldService(holdToken.trim());

    return res.status(result.success ? 200 : 409).json(result);
  } catch (error) {
    console.error("Cancel hold error:", error);

    return res.status(500).json({
      success: false,
      message: "Could not cancel hold",
    });
  }
}

module.exports = { createHold, cancelHold };
