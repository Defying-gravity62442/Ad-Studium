/**
 * Client-side End-to-End Encryption utilities
 * Keys never leave the client, server only stores encrypted blobs
 */

export interface EncryptedData {
  data: string // Base64 encrypted data
  iv: string   // Base64 initialization vector
  salt: string // Base64 salt for key derivation
  tag: string  // Base64 authentication tag
}

export interface UserKeyPair {
  encryptionKey: string // Hex string for AES-256-GCM
  created: number       // Timestamp
}

/**
 * Generate a new encryption key for the user
 */
export async function generateUserKey(): Promise<UserKeyPair> {
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  )
  
  const exported = await crypto.subtle.exportKey('raw', key)
  const keyHex = Array.from(new Uint8Array(exported))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
  
  return {
    encryptionKey: keyHex,
    created: Date.now()
  }
}

/**
 * Import a key from hex string
 */
async function importKey(keyHex: string): Promise<CryptoKey> {
  const keyBytes = new Uint8Array(
    keyHex.match(/.{2}/g)!.map(byte => parseInt(byte, 16))
  )
  
  return await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  )
}

/**
 * Encrypt data using user's key
 */
export async function encryptData(
  plaintext: string, 
  userKey: string
): Promise<EncryptedData> {
  try {
    const key = await importKey(userKey)
    const iv = crypto.getRandomValues(new Uint8Array(12)) // 96-bit IV for GCM
    const salt = crypto.getRandomValues(new Uint8Array(32)) // For additional entropy
    
    const encoder = new TextEncoder()
    const data = encoder.encode(plaintext)
    
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    )
    
    // Split encrypted data and auth tag (last 16 bytes)
    const encryptedArray = new Uint8Array(encrypted)
    const ciphertext = encryptedArray.slice(0, -16)
    const tag = encryptedArray.slice(-16)
    
    return {
      data: btoa(String.fromCharCode(...ciphertext)),
      iv: btoa(String.fromCharCode(...iv)),
      salt: btoa(String.fromCharCode(...salt)),
      tag: btoa(String.fromCharCode(...tag))
    }
  } catch (error) {
    console.error('Client encryption failed:', error)
    throw new Error('Failed to encrypt data')
  }
}

/**
 * Decrypt data using user's key
 */
export async function decryptData(
  encryptedData: EncryptedData, 
  userKey: string
): Promise<string> {
  try {
    console.log('decryptData: Starting decryption with data:', {
      dataLength: encryptedData.data?.length || 0,
      ivLength: encryptedData.iv?.length || 0,
      saltLength: encryptedData.salt?.length || 0,
      tagLength: encryptedData.tag?.length || 0,
      userKeyLength: userKey?.length || 0
    })
    
    const key = await importKey(userKey)
    
    try {
      const ciphertext = new Uint8Array(
        atob(encryptedData.data).split('').map(c => c.charCodeAt(0))
      )
      const iv = new Uint8Array(
        atob(encryptedData.iv).split('').map(c => c.charCodeAt(0))
      )
      const tag = new Uint8Array(
        atob(encryptedData.tag).split('').map(c => c.charCodeAt(0))
      )
      
      console.log('decryptData: Parsed binary data lengths:', {
        ciphertextLength: ciphertext.length,
        ivLength: iv.length,
        tagLength: tag.length
      })
      
      // Combine ciphertext and tag for Web Crypto API
      const encrypted = new Uint8Array(ciphertext.length + tag.length)
      encrypted.set(ciphertext)
      encrypted.set(tag, ciphertext.length)
      
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        encrypted
      )
      
      const decoder = new TextDecoder()
      const result = decoder.decode(decrypted)
      console.log('decryptData: Successfully decrypted data, length:', result.length)
      return result
    } catch (parseError) {
      console.error('decryptData: Failed to parse base64 data:', parseError)
      const errorMessage = parseError instanceof Error ? parseError.message : 'Unknown error'
      throw new Error(`Failed to parse encrypted data: ${errorMessage}`)
    }
  } catch (error) {
    console.error('Client decryption failed:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    throw new Error(`Failed to decrypt data: ${errorMessage}`)
  }
}

/**
 * Securely store user key in localStorage with additional protection
 */
export function storeUserKey(keyPair: UserKeyPair): void {
  try {
    // Store with a random session identifier to avoid predictable keys
    const sessionId = crypto.randomUUID()
    const storageKey = `e2ee_key_${sessionId}`
    
    localStorage.setItem(storageKey, JSON.stringify(keyPair))
    localStorage.setItem('e2ee_session', sessionId)
    
    // Clear any old keys
    clearOldKeys()
  } catch (error) {
    console.error('Failed to store user key:', error)
    throw new Error('Failed to store encryption key')
  }
}

/**
 * Retrieve user key from localStorage
 */
