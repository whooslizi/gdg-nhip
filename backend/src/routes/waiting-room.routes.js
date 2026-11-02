const express = require("express");
const { waitingRoomHandler, leaveHandler, gateHandler } = require("../controllers/waiting-room.controller");
const { requireTurnstile } = require("../middleware/turnstile");
const { waitingRoom, leaveWaitingRoom, passGate } = require("../services/waiting-room.service");

const router = express.Router();

// Joining needs Turnstile so a script can't fill the queue with fake tabs.
router.post("/join", requireTurnstile("queue"), waitingRoomHandler(waitingRoom, true));
router.post("/heartbeat", waitingRoomHandler(waitingRoom, false));
router.post("/leave", leaveHandler(leaveWaitingRoom));
// A second human check right before the seat map opens; holds require a tab that passed it.
router.post("/gate", requireTurnstile("gate"), gateHandler(passGate));

module.exports = router;
