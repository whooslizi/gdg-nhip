const adminService = require("../services/admin.service");

function parseId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function handleError(res, error) {
  console.error("Admin API error:", error);

  if (error.message === "No valid fields to update") {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }

  return res.status(500).json({
    success: false,
    message: "Internal server error",
  });
}

async function createEvent(req, res) {
  try {
    const { eventName, duration } = req.body;

    if (
      typeof eventName !== "string" ||
      !eventName.trim() ||
      !Number.isInteger(duration) ||
      duration <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "eventName and positive duration are required",
      });
    }

    const data = await adminService.createEvent({
      ...req.body,
      eventName: eventName.trim(),
    });

    return res.status(201).json({ success: true, data });
  } catch (error) {
    return handleError(res, error);
  }
}

async function updateEvent(req, res) {
  try {
    const eventId = parseId(req.params.eventId);

    if (!eventId) {
      return res.status(400).json({
        success: false,
        message: "Invalid eventId",
      });
    }

    const data = await adminService.updateEvent(eventId, req.body);

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    return res.status(200).json({ success: true, data });
  } catch (error) {
    return handleError(res, error);
  }
}

async function createShowtime(req, res) {
  try {
    const { eventId, roomId, startAt, endAt } = req.body;

    if (
      !Number.isSafeInteger(eventId) || eventId <= 0 ||
      !Number.isSafeInteger(roomId) || roomId <= 0 ||
      typeof startAt !== "string" ||
      typeof endAt !== "string" ||
      !Number.isFinite(Date.parse(startAt)) ||
      !Number.isFinite(Date.parse(endAt)) ||
      Date.parse(endAt) <= Date.parse(startAt)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid eventId, roomId, or showtime range",
      });
    }

    const data = await adminService.createShowtime(req.body);
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return handleError(res, error);
  }
}

async function updateShowtime(req, res) {
  try {
    const showtimeId = parseId(req.params.showtimeId);

    if (!showtimeId) {
      return res.status(400).json({
        success: false,
        message: "Invalid showtimeId",
      });
    }

    const data = await adminService.updateShowtime(
      showtimeId,
      req.body
    );

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Showtime not found",
      });
    }

    if (
      data.startat &&
      data.endat &&
      Date.parse(data.endat) <= Date.parse(data.startat)
    ) {
      return res.status(400).json({
        success: false,
        message: "endAt must be later than startAt",
      });
    }

    return res.status(200).json({ success: true, data });
  } catch (error) {
    return handleError(res, error);
  }
}

module.exports = {
  createEvent,
  updateEvent,
  createShowtime,
  updateShowtime,
};
