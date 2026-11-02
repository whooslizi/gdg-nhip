const assert = require("node:assert/strict");
const test = require("node:test");
const { createTicketTokenService } = require("./ticket-token.service");

const KEY = "k".repeat(32);
const OTHER = "o".repeat(32);
const ticket = { code: "BK-7KQ2-M9XA", showtimeId: 12, version: 1 };
const service = (keys) => createTicketTokenService(() => keys);

test("sign and verify round-trip", () => {
  const tokens = service({ current: KEY });
  const token = tokens.sign(ticket);
  assert.match(token, /^NHIP1\.BK-7KQ2-M9XA\.12\.1\.[A-Za-z0-9_-]{43}$/);
  assert.deepEqual(tokens.verify(token), ticket);
  assert.equal(tokens.configured(), true);
});

test("changing any single field breaks the signature", () => {
  const tokens = service({ current: KEY });
  const parts = tokens.sign(ticket).split(".");
  const swap = (i, value) => parts.map((p, j) => (j === i ? value : p)).join(".");
  assert.equal(tokens.verify(swap(1, "BK-7KQ2-M9XB")), null);
  assert.equal(tokens.verify(swap(2, "13")), null);
  assert.equal(tokens.verify(swap(3, "2")), null);
  const sig = parts[4];
  const flipped = (sig[0] === "A" ? "B" : "A") + sig.slice(1);
  assert.equal(tokens.verify(swap(4, flipped)), null);
});

test("a token signed with another key fails; the previous key still verifies", () => {
  const old = service({ current: OTHER }).sign(ticket);
  assert.equal(service({ current: KEY }).verify(old), null);
  assert.deepEqual(service({ current: KEY, previous: OTHER }).verify(old), ticket);
});

test("a short or missing key signs nothing", () => {
  assert.equal(service({ current: "short" }).sign(ticket), null);
  assert.equal(service({}).sign(ticket), null);
  assert.equal(service({ current: "short" }).configured(), false);
});

test("malformed input returns null without throwing", () => {
  const tokens = service({ current: KEY });
  const parts = tokens.sign(ticket).split(".");
  for (const bad of [
    parts.slice(0, 4).join("."),
    [...parts, "x"].join("."),
    tokens.sign(ticket).replace("BK-7KQ2-M9XA", "bk-7kq2-m9xa"),
    ["NHIP1", ticket.code, "0", "1", parts[4]].join("."),
    ["NHIP1", ticket.code, "-1", "1", parts[4]].join("."),
    ["NHIP1", ticket.code, "12", "0", parts[4]].join("."),
    "x".repeat(200),
    42,
    null,
    undefined,
  ]) {
    assert.equal(tokens.verify(bad), null);
  }
});

test("sign refuses invalid ticket fields", () => {
  const tokens = service({ current: KEY });
  assert.throws(() => tokens.sign({ ...ticket, code: "nope" }));
  assert.throws(() => tokens.sign({ ...ticket, showtimeId: 0 }));
});
