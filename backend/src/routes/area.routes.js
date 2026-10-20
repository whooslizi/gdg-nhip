const express = require("express");
const cinemaController = require("../controllers/area.controller");

const router = express.Router();

router.get("/", cinemaController.getAllArea);
router.get("/:areaId/cinemas", cinemaController.getAreaCinemas);

module.exports = router;
