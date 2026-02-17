import CryptoJS from 'crypto-js';

export type EncryptedBackupEnvelope = {
  encrypted: true;
  kdf: 'pbkdf2';
  cipher: 'aes';
  iterations: number;
  saltB64: string;
  ivB64: string;
  ciphertextB64: string;
  exportedAt: string;
};

const ITERATIONS = 120_000;

function toB64(wordArray: CryptoJS.lib.WordArray) {
  return CryptoJS.enc.Base64.stringify(wordArray);
}
function fromB64(b64: string) {
  return CryptoJS.enc.Base64.parse(b64);
}

export function isEncryptedEnvelope(x: any): x is EncryptedBackupEnvelope {
  return (
    !!x &&
    x.encrypted === true &&
    x.kdf === 'pbkdf2' &&
    x.cipher === 'aes' &&
    typeof x.ciphertextB64 === 'string' &&
    typeof x.saltB64 === 'string' &&
    typeof x.ivB64 === 'string'
  );
}

export function encryptBackupJson(plainJson: string, passcode: string): EncryptedBackupEnvelope {
  const salt = CryptoJS.lib.WordArray.random(16);
  const iv = CryptoJS.lib.WordArray.random(16);

  const key = CryptoJS.PBKDF2(passcode, salt, {
    keySize: 256 / 32,
    iterations: ITERATIONS,
    hasher: CryptoJS.algo.SHA256,
  });

  const encrypted = CryptoJS.AES.encrypt(plainJson, key, { iv });

  return {
    encrypted: true,
    kdf: 'pbkdf2',
    cipher: 'aes',
    iterations: ITERATIONS,
    saltB64: toB64(salt),
    ivB64: toB64(iv),
    ciphertextB64: CryptoJS.enc.Base64.stringify(encrypted.ciphertext),
    exportedAt: new Date().toISOString(),
  };
}

export function decryptBackupEnvelope(env: EncryptedBackupEnvelope, passcode: string): string {
  const salt = fromB64(env.saltB64);
  const iv = fromB64(env.ivB64);

  const key = CryptoJS.PBKDF2(passcode, salt, {
    keySize: 256 / 32,
    iterations: env.iterations || ITERATIONS,
    hasher: CryptoJS.algo.SHA256,
  });

  const cipherParams = CryptoJS.lib.CipherParams.create({
    ciphertext: CryptoJS.enc.Base64.parse(env.ciphertextB64),
  });

  const decrypted = CryptoJS.AES.decrypt(cipherParams, key, { iv });
  const out = decrypted.toString(CryptoJS.enc.Utf8);

  if (!out) throw new Error('Incorrect passcode or corrupted backup.');
  return out;
}
