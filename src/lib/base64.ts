const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Manual base64 decoder — kicks in when Hermes has no global `atob`. */
function manualAtob(input: string): string {
  const clean = input.replace(/[^A-Za-z0-9+/]/g, '');
  let output = '';
  for (let i = 0; i < clean.length; i += 4) {
    const enc1 = CHARS.indexOf(clean[i]);
    const enc2 = CHARS.indexOf(clean[i + 1]);
    const enc3 = CHARS.indexOf(clean[i + 2]);
    const enc4 = CHARS.indexOf(clean[i + 3]);

    const chr1 = (enc1 << 2) | (enc2 >> 4);
    const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    const chr3 = ((enc3 & 3) << 6) | enc4;

    output += String.fromCharCode(chr1);
    if (enc3 !== -1 && clean[i + 2] !== undefined) output += String.fromCharCode(chr2);
    if (enc4 !== -1 && clean[i + 3] !== undefined) output += String.fromCharCode(chr3);
  }
  return output;
}

/** base64 (no data URI prefix) → Uint8Array, for feeding raw bytes to jpeg-js. */
export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = typeof atob === 'function' ? atob(base64) : manualAtob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
