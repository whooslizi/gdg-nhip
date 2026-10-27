const cinemaService = require("../services/cinema.service");

async function getCinemaById(req, res) {
  try {
    const { cinemaId } = req.params;

    const cinema = await cinemaService.getCinemaById(cinemaId);

    if (!cinema) {
      return res.status(404).json({
        success: false,
        message: "Cinema not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: cinema,
    });
  } catch (error) {
    console.error("Get cinema error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve cinema",
    });
  }
}

async function getCinemaRooms(req, res) {
  try {
    const { cinemaId } = req.params;
    const rooms = await cinemaService.getCinemaRooms(cinemaId);

    return res.status(200).json({
      success: true,
      data: {
        cinemaId,
        rooms,
      },
    });
  } catch (error) {
    console.error("Get cinema rooms error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve cinema rooms",
    });
  }
}

module.exports = { 
    getCinemaById,
    getCinemaRooms, 
  };