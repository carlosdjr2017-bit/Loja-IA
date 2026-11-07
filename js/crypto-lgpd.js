/**
 * ============================================================================
 * MÓDULO DE CRIPTOGRAFIA DE PONTA (WEB CRYPTO API NATIVA) & LGPD
 * ============================================================================
 * Padrões implementados:
 * - Cifragem autenticada: AES-256-GCM (IV aleatório de 96 bits / 12 bytes)
 * - Derivação de chave: PBKDF2-HMAC-SHA256 (150.000 iterações + Salt de 128 bits)
 * - Integridade e Anonimização LGPD: SHA-256 Digest
 * - Sanitização XSS e Minimização de Dados (Art. 6º e Art. 46 da Lei 13.709/2018)
 */

const CryptoEngine = (() => {
  const PBKDF2_ITERATIONS = 150000;
  const SALT_LENGTH = 16; // 128 bits
  const IV_LENGTH = 12;   // 96 bits (Recomendação NIST para AES-GCM)
  const DEVICE_KEY_STORAGE = 'hig_vault_device_secret_v1';

  // Converte ArrayBuffer para Base64
  function bufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  // Converte Base64 para Uint8Array
  function base64ToUint8Array(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  // Converte ArrayBuffer para Hexadecimal
  function bufferToHex(buffer) {
    return Array.from(new Uint8Array(buffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  // Obtém ou gera uma semente criptográfica exclusiva do navegador para cifragem transparente (Zero-Plaintext Storage)
  function getOrCreateDeviceSecret() {
    let secret = localStorage.getItem(DEVICE_KEY_STORAGE);
    if (!secret) {
      const randomBytes = crypto.getRandomValues(new Uint8Array(32));
      secret = bufferToBase64(randomBytes);
      localStorage.setItem(DEVICE_KEY_STORAGE, secret);
    }
    return secret;
  }

  // Deriva uma chave AES-256-GCM a partir de uma senha/segredo e um salt usando PBKDF2-HMAC-SHA256
  async function deriveKey(secret, saltUint8) {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: saltUint8,
        iterations: PBKDF2_ITERATIONS,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Criptografa qualquer objeto/string com AES-256-GCM
   * @param {any} data Dados a serem criptografados
   * @param {string} [customPassphrase] Senha opcional (se omitida, usa a chave segura do dispositivo)
   * @returns {Promise<string>} Payload estruturado em Base64 (v1:salt:iv:ciphertext)
   */
  async function encryptData(data, customPassphrase = null) {
    const secret = customPassphrase || getOrCreateDeviceSecret();
    const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const key = await deriveKey(secret, salt);

    const encoder = new TextEncoder();
    const encodedPayload = encoder.encode(JSON.stringify(data));

    const cipherBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encodedPayload
    );

    return [
      'ENCv1',
      bufferToBase64(salt),
      bufferToBase64(iv),
      bufferToBase64(cipherBuffer)
    ].join(':');
  }

  /**
   * Descriptografa um payload AES-256-GCM
   * @param {string} encryptedPayload String no formato ENCv1:salt:iv:ciphertext
   * @param {string} [customPassphrase] Senha opcional
   * @returns {Promise<any>} Objeto original descriptografado
   */
  async function decryptData(encryptedPayload, customPassphrase = null) {
    if (!encryptedPayload || typeof encryptedPayload !== 'string') return null;
    if (!encryptedPayload.startsWith('ENCv1:')) {
      try {
        return JSON.parse(encryptedPayload);
      } catch {
        return null;
      }
    }

    const parts = encryptedPayload.split(':');
    if (parts.length !== 4) throw new Error('Formato de pacote criptográfico inválido.');

    const secret = customPassphrase || getOrCreateDeviceSecret();
    const salt = base64ToUint8Array(parts[1]);
    const iv = base64ToUint8Array(parts[2]);
    const cipherBytes = base64ToUint8Array(parts[3]);

    const key = await deriveKey(secret, salt);
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      cipherBytes
    );

    const decoder = new TextDecoder();
    return JSON.parse(decoder.decode(decryptedBuffer));
  }

  /**
   * Gera um Hash SHA-256 (Usado para PIN Administrativo, Auditoria LGPD e Checksum de Pedido)
   * @param {string} text Texto de entrada
   * @returns {Promise<string>} Hash hexadecimal de 64 caracteres
   */
  async function sha256(text) {
    const encoder = new TextEncoder();
    const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(text));
    return bufferToHex(buffer);
  }

  /**
   * Gera um protocolo curto verificável para o pedido no WhatsApp e auditoria LGPD
   */
  async function generateOrderProtocol(orderSummary) {
    const raw = `${ JSON.stringify(orderSummary) }|${ Date.now() }|${ crypto.getRandomValues(new Uint32Array(1))[0] }`;
    const fullHash = await sha256(raw);
    return {
      shortCode: fullHash.substring(0, 8).toUpperCase(),
      fullHash
    };
  }

  /**
   * Salva dados criptografados com AES-256-GCM no localStorage
   */
  async function setSecureStorage(key, value) {
    const cipher = await encryptData(value);
    localStorage.setItem(key, cipher);
  }

  /**
   * Lê e descriptografa dados do localStorage
   */
  async function getSecureStorage(key, fallback = null) {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    try {
      const decrypted = await decryptData(raw);
      return decrypted !== null ? decrypted : fallback;
    } catch (err) {
      console.warn(`[CryptoEngine] Falha ao descriptografar chave ${key}:`, err);
      return fallback;
    }
  }

  /**
   * Sanitiza entradas de texto contra XSS antes de renderizar ou enviar
   */
  function sanitizeInput(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/[<>]/g, '')
      .trim();
  }

  return {
    encryptData,
    decryptData,
    sha256,
    generateOrderProtocol,
    setSecureStorage,
    getSecureStorage,
    sanitizeInput
  };
})();

window.CryptoEngine = CryptoEngine;
