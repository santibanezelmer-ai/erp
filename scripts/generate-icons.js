const fs = require('fs');
const zlib = require('zlib');

function createPng(width, height) {
  // Color RGBA
  const buffer = Buffer.alloc(width * height * 4 + height);
  let pos = 0;

  for (let y = 0; y < height; y++) {
    buffer[pos++] = 0; // Filter type 0: None
    for (let x = 0; x < width; x++) {
      // Background gradient #0f172a -> #1e293b
      const distFromCenter = Math.sqrt(
        Math.pow(x - width / 2, 2) + Math.pow(y - height / 2, 2)
      );
      const radius = width * 0.38;
      const innerRadius = width * 0.22;

      if (distFromCenter <= radius && distFromCenter >= innerRadius) {
        // Modern Cyan/Emerald Ring
        buffer[pos++] = 16;  // R
        buffer[pos++] = 185; // G
        buffer[pos++] = 129; // B
        buffer[pos++] = 255; // Alpha
      } else if (distFromCenter < innerRadius && distFromCenter > innerRadius * 0.4) {
        // Inner Dot (Indigo)
        buffer[pos++] = 99;  // R
        buffer[pos++] = 102; // G
        buffer[pos++] = 241; // B
        buffer[pos++] = 255;
      } else {
        // Background dark #0f172a
        buffer[pos++] = 15;
        buffer[pos++] = 23;
        buffer[pos++] = 42;
        buffer[pos++] = 255;
      }
    }
  }

  const idatData = zlib.deflateSync(buffer);

  function crc32(buf) {
    let crc = 0 ^ -1;
    for (let i = 0; i < buf.length; i++) {
      crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
    }
    return (crc ^ -1) >>> 0;
  }

  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c;
  }

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type);
    const body = Buffer.concat([typeBuf, data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body), 0);
    return Buffer.concat([len, body, crc]);
  }

  const header = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type: RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace

  const ihdr = makeChunk('IHDR', ihdrData);
  const idat = makeChunk('IDAT', idatData);
  const iend = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([header, ihdr, idat, iend]);
}

fs.writeFileSync('public/icon-192.png', createPng(192, 192));
fs.writeFileSync('public/icon-512.png', createPng(512, 512));
console.log('Iconos PWA creados exitosamente en public/');
