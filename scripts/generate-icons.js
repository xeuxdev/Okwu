import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function createPng(width, height, color = [37, 99, 235, 255]) {
  // Simple PNG encoder using Node's zlib
  const rowSize = width * 4 + 1; // 1 filter byte per row
  const rawData = Buffer.alloc(rowSize * height);

  for (let y = 0; y < height; y++) {
    const rowStart = y * rowSize;
    rawData[rowStart] = 0; // Filter: None

    for (let x = 0; x < width; x++) {
      const pixelStart = rowStart + 1 + x * 4;

      // Draw rounded corner card
      const radius = width * 0.22;
      const dx = Math.max(0, Math.abs(x - width / 2) - (width / 2 - radius));
      const dy = Math.max(0, Math.abs(y - height / 2) - (height / 2 - radius));
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > radius) {
        // Transparent
        rawData[pixelStart] = 0;
        rawData[pixelStart + 1] = 0;
        rawData[pixelStart + 2] = 0;
        rawData[pixelStart + 3] = 0;
      } else {
        // Inner white sparkle/star accent in center
        const cx = width / 2;
        const cy = height / 2;
        const distCenter = Math.hypot(x - cx, y - cy);
        const isSparkle =
          (Math.abs(x - cx) < width * 0.08 && Math.abs(y - cy) < height * 0.35) ||
          (Math.abs(y - cy) < height * 0.08 && Math.abs(x - cx) < width * 0.35) ||
          distCenter < width * 0.14;

        if (isSparkle) {
          rawData[pixelStart] = 255;
          rawData[pixelStart + 1] = 255;
          rawData[pixelStart + 2] = 255;
          rawData[pixelStart + 3] = 255;
        } else {
          rawData[pixelStart] = color[0];
          rawData[pixelStart + 1] = color[1];
          rawData[pixelStart + 2] = color[2];
          rawData[pixelStart + 3] = color[3];
        }
      }
    }
  }

  const compressed = zlib.deflateSync(rawData);

  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth: 8
  ihdr[9] = 6; // Color type: RGBA
  ihdr[10] = 0; // Compression: Deflate
  ihdr[11] = 0; // Filter: Standard
  ihdr[12] = 0; // Interlace: None
  const ihdrChunk = createChunk('IHDR', ihdr);

  // IDAT chunk
  const idatChunk = createChunk('IDAT', compressed);

  // IEND chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(4 + 4 + len + 4);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4);
  data.copy(chunk, 8);

  const crc = crc32(chunk.subarray(4, 8 + len));
  chunk.writeInt32BE(crc, 8 + len);
  return chunk;
}

// CRC32 implementation
function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    const byte = buf[i];
    for (let j = 0; j < 8; j++) {
      const bit = (crc ^ (byte >> j)) & 1;
      crc = (crc >>> 1) ^ (bit ? 0xedb88320 : 0);
    }
  }
  return crc ^ -1;
}

const iconsDir = path.resolve('public/icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

[16, 48, 128].forEach((size) => {
  const png = createPng(size, size);
  fs.writeFileSync(path.join(iconsDir, `icon-${size}.png`), png);
  console.log(`Generated icon-${size}.png`);
});
