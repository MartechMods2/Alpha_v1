import https from "node:https";
import dns from "node:dns/promises";
import { isPublicIp } from "./passiveOsint.js";
export async function publicRequest(
  raw,
  {
    maxBytes = 2 * 1024 * 1024,
    method = "GET",
    headers = {},
    body,
    redirects = 2,
  } = {},
) {
  const url = new URL(raw);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443")
  )
    throw Error("Use a public HTTPS URL without credentials or a custom port.");
  let dnsTimer;
  const addresses = await Promise.race([
    dns.lookup(url.hostname, { all: true }),
    new Promise((_, reject) => {
      dnsTimer = setTimeout(() => reject(Error("DNS lookup timed out.")), 5000);
    }),
  ]).finally(() => clearTimeout(dnsTimer));
  if (!addresses.length || addresses.some((x) => !isPublicIp(x.address)))
    throw Error("Private or reserved network destinations are not permitted.");
  const address = addresses.find((x) => x.family === 4) || addresses[0];
  return new Promise((resolve, reject) => {
    const totalTimer = setTimeout(
      () => req.destroy(Error("Service exceeded its time budget.")),
      15000,
    );
    const req = https.request(
      url,
      {
        method,
        headers: { "User-Agent": "Alpha-Community/3.1", ...headers },
        lookup: (_host, opts, cb) =>
          opts?.all
            ? cb(null, [address])
            : cb(null, address.address, address.family),
      },
      (res) => {
        if (
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          res.resume();
          if (!redirects) return reject(Error("Too many redirects."));
          return resolve(
            publicRequest(new URL(res.headers.location, url).href, {
              maxBytes,
              method,
              headers: {},
              redirects: redirects - 1,
            }),
          );
        }
        // HEAD advertises the full resource size but transfers no body.
        if (method !== "HEAD" && Number(res.headers["content-length"] || 0) > maxBytes) {
          res.destroy();
          return reject(Error("Result exceeds the download size limit."));
        }
        const chunks = [];
        let size = 0;
        res.on("data", (chunk) => {
          size += chunk.length;
          if (size > maxBytes) {
            res.destroy();
            reject(Error("Result exceeds the download size limit."));
          } else chunks.push(chunk);
        });
        res.on("error", reject);
        res.on("end", () =>
          resolve({
            status: res.statusCode,
            headers: res.headers,
            buffer: Buffer.concat(chunks),
          }),
        );
      },
    );
    req.once("close", () => clearTimeout(totalTimer));
    req.setTimeout(12000, () => req.destroy(Error("Service timed out.")));
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}
const cache = new Map();
export async function featureJSON(url, options = {}) {
  const key = options.body || options.cache === false ? null : url;
  const hit = key && cache.get(key);
  if (hit?.until > Date.now()) return hit.value;
  const res = await publicRequest(url, options);
  if (res.status < 200 || res.status >= 300)
    throw Error(
      res.status === 429
        ? "Service rate limit reached. Try again later."
        : "The lookup service is currently unavailable.",
    );
  const value = JSON.parse(res.buffer.toString("utf8"));
  if (key) {
    while (cache.size >= 100) cache.delete(cache.keys().next().value);
    cache.set(key, { until: Date.now() + 300000, value });
  }
  return value;
}
export function publicRepo(value) {
  const match = String(value || "").match(
    /^(?:https:\/\/github\.com\/)?([a-z\d][a-z\d-]{0,38})\/([\w.-]{1,100})\/?$/i,
  );
  if (!match || [".", ".."].includes(match[2]))
    throw Error("Use owner/repository or a public github.com repository URL.");
  return `${match[1]}/${match[2].replace(/\.git$/, "")}`;
}
