'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  getUserKey,
  hasUserKey,
  encryptData,
  decryptData,
  encryptFields,
  decryptFields,
  clearUserKey,
  type UserKeyPair,
  type EncryptedData
} from '@/lib/client-encryption'

interface UseE2EEReturn {
  isReady: boolean
  hasKey: boolean
  userKey: string | null
  encrypt: (data: string) => Promise<EncryptedData>
  decrypt: (data: EncryptedData) => Promise<string>
  decryptSafely: (data: EncryptedData | string | null) => Promise<string | null>
  encryptMultiple: <T extends Record<string, any>>(
    data: T, 
    fields: (keyof T)[]
  ) => Promise<T & Record<string, EncryptedData>>
  decryptMultiple: <T extends Record<string, any>>(
    data: T, 
    fields: (keyof T)[]
  ) => Promise<T>
  clearKey: () => void
  error: string | null
}

export function useE2EE(): UseE2EEReturn {
  const [isReady, setIsReady] = useState(false)
  const [hasKeyState, setHasKeyState] = useState(false)
  const [userKey, setUserKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    try {
      const keyExists = hasUserKey()
      setHasKeyState(keyExists)
      
      if (keyExists) {
        const keyPair = getUserKey()
        if (keyPair) {
          setUserKey(keyPair.encryptionKey)
        }
      }
      
      setIsReady(true)
    } catch (err) {
      console.error('useE2EE: Initialization failed:', err)
      setError('Failed to initialize encryption')
      setIsReady(true)
    }
  }, [])

  const encrypt = useCallback(async (data: string): Promise<EncryptedData> => {
    if (!userKey) {
      console.error('useE2EE: No encryption key available for encrypt')
      throw new Error('No encryption key available')
    }
    
    try {
      return await encryptData(data, userKey)
    } catch (err) {
      console.error('useE2EE: Encryption failed:', err)
      setError('Encryption failed')
      throw err
    }
  }, [userKey])

  const decrypt = useCallback(async (data: EncryptedData): Promise<string> => {
    if (!userKey) {
      console.error('useE2EE: No encryption key available for decrypt')
      throw new Error('No encryption key available')
    }
    
    try {
      // Validate the encrypted data structure
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid encrypted data: not an object')
      }
      
      if (!data.data || !data.iv || !data.salt || !data.tag) {
        throw new Error('Invalid encrypted data: missing required fields')
      }
      
      return await decryptData(data, userKey)
    } catch (err) {
      console.error('useE2EE: Decryption failed:', err)
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(`Decryption failed: ${errorMessage}`)
      throw err
    }
  }, [userKey])

  const decryptSafely = useCallback(async (data: EncryptedData | string | null): Promise<string | null> => {
    if (!data) return null
    
    try {
      // If data is already an object, use it directly
      if (typeof data === 'object' && data !== null) {
        return await decrypt(data as EncryptedData)
      }
      
      // If data is a string, try to parse it as JSON
      if (typeof data === 'string') {
        const parsed = JSON.parse(data) as EncryptedData
        return await decrypt(parsed)
      }
      
      throw new Error('Invalid encrypted data format')
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      console.error('useE2EE: Safe decryption failed:', errorMessage)
      return null
    }
  }, [decrypt])

  const encryptMultiple = useCallback(async <T extends Record<string, any>>(
    data: T, 
    fields: (keyof T)[]
  ): Promise<T & Record<string, EncryptedData>> => {
    if (!userKey) {
      throw new Error('No encryption key available')
    }
    
    try {
      return await encryptFields(data, fields, userKey)
    } catch (err) {
      setError('Multi-field encryption failed')
      throw err
    }
  }, [userKey])

  const decryptMultiple = useCallback(async <T extends Record<string, any>>(
    data: T, 
    fields: (keyof T)[]
  ): Promise<T> => {
    if (!userKey) {
      throw new Error('No encryption key available')
    }
    
    try {
      return await decryptFields(data, fields, userKey)
    } catch (err) {
      setError('Multi-field decryption failed')
      throw err
    }
  }, [userKey])

  const clearKey = useCallback(() => {
    try {
      clearUserKey()
      setUserKey(null)
      setHasKeyState(false)
      setError(null)
    } catch (err) {
      setError('Failed to clear encryption key')
      console.error('Failed to clear key:', err)
    }
  }, [])

  return {
    isReady,
    hasKey: hasKeyState,
    userKey,
    encrypt,
    decrypt,
    decryptSafely,
    encryptMultiple,
    decryptMultiple,
    clearKey,
    error
  }
}