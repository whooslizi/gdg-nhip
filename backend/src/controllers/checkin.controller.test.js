const assert = require("node:assert/strict");
const test = require("node:test");
const { checkInHandler } = require("./checkin.controller");
const { createTicketTokenService } = require("../services/ticket-token.service");

const tokens = createTicketTokenService(() => ({ current: "k".repeat(32) }));
const ticket = tokens.sign({ code: "BK-7KQ2-M9XA", showtimeId: 12, version: 2 });

async function call(handler, body) {
  const res = {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
  await handler({ body, admin: { username: "door-1" } }, res);
  return res;
}

test("a valid ticket goes to the database with the scanning admin, and its result is returned", async () => {
  for (const result of ["ok", "already_checked_in", "not_confirmed", "revoked", "not_found", "wrong_showtime"]) {
    let args;
    const handler = checkInHandler(tokens, async (...a) => {
      args = a;
      return { result, name: "Ada" };
    });
    const res = await call(handler, { token: ticket, showtimeId: 12 });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.payload.data, { result, name: "Ada" });
    assert.deepEqual(args, ["BK-7KQ2-M9XA", 12, 2, "door-1"]);
  }
});

test("a forged or edited token is 'invalid' and never reaches the database", async () => {
  const handler = checkInHandler(tokens, async () => assert.fail("must not check in"));
  const forged = createTicketTokenService(() => ({ current: "x".repeat(32) })).sign({
    code: "BK-7KQ2-M9XA",
    showtimeId: 12,
    version: 2,
  });
  for (const token of [forged, ticket.replace(".2.", ".3."), "BK-7KQ2-M9XA", ""]) {
    const res = await call(handler, { token, showtimeId: 12 });
    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.data.result, "invalid");
  }
});

test("a ticket for another showtime is reported without touching the database", async () => {
  const handler = checkInHandler(tokens, async () => assert.fail("must not check in"));
  const res = await call(handler, { token: ticket, showtimeId: 13 });
  assert.deepEqual(res.payload.data, { result: "wrong_showtime", bookingCode: "BK-7KQ2-M9XA", showtimeId: 12 });
});

test("malformed bodies are 400; no signing key is 503; database errors are 500", async () => {
  const handler = checkInHandler(tokens, async () => {
    throw new Error("db down");
  });
  for (const body of [undefined, {}, { token: 1, showtimeId: 12 }, { token: ticket, showtimeId: "12" }, { token: "x".repeat(600), showtimeId: 12 }]) {
    assert.equal((await call(handler, body)).statusCode, 400);
  }
  const unconfigured = checkInHandler(createTicketTokenService(() => ({})), async () => ({}));
  assert.equal((await call(unconfigured, { token: ticket, showtimeId: 12 })).statusCode, 503);
  assert.equal((await call(handler, { token: ticket, showtimeId: 12 })).statusCode, 500);
});
