const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const servicePath = path.resolve(__dirname, "../services/admin.service.js");
let nextResult;
const deleted = [];
require.cache[servicePath] = {
  id: servicePath,
  filename: servicePath,
  loaded: true,
  exports: {
    deleteEvent: async (eventId) => {
      deleted.push(eventId);
      if (nextResult instanceof Error) throw nextResult;
      return nextResult;
    },
  },
};
const { deleteEvent } = require("./admin.controller");

function response() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

async function remove(eventId, result) {
  nextResult = result;
  const res = response();
  await deleteEvent({ params: { eventId } }, res);
  return res;
}

test("rejects a malformed event id without touching the database", async () => {
  const before = deleted.length;
  for (const id of ["abc", "0", "-1", "1.5"]) {
    assert.equal((await remove(id)).statusCode, 400, id);
  }
  assert.equal(deleted.length, before);
});

test("deletes an event", async () => {
  const res = await remove("7", { result: "deleted", eventId: 7 });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { success: true, data: { result: "deleted", eventId: 7 } });
  assert.equal(deleted.at(-1), 7);
});

test("maps each refusal to its status and code", async () => {
  for (const [result, status, code] of [
    ["not_found", 404, "EVENT_NOT_FOUND"],
    ["locked", 403, "EVENT_LOCKED"],
    ["has_bookings", 409, "EVENT_HAS_BOOKINGS"],
  ]) {
    const res = await remove("3", { result });
    assert.equal(res.statusCode, status, result);
    assert.equal(res.body.code, code);
    assert.equal(res.body.success, false);
  }
});

test("a database error is a generic 500", async () => {
  const res = await remove("3", new Error("boom"));
  assert.equal(res.statusCode, 500);
  assert.equal(res.body.message, "Internal server error");
});
