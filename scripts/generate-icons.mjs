import sharp from "sharp";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "public/logo.png");
const PUB_ICONS = path.join(ROOT, "public/icons");
const PUB = path.join(ROOT, "public");
const APP = path.join(ROOT, "src/app");

const MASKABLE_BG = { r: 5, g: 12, b: 20, alpha: 1 };

const renderAny = (src, size) =>
  sharp(src)
    .resize(size, size, { fit: "cover", kernel: sharp.kernel.lanczos3 })
    .png({ compressionLevel: 9 })
    .toBuffer();

async function renderMaskable(src, size) {
  const innerSize = Math.round(size * 0.7);
  const inner = await renderAny(src, innerSize);
  return sharp({
    create: { width: size, height: size, channels: 4, background: MASKABLE_BG },
  })
    .composite([{ input: inner, gravity: "center" }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

function buildIco(entries) {
  const n = entries.length;
  const headerSize = 6;
  const dirSize = 16 * n;
  let dataOffset = headerSize + dirSize;
  const dir = Buffer.alloc(headerSize + dirSize);
  dir.writeUInt16LE(0, 0);
  dir.writeUInt16LE(1, 2);
  dir.writeUInt16LE(n, 4);
  entries.forEach(({ buf, size }, i) => {
    const base = headerSize + i * 16;
    dir.writeUInt8(size >= 256 ? 0 : size, base + 0);
    dir.writeUInt8(size >= 256 ? 0 : size, base + 1);
    dir.writeUInt8(0, base + 2);
    dir.writeUInt8(0, base + 3);
    dir.writeUInt16LE(1, base + 4);
    dir.writeUInt16LE(32, base + 6);
    dir.writeUInt32LE(buf.length, base + 8);
    dir.writeUInt32LE(dataOffset, base + 12);
    dataOffset += buf.length;
  });
  return Buffer.concat([dir, ...entries.map((e) => e.buf)]);
}

async function write(file, buf) {
  await fs.writeFile(file, buf);
  const kb = (buf.length / 1024).toFixed(1);
  console.log(`  ${path.relative(ROOT, file).padEnd(48)} ${kb.padStart(6)} KB`);
}

async function main() {
  await fs.mkdir(PUB_ICONS, { recursive: true });

  console.log("PWA (any):");
  for (const s of [192, 512]) {
    await write(path.join(PUB_ICONS, `icon-${s}.png`), await renderAny(SRC, s));
  }

  console.log("PWA (maskable):");
  for (const s of [192, 512]) {
    await write(
      path.join(PUB_ICONS, `icon-maskable-${s}.png`),
      await renderMaskable(SRC, s),
    );
  }

  console.log("iOS apple-touch-icon:");
  for (const s of [120, 152, 167, 180]) {
    const name = s === 180 ? "apple-touch-icon.png" : `apple-touch-icon-${s}.png`;
    await write(path.join(PUB, name), await renderAny(SRC, s));
  }

  console.log("Next.js app/ conventions:");
  await write(path.join(APP, "apple-icon.png"), await renderAny(SRC, 180));
  await write(path.join(APP, "icon.png"), await renderAny(SRC, 512));

  console.log("favicon.ico (16+32+48 multi-res):");
  const icoEntries = await Promise.all(
    [16, 32, 48].map(async (size) => ({ size, buf: await renderAny(SRC, size) })),
  );
  await write(path.join(APP, "favicon.ico"), buildIco(icoEntries));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
