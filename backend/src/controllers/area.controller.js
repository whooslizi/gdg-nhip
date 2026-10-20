const cinemaService = require('../services/area.service');

async function getAllArea(req, res) {
    try {
        const areas = await cinemaService.getAllArea();
        return res.status(200).json({
            success: true,
            data: areas,
        });
    } catch (error) {
        console.error("Get areas error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve areas",
        });
    }
}

async function getAreaCinemas(req, res) {
  try {
    const { areaId } = req.params;

    const cinemas = await cinemaService.getAreaCinemas(areaId);

    return res.status(200).json({
      success: true,
      data: {
        areaId,
        cinemas,
      },
    });
  } catch (error) {
    console.error("Get area cinemas error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve cinemas",
    });
  }
}


module.exports = {
    getAllArea,
    getAreaCinemas
}