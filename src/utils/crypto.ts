const ENC_KEY_STORAGE = 'benztech_grok_key_enc_v1';
const PLAIN_KEY_STORAGE = 'maybachtech_grok_key';

export { ENC_KEY_STORAGE, PLAIN_KEY_STORAGE };

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(passphrase), { name: 'PBKDF2' }, false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptApiKey(plain: string, passphrase: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const enc = new TextEncoder();
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plain));
  const payload = {
    v: 1,
    salt: btoa(String.fromCharCode(...salt)),
    iv: btoa(String.fromCharCode(...iv)),
    ct: btoa(String.fromCharCode(...new Uint8Array(ct))),
  };
  return JSON.stringify(payload);
}

export async function decryptApiKey(payloadJson: string, passphrase: string): Promise<string> {
  const p = JSON.parse(payloadJson);
  const salt = Uint8Array.from(atob(p.salt), (c) => c.charCodeAt(0));
  const iv = Uint8Array.from(atob(p.iv), (c) => c.charCodeAt(0));
  const ct = Uint8Array.from(atob(p.ct), (c) => c.charCodeAt(0));
  const key = await deriveKey(passphrase, salt);
  const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  return new TextDecoder().decode(dec);
}

export async function loadEncryptedKey(passphrase?: string): Promise<string> {
  try {
    const enc = localStorage.getItem(ENC_KEY_STORAGE);
    if (enc && passphrase) {
      return await decryptApiKey(enc, passphrase);
    }
    const plain = localStorage.getItem(PLAIN_KEY_STORAGE);
    if (plain && !enc) return plain;
    return '';
  } catch (e) {
    console.warn('Key decrypt failed (bad passphrase?)', e);
    return '';
  }
}

export async function saveEncryptedKey(plain: string, passphrase: string): Promise<void> {
  if (!plain) {
    localStorage.removeItem(ENC_KEY_STORAGE);
    localStorage.removeItem(PLAIN_KEY_STORAGE);
    return;
  }
  const enc = await encryptApiKey(plain, passphrase);
  localStorage.setItem(ENC_KEY_STORAGE, enc);
  localStorage.removeItem(PLAIN_KEY_STORAGE);
}

export function clearStoredKeys(): void {
  localStorage.removeItem(ENC_KEY_STORAGE);
  localStorage.removeItem(PLAIN_KEY_STORAGE);
}

export function hasEncryptedKeyStored(): boolean {
  return !!localStorage.getItem(ENC_KEY_STORAGE);
}