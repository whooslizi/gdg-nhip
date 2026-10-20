const express = require("express");
const router = express.Router();

const { createHold, cancelHold } = require("../controllers/hold.controller");

router.post("/", createHold);
router.post("/cancel", cancelHold);

module.exports = router;
