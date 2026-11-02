const crypto = require("node:crypto");

const PREFIX = "NHIP1";
const CONTEXT = "nhip-ticket|1|";
const CODE = /^BK-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/;
const POSITIVE_INT = /^[1-9]\d{0,15}$/;
const SIG = /^[A-Za-z0-9_-]{43}$/;

function usableKey(value) {
  return typeof value === "string" && Buffer.byteLength(value) >= 32 ? value : null;
}

function mac(key, code, showtimeId, version) {
  return crypto
    .createHmac("sha256", key)
    .update(`${CONTEXT}${code}|${showtimeId}|${version}`)
    .digest("base64url");
}

function createTicketTokenService(getKeys = () => ({
  current: process.env.QR_SIGNING_SECRET,
  previous: process.env.QR_SIGNING_SECRET_PREVIOUS,
})) {
  function sign({ code, showtimeId, version }) {
    const key = usableKey(getKeys().current);
    if (!key) return null; // caller treats as "not configured"
    if (!CODE.test(code) || !POSITIVE_INT.test(String(showtimeId)) || !POSITIVE_INT.test(String(version))) {
      throw new Error("Invalid ticket fields");
    }
    return [PREFIX, code, showtimeId, version, mac(key, code, showtimeId, version)].join(".");
  }

  function verify(token) {
    if (typeof token !== "string" || token.length > 128) return null;
    const parts = token.trim().split(".");
    if (parts.length !== 5) return null;
    const [prefix, code, showtimeId, version, sig] = parts;
    if (prefix !== PREFIX || !CODE.test(code) || !POSITIVE_INT.test(showtimeId) ||
        !POSITIVE_INT.test(version) || !SIG.test(sig)) {
      return null;
    }
    const given = Buffer.from(sig, "base64url");
    const keys = [getKeys().current, getKeys().previous].map(usableKey).filter(Boolean);
    for (const key of keys) {
      const expected = Buffer.from(mac(key, code, showtimeId, version), "base64url");
      if (expected.length === given.length && crypto.timingSafeEqual(expected, given)) {
        return { code, showtimeId: Number(showtimeId), version: Number(version) };
      }
    }
    return null;
  }

  return { sign, verify, configured: () => Boolean(usableKey(getKeys().current)) };
}

module.exports = { createTicketTokenService };