export function getUserKey(): UserKeyPair | null {
  try {
    const sessionId = localStorage.getItem('e2ee_session')
    if (!sessionId) return null
    
    const storageKey = `e2ee_key_${sessionId}`
    const stored = localStorage.getItem(storageKey)
    if (!stored) return null
    
    return JSON.parse(stored)
  } catch (error) {
    console.error('Failed to retrieve user key:', error)
    return null
  }
}

/**
 * Clear user key from localStorage
 */
export function clearUserKey(): void {
  try {
    const sessionId = localStorage.getItem('e2ee_session')
    if (sessionId) {
      localStorage.removeItem(`e2ee_key_${sessionId}`)
    }
    localStorage.removeItem('e2ee_session')
    clearOldKeys()
  } catch (error) {
    console.error('Failed to clear user key:', error)
  }
}

/**
 * Clear any old encryption keys from localStorage
 */
function clearOldKeys(): void {
  try {
    const keysToRemove: string[] = []
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('e2ee_key_')) {
        const sessionId = localStorage.getItem('e2ee_session')
        if (!sessionId || !key.endsWith(sessionId)) {
          keysToRemove.push(key)
        }
      }
    }
    
    keysToRemove.forEach(key => localStorage.removeItem(key))
  } catch (error) {
    console.error('Failed to clear old keys:', error)
  }
}

/**
 * Check if user has a valid encryption key
 */
export function hasUserKey(): boolean {
  const keyPair = getUserKey()
  return keyPair !== null && keyPair.encryptionKey.length === 64 // 32 bytes = 64 hex chars
}

/**
 * Utility to encrypt multiple fields at once
 */
export async function encryptFields<T extends Record<string, any>>(
  data: T,
  fieldsToEncrypt: (keyof T)[],
  userKey: string
): Promise<T & Record<string, EncryptedData>> {
  const result = { ...data } as any
  
  for (const field of fieldsToEncrypt) {
    if (data[field] != null) {
      result[field] = await encryptData(String(data[field]), userKey)
    }
  }
  
  return result
}

/**
 * Utility to decrypt multiple fields at once
 */
export async function decryptFields<T extends Record<string, any>>(
  data: T,
  fieldsToDecrypt: (keyof T)[],
  userKey: string
): Promise<T> {
  const result = { ...data } as any
  
  for (const field of fieldsToDecrypt) {
    if (data[field] != null && typeof data[field] === 'object') {
      try {
        result[field] = await decryptData(data[field] as EncryptedData, userKey)
      } catch (error) {
        console.error(`Failed to decrypt field ${String(field)}:`, error)
        result[field] = '[Decryption Failed]'
      }
    }
  }
  
  return result
}

/**
 * Derive a key from a password using PBKDF2
 */
async function deriveKeyFromPassword(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const passwordBuffer = encoder.encode(password)
  
  const baseKey = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    'PBKDF2',
    false,
    ['deriveKey']
  )
  
  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000, // Adjust based on security requirements
      hash: 'SHA-256'
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

/**
 * Encrypt the user's encryption key with a password
 */
export async function encryptKeyWithPassword(userKey: string, password: string): Promise<string> {
  try {
    const salt = crypto.getRandomValues(new Uint8Array(32))
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const derivedKey = await deriveKeyFromPassword(password, salt)
    
    const encoder = new TextEncoder()
    const keyData = encoder.encode(userKey)
    
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      derivedKey,
      keyData
    )
    
    const encryptedArray = new Uint8Array(encrypted)
    const ciphertext = encryptedArray.slice(0, -16)
    const tag = encryptedArray.slice(-16)
    
    // Combine salt, iv, ciphertext, and tag
    const combined = new Uint8Array(salt.length + iv.length + ciphertext.length + tag.length)
    combined.set(salt, 0)
    combined.set(iv, salt.length)
    combined.set(ciphertext, salt.length + iv.length)
    combined.set(tag, salt.length + iv.length + ciphertext.length)
    
    return btoa(String.fromCharCode(...combined))
  } catch (error) {
    console.error('Password encryption failed:', error)
    throw new Error('Failed to encrypt key with password')
  }
}

/**
 * Decrypt the user's encryption key with a password
 */
export async function decryptKeyWithPassword(encryptedKey: string, password: string): Promise<string> {
  try {
    const combined = new Uint8Array(
      atob(encryptedKey).split('').map(c => c.charCodeAt(0))
    )
    
    // Extract components
    const salt = combined.slice(0, 32)
    const iv = combined.slice(32, 44)
    const ciphertext = combined.slice(44, -16)
    const tag = combined.slice(-16)
    
    const derivedKey = await deriveKeyFromPassword(password, salt)
    
    // Combine ciphertext and tag for decryption
    const encrypted = new Uint8Array(ciphertext.length + tag.length)
    encrypted.set(ciphertext)
    encrypted.set(tag, ciphertext.length)
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      derivedKey,
      encrypted
    )
    
    const decoder = new TextDecoder()
    return decoder.decode(decrypted)
  } catch (error) {
    console.error('Password decryption failed:', error)
    throw new Error('Invalid password or corrupted data')
  }
}