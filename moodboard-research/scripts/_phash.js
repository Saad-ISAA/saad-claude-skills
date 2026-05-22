// Perceptual-hash helper (dHash, 64-bit) used by aggregator and individual scrapers.
const sharp = require('sharp');

async function dhash(filePathOrBuffer) {
  try {
    const buf = await sharp(filePathOrBuffer)
      .greyscale()
      .resize(9, 8, { fit: 'fill' })
      .raw()
      .toBuffer();
    let hash = 0n;
    let bit = 0;
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const left = buf[y * 9 + x];
        const right = buf[y * 9 + x + 1];
        if (left < right) hash |= (1n << BigInt(bit));
        bit++;
      }
    }
    return hash.toString(16).padStart(16, '0');
  } catch {
    return null;
  }
}

function hamming(aHex, bHex) {
  let x = BigInt('0x' + aHex) ^ BigInt('0x' + bHex);
  let count = 0;
  while (x) { count += Number(x & 1n); x >>= 1n; }
  return count;
}

module.exports = { dhash, hamming };
