/**
 * crypto.service.ts
 * Core Web Crypto API utilities for End-to-End Encryption (E2EE).
 */
import forge from 'node-forge';

const CIPHER_ALGO = 'AES-GCM';
const SYMMETRIC_KEY_LENGTH = 256;
const PBKDF2_ITERATIONS = 210000;
const SALT_SIZE = 16;
const IV_SIZE = 12;

// In-memory cache for the family's master vault key.
// Never persistent across full reloads unless explicitly re-derived.
let memoryVaultKey: CryptoKey | null = null;

export function getMemoryVaultKey(): CryptoKey | null {
    return memoryVaultKey;
}

export function setMemoryVaultKey(key: CryptoKey | null) {
    memoryVaultKey = key;
}

/**
 * Derives a strong AES-GCM AES-256 CryptoKey using PBKDF2 from a user-provided 6-digit PIN.
 * @param pin The raw PIN (e.g. "123456")
 * @param salt Uint8Array containing the salt bytes.
 */
export async function deriveKeyFromPIN(pin: string, salt: Uint8Array): Promise<CryptoKey> {
    const enc = new TextEncoder();
    const pinSource = await window.crypto.subtle.importKey(
        'raw',
        enc.encode(pin).buffer as ArrayBuffer,
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
    );

    return window.crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt.buffer as ArrayBuffer,
            iterations: PBKDF2_ITERATIONS,
            hash: 'SHA-256'
        },
        pinSource,
        { name: CIPHER_ALGO, length: SYMMETRIC_KEY_LENGTH },
        false, // The key itself is not exportable for security
        ['encrypt', 'decrypt']
    );
}

/**
 * Generates a completely new, highly enthropic Family Master Vault Key.
 * This key is exportable momentarily just to be encrypted (Escrowed), then it should only
 * be kept in memory as an un-exportable CryptoKey.
 */
export async function generateMasterVaultKey(): Promise<CryptoKey> {
    return window.crypto.subtle.generateKey(
        { name: CIPHER_ALGO, length: SYMMETRIC_KEY_LENGTH },
        true, // True so we can export it to encrypt it with the PIN
        ['encrypt', 'decrypt']
    );
}

/**
 * Helper: Converts ArrayBuffer/Uint8Array to Base64
 */
export function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

/**
 * Helper: Converts Base64 to Uint8Array
 */
