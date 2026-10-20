const showtimeService = require("../services/showtime.service");

async function getShowtimeById(req, res) {
  try {
    const { showtimeId } = req.params;

    const showtime =
      await showtimeService.getShowtimeById(showtimeId);

    if (!showtime) {
      return res.status(404).json({
        success: false,
        message: "Showtime not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: showtime,
    });
  } catch (error) {
    console.error("Get showtime error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve showtime",
    });
  }
}

async function getShowtimeSeats(req, res) {
  try {
    const { showtimeId } = req.params;

    const result = await showtimeService.getShowtimeSeats(showtimeId);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Showtime not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Get showtime seats error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve seats",
    });
  }
}

module.exports = { 
    getShowtimeById,
    getShowtimeSeats
};