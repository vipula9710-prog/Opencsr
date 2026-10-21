import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";

// Fetches remote files (e.g. images referenced by an imported WordPress export)
// without letting a URL reach internal services (SSRF protection):
//  • only http/https on the default ports;
//  • every resolved address — including after redirects — must be public;
//  • the check runs inside the connection's DNS lookup, so a hostname cannot
//    resolve to a public address for the check and a private one for the
//    connection (DNS rebinding);
//  • bounded size, redirects and time.

export type FetchedFile = { data: Buffer; contentType: string | null; finalUrl: string };
export type RemoteFetcher = (url: string) => Promise<FetchedFile>;

function ipv4ToInt(ip: string) {
  return ip.split(".").reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
}

const V4_BLOCKED: [string, number][] = [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12],
  ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.88.99.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15],
  ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
];

/** True for loopback, private, link-local, CGNAT, documentation, multicast and reserved addresses. */
export function isPrivateAddress(address: string): boolean {
  const ip = address.replace(/^\[|\]$/g, "").split("%")[0]!;
  if (net.isIPv4(ip)) {
    const n = ipv4ToInt(ip);
    return V4_BLOCKED.some(([base, bits]) => (n & (bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0)) >>> 0 === ipv4ToInt(base));
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === "::" || lower === "::1") return true;
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower) ?? /^64:ff9b::(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
    if (mapped) return isPrivateAddress(mapped[1]!);
    if (/^::ffff:[0-9a-f]{1,4}:[0-9a-f]{1,4}$/.test(lower)) {
      const [hi, lo] = lower.slice(7).split(":").map((h) => parseInt(h, 16)) as [number, number];
      return isPrivateAddress(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
    }
    const first = parseInt(lower.split(":")[0] || "0", 16);
    return (first & 0xfe00) === 0xfc00 /* fc00::/7 */ || (first & 0xffc0) === 0xfe80 /* fe80::/10 */ || (first & 0xff00) === 0xff00 /* multicast */ || first === 0x2001 && lower.startsWith("2001:db8");
  }
  return true; // not an IP literal — treat as unsafe
}

function guardedLookup(hostname: string, options: dns.LookupOptions, callback: (err: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family?: number) => void) {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, "");
    const list = addresses as dns.LookupAddress[];
    if (!list.length || list.some((a) => isPrivateAddress(a.address))) {
      return callback(Object.assign(new Error(`Blocked address for ${hostname}`), { code: "EBLOCKED" }), "");
    }
    if (options.all) return callback(null, list);
    callback(null, list[0]!.address, list[0]!.family);
  });
}

function assertAllowedUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Invalid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Only http and https URLs can be fetched");
  if (url.port && url.port !== "80" && url.port !== "443") throw new Error("Only default ports are allowed");
  if (url.username || url.password) throw new Error("URLs with credentials are not allowed");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host) && isPrivateAddress(host)) throw new Error("Private network addresses are not allowed");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) throw new Error("Local host names are not allowed");
  return url;
}

export function createSafeFetcher(opts: { maxBytes: number; timeoutMs?: number; maxRedirects?: number }): RemoteFetcher {
  const timeoutMs = opts.timeoutMs ?? 20_000;
  const maxRedirects = opts.maxRedirects ?? 3;

  const once = (url: URL): Promise<{ status: number; location?: string; data?: Buffer; contentType: string | null }> =>
    new Promise((resolve, reject) => {
      const client = url.protocol === "https:" ? https : http;
      const req = client.get(url, { lookup: guardedLookup as never, timeout: timeoutMs, headers: { "User-Agent": "OpenCSR-Importer/1.0", Accept: "image/*,*/*;q=0.5" } }, (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          return resolve({ status, location: res.headers.location, contentType: null });
        }
        if (status !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${status}`));
        }
        const declared = Number(res.headers["content-length"] ?? 0);
        if (declared > opts.maxBytes) {
          res.destroy();
          return reject(new Error("File is too large"));
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (c: Buffer) => {
          size += c.length;
          if (size > opts.maxBytes) {
            res.destroy();
            reject(new Error("File is too large"));
          } else chunks.push(c);
        });
        res.on("end", () => resolve({ status, data: Buffer.concat(chunks), contentType: (res.headers["content-type"] as string | undefined) ?? null }));
        res.on("error", reject);
      });
      req.on("timeout", () => req.destroy(new Error("Timed out")));
      req.on("error", reject);
    });

  return async (raw) => {
    let url = assertAllowedUrl(raw);
    for (let i = 0; i <= maxRedirects; i++) {
      const r = await once(url);
      if (r.location) {
        url = assertAllowedUrl(new URL(r.location, url).toString());
        continue;
      }
      return { data: r.data!, contentType: r.contentType, finalUrl: url.toString() };
    }
    throw new Error("Too many redirects");
  };
}