export function base64ToBuffer(base64: string): Uint8Array {
    const binary = window.atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

/**
 * Encrypts a string of text using a given CryptoKey (AES-GCM).
 * Returns a Base64 string in format: bas64(IV):base64(Ciphertext+AuthTag)
 */
export async function encryptText(text: string, key: CryptoKey): Promise<string> {
    const enc = new TextEncoder();
    const iv = window.crypto.getRandomValues(new Uint8Array(IV_SIZE));

    const ciphertextBuffer = await window.crypto.subtle.encrypt(
        { name: CIPHER_ALGO, iv: iv.buffer as ArrayBuffer },
        key,
        enc.encode(text).buffer as ArrayBuffer
    );

    return `${bufferToBase64(iv)}:${bufferToBase64(ciphertextBuffer)}`;
}

/**
 * Decrypts a previously encrypted Base64 string payload using the specified CryptoKey.
 * @param payload Payload format: bas64(IV):base64(Ciphertext+AuthTag)
 */
export async function decryptText(payload: string, key: CryptoKey): Promise<string> {
    try {
        const parts = payload.split(':');
        if (parts.length !== 2) throw new Error('Invalid encryption payload format');

        const iv = base64ToBuffer(parts[0]);
        const ciphertext = base64ToBuffer(parts[1]);

        const decryptedBuffer = await window.crypto.subtle.decrypt(
            { name: CIPHER_ALGO, iv: iv.buffer as ArrayBuffer },
            key,
            ciphertext.buffer as ArrayBuffer
        );

        return new TextDecoder().decode(decryptedBuffer);
    } catch (e) {
        console.warn('Decryption failed, returning placeholder', e);
        return '*** DECRYPTION ERROR ***';
    }
}

/**
 * Encrypts a numeric amount. (Amount -> String -> Encrypt)
 */
export async function encryptAmount(amount: number, key: CryptoKey): Promise<string> {
    return encryptText(amount.toString(), key);
}

/**
 * Decrypts an amount back into a number. Returns 0 if decryption fails.
 */
export async function decryptAmount(payload: string, key: CryptoKey): Promise<number> {
    const text = await decryptText(payload, key);
    const num = parseFloat(text);
    if (isNaN(num)) return 0;
    return num;
}

// ==========================================
// RSA ASYMMETRIC ENCRYPTION (FOR KEY EXCHANGE)
// ==========================================

export interface RSAKeyPair {
    publicKey: string; // PEM format
    privateKey: string; // PEM format
}

/**
 * Generates a new RSA Key Pair (2048 bits)
 * Returns the public and private keys in PEM format.
 */
export async function generateRSAKeyPair(): Promise<RSAKeyPair> {
    return new Promise((resolve, reject) => {
        forge.pki.rsa.generateKeyPair({ bits: 2048, workers: -1 }, (err, keypair) => {
            if (err) return reject(err);
            resolve({
                publicKey: forge.pki.publicKeyToPem(keypair.publicKey),
                privateKey: forge.pki.privateKeyToPem(keypair.privateKey)
            });
        });
    });
}

/**
 * Wraps (encrypts) the AES Master Key using the recipient's RSA Public Key.
 * Returns the Base64 encoded encrypted AES key.
 */
export async function wrapMasterKeyWithRSA(masterKey: CryptoKey, publicKeyPem: string): Promise<string> {
    const rawMasterKey = await window.crypto.subtle.exportKey('raw', masterKey);
    const publicKey = forge.pki.publicKeyFromPem(publicKeyPem);

    const bytesToEncrypt = forge.util.createBuffer(new Uint8Array(rawMasterKey)).getBytes();
    const encryptedBytes = publicKey.encrypt(bytesToEncrypt, 'RSA-OAEP');
    return forge.util.encode64(encryptedBytes);
}

/**
 * Unwraps (decrypts) the encrypted AES Master Key using the user's RSA Private Key.
 * Returns the imported unexportable AES CryptoKey.
 */
export async function unwrapMasterKeyWithRSA(encryptedMasterKeyB64: string, privateKeyPem: string): Promise<CryptoKey> {
    const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);
    const encryptedBytes = forge.util.decode64(encryptedMasterKeyB64);

    const decryptedBytes = privateKey.decrypt(encryptedBytes, 'RSA-OAEP');
    const rawMasterKey = new Uint8Array(decryptedBytes.length);
    for (let i = 0; i < rawMasterKey.length; i++) {
        rawMasterKey[i] = decryptedBytes.charCodeAt(i);
    }

    return window.crypto.subtle.importKey(
        'raw',
        rawMasterKey,
        { name: CIPHER_ALGO },
        true, // Must be extractable so it can be re-shared
        ['encrypt', 'decrypt']
    );
}

// ==========================================
// ESCROW MECHANICS (Master Key ↔ PIN)
// ==========================================

export interface EscrowPayload {
    salt: string; // Base64 derived salt for PBKDF2
    encryptedKey: string; // Base64(IV):Base64(Ciphertext) - The Master Key encrypted with the PIN Key
}

/**
 * Encrypts the raw exported Master Vault Key using an AES key derived from the user's PIN.
 * Returns the EscrowPayload (salt + encrypted key data) to save in Firestore.
 */
