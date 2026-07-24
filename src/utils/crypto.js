/**
 * Web Crypto API encryption for sensitive data (API keys, secrets).
 * Uses AES-GCM with a device-derived key for at-rest encryption in localStorage.
 * NOT a substitute for a backend vault — but far better than plaintext localStorage.
 */

const ENC_ALGO = 'AES-GCM';
const KEY_ALGO = { name: 'AES-GCM', length: 256 };
const PBKDF2_ITERATIONS = 100_000;

const SALT_KEY = 'tf-crypto-salt';
const IV_LENGTH = 12;

function getOrCreateSalt() {
  let salt = localStorage.getItem(SALT_KEY);
  if (salt) return Uint8Array.from(atob(salt), c => c.charCodeAt(0));
  const arr = crypto.getRandomValues(new Uint8Array(16));
  localStorage.setItem(SALT_KEY, btoa(String.fromCharCode(...arr)));
  return arr;
}

async function deriveKey(passphrase) {
  const enc = new TextEncoder();
  const salt = getOrCreateSalt();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial, KEY_ALGO, false, ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt a plaintext string. Returns a base64-encoded ciphertext with IV prepended.
 */
export async function encrypt(plaintext, passphrase) {
  if (!plaintext) return '';
  const key = await deriveKey(passphrase);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const enc = new TextEncoder();
  const ct = await crypto.subtle.encrypt({ name: ENC_ALGO, iv }, key, enc.encode(plaintext));
  const combined = new Uint8Array(iv.length + new Uint8Array(ct).length);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ct), iv.length);
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt a base64-encoded ciphertext (with IV prepended).
 */
export async function decrypt(ciphertext, passphrase) {
  if (!ciphertext) return '';
  const key = await deriveKey(passphrase);
  const combined = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
  const iv = combined.slice(0, IV_LENGTH);
  const ct = combined.slice(IV_LENGTH);
  const pt = await crypto.subtle.decrypt({ name: ENC_ALGO, iv }, key, ct);
  return new TextDecoder().decode(pt);
}

const DEVICE_SEED_KEY = 'tf-device-seed';

/**
 * Get or create a cryptographically random per-device seed stored in localStorage.
 * This adds real entropy to the device fingerprint so the passphrase can't be
 * reproduced from browser characteristics alone.
 */
function getOrCreateDeviceSeed() {
  let seed = localStorage.getItem(DEVICE_SEED_KEY);
  if (seed && seed.length >= 64) return seed;
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  seed = Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
  localStorage.setItem(DEVICE_SEED_KEY, seed);
  return seed;
}

/**
 * Generate a device fingerprint from browser characteristics + a random seed.
 * Used as the default encryption passphrase so keys are per-device.
 * The random seed ensures the passphrase can't be guessed from UA/screen alone.
 */
function getDevicePassphrase() {
  const seed = getOrCreateDeviceSeed();
  return 'tradeflow-device-' + seed;
}

/**
 * Encrypt API key payload for localStorage storage.
 * Returns a single encrypted string containing the entire JSON payload.
 */
export async function encryptExchangeKeys(exchangeKeysObj) {
  const passphrase = getDevicePassphrase();
  return encrypt(JSON.stringify(exchangeKeysObj), passphrase);
}

/**
 * Decrypt API key payload from localStorage.
 * Returns the parsed JSON object, or {} on failure.
 */
export async function decryptExchangeKeys(encrypted) {
  if (!encrypted) return {};
  try {
    const passphrase = getDevicePassphrase();
    const json = await decrypt(encrypted, passphrase);
    return JSON.parse(json);
  } catch {
    return {};
  }
}

/**
 * Sanitize a string to prevent XSS when rendering user input.
 */
export function sanitize(str) {
  if (typeof str !== 'string') return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
