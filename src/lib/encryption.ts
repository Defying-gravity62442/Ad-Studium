/**
 * Server-side utilities for handling encrypted data
 * Server cannot decrypt user data - only stores encrypted blobs
 */

import crypto from 'crypto'

const ITERATIONS = 100000

/**
 * Interface for encrypted data (matches client-side format)
 * Server stores this as JSON strings but cannot decrypt
 */
export interface EncryptedData {
  data: string // Base64 encrypted data
  iv: string   // Base64 initialization vector
  salt: string // Base64 salt
  tag: string  // Base64 authentication tag
}

/**
 * Validate that data is properly encrypted
 * Server can verify structure but cannot decrypt content
 */
export function validateEncryptedData(data: any): data is EncryptedData {
  return (
    typeof data === 'object' &&
    typeof data.data === 'string' &&
    typeof data.iv === 'string' &&
    typeof data.salt === 'string' &&
    typeof data.tag === 'string' &&
    data.data.length > 0 &&
    data.iv.length > 0 &&
    data.salt.length > 0 &&
    data.tag.length > 0
  )
}

/**
 * Convert encrypted data to storable string format
 * Server stores encrypted data as JSON strings
 */
export function serializeEncryptedData(data: EncryptedData): string {
  if (!validateEncryptedData(data)) {
    throw new Error('Invalid encrypted data format')
  }
  return JSON.stringify(data)
}

/**
 * Parse stored encrypted data
 * Server can parse but cannot decrypt
 */
export function parseEncryptedData(serialized: string): EncryptedData {
  try {
    const data = JSON.parse(serialized)
    if (!validateEncryptedData(data)) {
      throw new Error('Invalid encrypted data format')
    }
    return data
  } catch (error) {
    throw new Error('Failed to parse encrypted data')
  }
}

/**
 * Safely parse encrypted data with error handling
 * Returns null if parsing fails instead of throwing
 */
export function safeParseEncryptedData(serialized: string | null): EncryptedData | null {
  if (!serialized) return null
  
  try {
    const data = JSON.parse(serialized)
    if (!validateEncryptedData(data)) {
      console.warn('Invalid encrypted data format:', serialized.substring(0, 100))
      return null
    }
    return data
  } catch (error) {
    console.warn('Failed to parse encrypted data:', error, 'Data preview:', serialized.substring(0, 100))
    return null
  }
}

/**
 * Hash passwords for authentication (not related to E2EE)
 * This is for user authentication, not data encryption
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.pbkdf2Sync(password, salt, ITERATIONS, 64, 'sha256').toString('hex')
  return `${salt}:${hash}`
}

/**
 * Verify hashed passwords for authentication
 */
export function verifyPassword(password: string, hashedPassword: string): boolean {
  try {
    const [salt, hash] = hashedPassword.split(':')
    const hashToVerify = crypto.pbkdf2Sync(password, salt, ITERATIONS, 64, 'sha256').toString('hex')
    return hash === hashToVerify
  } catch (error) {
    return false
  }
}

/**
 * Generate secure random tokens (for doc tokens, etc.)
 */
export function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * DEPRECATED: Server-side encryption functions
 * These should not be used - all encryption happens client-side
 */
export function encrypt(text: string): string {
  throw new Error('Server-side encryption is deprecated. Use client-side encryption.')
}
export function decrypt(encryptedData: string): string {
  throw new Error('Server-side decryption is deprecated. Use client-side decryption.')
}
