import { deflateSync } from "node:zlib";

// Generates simple abstract PNG illustrations (gradients and soft shapes) for
// demo content, so the repository ships no third-party photographs.

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

const hex = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)] as const;

export function placeholderPng(opts: { width?: number; height?: number; from: string; to: string; accent: string; seed: number }) {
  const w = opts.width ?? 960;
  const h = opts.height ?? 540;
  const [r1, g1, b1] = hex(opts.from);
  const [r2, g2, b2] = hex(opts.to);
  const [ra, ga, ba] = hex(opts.accent);
  let s = opts.seed;
  const rand = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const circles = Array.from({ length: 7 }, () => ({ x: rand() * w, y: rand() * h, r: 40 + rand() * 160, a: 0.12 + rand() * 0.25 }));
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const t = (x / w) * 0.6 + (y / h) * 0.4;
      let r = r1 + (r2 - r1) * t;
      let g = g1 + (g2 - g1) * t;
      let b = b1 + (b2 - b1) * t;
      for (const c of circles) {
        const d = Math.hypot(x - c.x, y - c.y);
        if (d < c.r) {
          const k = c.a * (1 - d / c.r);
          r = r + (ra - r) * k;
          g = g + (ga - g) * k;
          b = b + (ba - b) * k;
        }
      }
      const o = y * (w * 3 + 1) + 1 + x * 3;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 6 })), chunk("IEND", Buffer.alloc(0))]);
}
