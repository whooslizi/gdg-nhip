const assert = require("node:assert/strict");
const test = require("node:test");
const { createAdminAuthService } = require("./admin-auth.service");

test("locks a client for ten minutes after three failed logins", () => {
  let now = 1_000;
  const auth = createAdminAuthService(
    () => ({
      username: "admin",
      password: "secret",
      sessionSecret: "test-session-secret-with-more-than-32-characters",
    }),
    () => now,
  );

  assert.equal(auth.login("admin", "wrong", "client-a").status, 401);
  assert.equal(auth.login("wrong", "secret", "client-a").status, 401);
  const locked = auth.login("admin", "wrong", "client-a");
  assert.equal(locked.status, 429);
  assert.equal(locked.retryAfter, 600);
  assert.equal(auth.login("admin", "secret", "client-a").status, 429);

  now += 10 * 60 * 1000;
  const loggedIn = auth.login("admin", "secret", "client-a");
  assert.equal(loggedIn.ok, true);
  assert.equal(auth.verify(loggedIn.token).username, "admin");
});

test("rejects tampered and expired session tokens", () => {
  let now = 1_000;
  const auth = createAdminAuthService(
    () => ({
      username: "admin",
      password: "secret",
      sessionSecret: "test-session-secret-with-more-than-32-characters",
    }),
    () => now,
  );
  const { token } = auth.login("admin", "secret", "client-a");

  assert.equal(auth.verify(`${token}x`), null);
  now += 8 * 60 * 60 * 1000;
  assert.equal(auth.verify(token), null);
});