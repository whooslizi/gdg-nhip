const adminService = require("../services/admin.service");

function parseId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function isTime(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function invalidEventField(body) {
  if ("eventName" in body && (typeof body.eventName !== "string" || !body.eventName.trim()))
    return "eventName must be a non-empty string";
  if ("duration" in body && (!Number.isInteger(body.duration) || body.duration <= 0))
    return "duration must be a positive integer";
  if ("poster" in body && body.poster !== null && typeof body.poster !== "string")
    return "poster must be a string or null";
  for (const key of ["directors", "actors", "types", "languages"]) {
    if (key in body && (!Array.isArray(body[key]) || !body[key].every((v) => typeof v === "string")))
      return `${key} must be an array of strings`;
  }
  for (const key of ["startAt", "endAt"]) {
    if (key in body && body[key] !== null && !isTime(body[key])) return `${key} must be a date`;
  }
  return null;
}

function handleError(res, error) {
  console.error("Admin API error:", error);

  if (error.code === "23503") {
    return res.status(409).json({
      success: false,
      code: "FACILITY_IN_USE",
      message: "This item is referenced by other records and cannot be deleted",
    });
  }

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

async function deleteFacility(req, res, kind) {
  const id = parseId(req.params[`${kind}Id`]);
  if (!id) {
    return res.status(400).json({
      success: false,
      message: `Invalid ${kind}Id`,
    });
  }

  try {
    const data = await adminService[`delete${kind[0].toUpperCase()}${kind.slice(1)}`](id);
    if (!data) {
      return res.status(404).json({
        success: false,
        message: `${kind} not found`,
      });
    }
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return handleError(res, error);
  }
}

const deleteArea = (req, res) => deleteFacility(req, res, "area");
const deleteCinema = (req, res) => deleteFacility(req, res, "cinema");
const deleteRoom = (req, res) => deleteFacility(req, res, "room");

async function createArea(req, res) {
  const areaName = req.body?.areaName;
  if (typeof areaName !== "string" || !areaName.trim()) {
    return res.status(400).json({
      success: false,
      message: "areaName is required",
    });
  }

  try {
    const data = await adminService.createArea(areaName.trim());
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return handleError(res, error);
  }
}

async function createCinema(req, res) {
  const { cinemaName, areaId, locate } = req.body ?? {};
  if (
    typeof cinemaName !== "string" ||
    !cinemaName.trim() ||
    !parseId(areaId) ||
    typeof locate !== "string" ||
    !locate.trim()
  ) {
    return res.status(400).json({
      success: false,
      message: "cinemaName, valid areaId, and locate are required",
    });
  }

  try {
    const data = await adminService.createCinema({
      cinemaName: cinemaName.trim(),
      areaId: parseId(areaId),
      locate: locate.trim(),
    });
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return handleError(res, error);
  }
}

async function createRoom(req, res) {
  const { roomName, cinemaId } = req.body ?? {};
  if (typeof roomName !== "string" || !roomName.trim() || !parseId(cinemaId)) {
    return res.status(400).json({
      success: false,
      message: "roomName and valid cinemaId are required",
    });
  }

  try {
    const data = await adminService.createRoom({
      roomName: roomName.trim(),
      cinemaId: parseId(cinemaId),
    });
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return handleError(res, error);
  }
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

    const invalid = invalidEventField(req.body);
    if (invalid) {
      return res.status(400).json({ success: false, message: invalid });
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

    const invalid = invalidEventField(req.body ?? {});
    if (invalid) {
      return res.status(400).json({ success: false, message: invalid });
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
      Date.parse(endAt) <= Date.parse(startAt) ||
      (req.body.status !== undefined && typeof req.body.status !== "string")
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

    const body = req.body ?? {};
    if (
      ("startAt" in body && !isTime(body.startAt)) ||
      ("endAt" in body && !isTime(body.endAt)) ||
      ("status" in body && typeof body.status !== "string") ||
      (["eventId", "roomId"].some((key) => key in body && !parseId(body[key])))
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid showtime fields",
      });
    }

    // Check the range against the stored row before writing, not after.
    const current = await adminService.getShowtime(showtimeId);
    if (!current) {
      return res.status(404).json({
        success: false,
        message: "Showtime not found",
      });
    }
    const startAt = body.startAt ?? current.startat;
    const endAt = body.endAt ?? current.endat;
    if (Date.parse(endAt) <= Date.parse(startAt)) {
      return res.status(400).json({
        success: false,
        message: "endAt must be later than startAt",
      });
    }

    const data = await adminService.updateShowtime(showtimeId, body);
    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Showtime not found",
      });
    }

    return res.status(200).json({ success: true, data });
  } catch (error) {
    return handleError(res, error);
  }
}

module.exports = {
  deleteArea,
  deleteCinema,
  deleteRoom,
  createArea,
  createCinema,
  createRoom,
  createEvent,
  updateEvent,
  createShowtime,
  updateShowtime,
};
