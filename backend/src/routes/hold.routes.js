const express = require("express");
const router = express.Router();

const { createHold, cancelHold } = require("../controllers/hold.controller");
const { requireTurnstile } = require("../middleware/turnstile");

router.post("/", requireTurnstile("hold"), createHold);
router.post("/cancel", cancelHold);

module.exports = router;
