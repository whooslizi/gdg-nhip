const crypto = require("node:crypto");

const MAX_FAILURES = 3;
const LOCKOUT_MS = 10 * 60 * 1000;
const SESSION_MS = 8 * 60 * 60 * 1000;

function secureEqual(left, right) {
  const leftHash = crypto.createHash("sha256").update(String(left)).digest();
  const rightHash = crypto.createHash("sha256").update(String(right)).digest();
  return crypto.timingSafeEqual(leftHash, rightHash);
}

function sign(payload, secret) {
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

function createAdminAuthService(
  getConfig = () => ({
    username: process.env.ADMIN_USERNAME,
    password: process.env.ADMIN_PASSWORD,
    sessionSecret: process.env.ADMIN_SESSION_SECRET,
  }),
  now = () => Date.now(),
) {
  const attemptsByClient = new Map();

  function login(username, password, clientKey) {
    const config = getConfig();
    if (
      !config.username ||
      !config.password ||
      typeof config.sessionSecret !== "string" ||
      config.sessionSecret.length < 32
    ) {
      return { ok: false, status: 503, message: "Admin authentication is not configured" };
    }

    const timestamp = now();
    const attempt = attemptsByClient.get(clientKey);
    if (attempt?.lockedUntil > timestamp) {
      return {
        ok: false,
        status: 429,
        message: "Too many failed login attempts. Try again later.",
        retryAfter: Math.ceil((attempt.lockedUntil - timestamp) / 1000),
      };
    }
    if (attempt?.lockedUntil) attemptsByClient.delete(clientKey);

    const usernameMatches = secureEqual(username ?? "", config.username);
    const passwordMatches = secureEqual(password ?? "", config.password);
    if (!(usernameMatches & passwordMatches)) {
      const failures = (attemptsByClient.get(clientKey)?.failures ?? 0) + 1;
      if (failures >= MAX_FAILURES) {
        const lockedUntil = timestamp + LOCKOUT_MS;
        attemptsByClient.set(clientKey, { failures, lockedUntil });
        return {
          ok: false,
          status: 429,
          message: "Too many failed login attempts. Try again later.",
          retryAfter: Math.ceil(LOCKOUT_MS / 1000),
        };
      }

      attemptsByClient.set(clientKey, { failures, lockedUntil: 0 });
      return {
        ok: false,
        status: 401,
        message: "Invalid username or password",
        attemptsRemaining: MAX_FAILURES - failures,
      };
    }

    attemptsByClient.delete(clientKey);
    const expiresAt = timestamp + SESSION_MS;
    const payload = Buffer.from(
      JSON.stringify({ sub: config.username, exp: expiresAt }),
    ).toString("base64url");
    const token = `${payload}.${sign(payload, config.sessionSecret)}`;
    return { ok: true, token, expiresAt, username: config.username };
  }

  function verify(token) {
    const config = getConfig();
    if (!config.sessionSecret || typeof token !== "string") return null;
    const [payload, signature, extra] = token.split(".");
    if (!payload || !signature || extra) return null;

    const expected = sign(payload, config.sessionSecret);
    if (!secureEqual(signature, expected)) return null;

    try {
      const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
      if (
        session.sub !== config.username ||
        !Number.isSafeInteger(session.exp) ||
        session.exp <= now()
      ) {
        return null;
      }
      return { username: session.sub, expiresAt: session.exp };
    } catch {
      return null;
    }
  }

  return { login, verify };
}

module.exports = { createAdminAuthService };