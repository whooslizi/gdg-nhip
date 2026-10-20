
const eventService = require("../services/event.service");

async function getAllEvents(req, res) {
  try {
    const events = await eventService.getAllEvents();

    return res.status(200).json({
      success: true,
      data: events,
    });
  } catch (error) {
    console.error("Get events error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve events",
    });
  }
}

async function getEventById(req, res) {
  try {
    const { eventId } = req.params;

    const event = await eventService.getEventById(eventId);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: event,
    });
  } catch (error) {
    console.error("Get event error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve event",
    });
  }
}

async function getEventShowtimes(req, res) {
  try {
    const { eventId } = req.params;

    const showtimes =
      await eventService.getEventShowtimes(eventId);

    return res.status(200).json({
      success: true,
      data: {
        eventId,
        showtimes,
      },
    });
  } catch (error) {
    console.error("Get event showtimes error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve showtimes",
    });
  }
}

module.exports = {
  getAllEvents,
  getEventById,
  getEventShowtimes
};