export async function createEscrowPayload(masterKey: CryptoKey, pin: string): Promise<EscrowPayload> {
    // 1. Export the Master Key
    const rawMasterKey = await window.crypto.subtle.exportKey('raw', masterKey);

    // 2. Generate a fresh salt and derive a Key Encryption Key (KEK) from the PIN
    const salt = window.crypto.getRandomValues(new Uint8Array(SALT_SIZE));
    const kek = await deriveKeyFromPIN(pin, salt);

    // 3. Encrypt the raw Master Key bytes with the KEK
    const iv = window.crypto.getRandomValues(new Uint8Array(IV_SIZE));
    const ciphertext = await window.crypto.subtle.encrypt(
        { name: CIPHER_ALGO, iv: iv.buffer as ArrayBuffer },
        kek,
        rawMasterKey
    );

    return {
        salt: bufferToBase64(salt),
        encryptedKey: `${bufferToBase64(iv)}:${bufferToBase64(ciphertext)}`
    };
}

/**
 * Decrypts the EscrowPayload from Firestore using the user's PIN, returning 
 * the unexportable CryptoKey suitable for memory.
 */
export async function unlockEscrowPayload(payload: EscrowPayload, pin: string): Promise<CryptoKey> {
    // 1. Derive KEK from PIN using the provided salt
    const kek = await deriveKeyFromPIN(pin, base64ToBuffer(payload.salt));

    // 2. Extract IV and ciphertext
    const parts = payload.encryptedKey.split(':');
    if (parts.length !== 2) throw new Error('Invalid escrow encrypted key format');
    const iv = base64ToBuffer(parts[0]);
    const ciphertext = base64ToBuffer(parts[1]);

    // 3. Decrypt the raw Master Key bytes
    const rawMasterKey = await window.crypto.subtle.decrypt(
        { name: CIPHER_ALGO, iv: iv.buffer as ArrayBuffer },
        kek,
        ciphertext.buffer as ArrayBuffer
    );

    // 4. Import it back as an exportable CryptoKey for use (must be exportable to share with others)
    return window.crypto.subtle.importKey(
        'raw',
        rawMasterKey,
        { name: CIPHER_ALGO },
        true, // Must be true so we can export it to share with new family members
        ['encrypt', 'decrypt']
    );
}

// ==========================================
// PERSISTENCE FOR 1-MONTH UNLOCK
// ==========================================

const STORAGE_VAULT_KEY_PREFIX = 'vault_key_';

/**
 * Saves the exported master key to localStorage with a 30-day expiration for the current user.
 */
export async function saveVaultKeyToStorage(key: CryptoKey, userId: string) {
    try {
        const rawMasterKey = await window.crypto.subtle.exportKey('raw', key);
        const base64Key = bufferToBase64(rawMasterKey);
        const expiry = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days
        
        localStorage.setItem(`${STORAGE_VAULT_KEY_PREFIX}${userId}`, JSON.stringify({
            key: base64Key,
            expiry
        }));
    } catch (e) {
        console.error('Failed to save vault key to storage', e);
    }
}

/**
 * Attempts to load the master key from localStorage if it exists and hasn't expired.
 */
export async function loadVaultKeyFromStorage(userId: string): Promise<CryptoKey | null> {
    try {
        const stored = localStorage.getItem(`${STORAGE_VAULT_KEY_PREFIX}${userId}`);
        if (!stored) return null;
        
        const parsed = JSON.parse(stored);
        if (Date.now() > parsed.expiry) {
            clearVaultKeyFromStorage(userId);
            return null;
        }
        
        const rawMasterKey = base64ToBuffer(parsed.key);
        return window.crypto.subtle.importKey(
            'raw',
            rawMasterKey,
            { name: CIPHER_ALGO },
            true, // Must be true so we can export it to share with new family members
            ['encrypt', 'decrypt']
        );
    } catch (e) {
        console.error('Failed to load vault key from storage', e);
        return null;
    }
}

/**
 * Removes the saved master key from localStorage.
 */
export function clearVaultKeyFromStorage(userId: string) {
    localStorage.removeItem(`${STORAGE_VAULT_KEY_PREFIX}${userId}`);
}
