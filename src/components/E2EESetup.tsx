'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  generateUserKey, 
  storeUserKey, 
  getUserKey, 
  hasUserKey,
  encryptKeyWithPassword,
  type UserKeyPair 
} from '@/lib/client-encryption'

interface E2EESetupProps {
  onComplete: () => void
}

interface PasswordStrength {
  score: number
  feedback: string[]
  hasMinLength: boolean
  hasUppercase: boolean
  hasLowercase: boolean
  hasNumber: boolean
  hasSpecialChar: boolean
}

export default function E2EESetup({ onComplete }: E2EESetupProps) {
  const [isSettingUp, setIsSettingUp] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [showPasswordStrength, setShowPasswordStrength] = useState(false)
  const [passwordsMatch, setPasswordsMatch] = useState<boolean | null>(null)
  const router = useRouter()

  useEffect(() => {
    // Check if user already has a key
    if (hasUserKey()) {
      onComplete()
    }
  }, [onComplete])

  // Check password strength
  const checkPasswordStrength = (pwd: string): PasswordStrength => {
    const hasMinLength = pwd.length >= 8
    const hasUppercase = /[A-Z]/.test(pwd)
    const hasLowercase = /[a-z]/.test(pwd)
    const hasNumber = /\d/.test(pwd)
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(pwd)
    
    const criteria = [hasMinLength, hasUppercase, hasLowercase, hasNumber, hasSpecialChar]
    const score = criteria.filter(Boolean).length
    
    const feedback = []
    if (!hasMinLength) feedback.push('At least 8 characters')
    if (!hasUppercase) feedback.push('One uppercase letter')
    if (!hasLowercase) feedback.push('One lowercase letter')
    if (!hasNumber) feedback.push('One number')
    if (!hasSpecialChar) feedback.push('One special character (!@#$%^&*)')
    
    return {
      score,
      feedback,
      hasMinLength,
      hasUppercase,
      hasLowercase,
      hasNumber,
      hasSpecialChar
    }
  }


  const passwordStrength = checkPasswordStrength(password)
  
  // Update password match status
  useEffect(() => {
    if (confirmPassword === '') {
      setPasswordsMatch(null)
    } else if (password === confirmPassword) {
      setPasswordsMatch(true)
    } else {
      setPasswordsMatch(false)
    }
  }, [password, confirmPassword])

  // Show password strength when user starts typing
  useEffect(() => {
    setShowPasswordStrength(password.length > 0)
  }, [password])

  const handleSetupEncryption = async () => {
    if (!password) {
      setError('Please enter a password.')
      return
    }

    const strength = checkPasswordStrength(password)
    if (strength.score < 3) {
      setError('Please use a stronger password. Your password should include uppercase letters, lowercase letters, numbers, and special characters.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    try {
      setIsSettingUp(true)
      setError(null)
      
      // Generate a new encryption key
      const keyPair = await generateUserKey()
      
      // Encrypt the key with the user's password
      const encryptedKey = await encryptKeyWithPassword(keyPair.encryptionKey, password)
      
      // Store encrypted key on server
      const response = await fetch('/api/user/store-encrypted-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encryptedKey })
      })

      if (!response.ok) {
        throw new Error('Failed to store encrypted key')
      }

      // Store unencrypted key locally for this session
      storeUserKey(keyPair)
      onComplete()
    } catch (err) {
      setError('Failed to set up encryption. Please try again.')
      console.error('Encryption setup failed:', err)
    } finally {
      setIsSettingUp(false)
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-8 py-16">
      <div className="max-w-2xl w-full space-y-12">
        <div className="text-center space-y-6">
          <h1 className="text-4xl font-bold text-black tracking-tight">
            Set Up Your Encryption Password
          </h1>
          <p className="text-xl text-gray-700 leading-relaxed">
            Ad Studium uses end-to-end encryption so that even our developers cannot see your data. 
            Create a password to secure your encryption key. If you lose this password, 
            your data will be lost forever.
          </p>
        </div>

        <div className="bg-gray-100 border border-gray-200 p-8 space-y-6">
          <h2 className="text-2xl font-bold text-black">
            How It Works
          </h2>
          <ul className="space-y-4 text-gray-700 text-lg">
            <li className="flex items-start">
              <span className="text-black mr-3 font-bold">•</span>
              A unique encryption key is generated on your device
            </li>
            <li className="flex items-start">
              <span className="text-black mr-3 font-bold">•</span>
              Your password encrypts this key for secure storage
            </li>
            <li className="flex items-start">
              <span className="text-black mr-3 font-bold">•</span>
              Your data is encrypted on your device before being sent to our servers
            </li>
            <li className="flex items-start">
              <span className="text-black mr-3 font-bold">•</span>
              Only you can decrypt and access your data
            </li>
          </ul>
        </div>

        <div className="bg-red-50 border-2 border-red-500 p-6">
          <div className="flex items-start">
            <div className="flex-shrink-0 mr-4">
              <div className="w-6 h-6 bg-red-500 text-white flex items-center justify-center text-sm font-bold">
                !
              </div>
            </div>
            <div>
              <h3 className="text-lg font-bold text-black mb-2">
                Important Warning
              </h3>
              <p className="text-gray-700 text-lg">
                If you lose this password, your data will be lost forever. 
                We cannot recover your data without your password.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border-2 border-red-500 p-6">
            <div className="flex items-start">
              <div className="flex-shrink-0 mr-4">
                <div className="w-6 h-6 bg-red-500 text-white flex items-center justify-center text-sm font-bold">
                  ×
                </div>
              </div>
              <div>
                <h3 className="text-lg font-bold text-black mb-2">Error</h3>
                <p className="text-gray-700 text-lg">{error}</p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-6">
          <div>
            <label htmlFor="password" className="block text-lg font-bold text-black mb-3">
              Create Encryption Password
            </label>
            <input
              type="password"
              id="password"
              name="new-password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full px-4 py-3 text-lg border-2 border-gray-300 bg-white focus:outline-none focus:border-black transition-colors disabled:bg-gray-100 disabled:text-gray-500"
              disabled={isSettingUp}
            />
            
            {showPasswordStrength && (
              <div className="mt-3 p-4 bg-gray-50 border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-black">Password Strength</span>
                  <span className={`text-sm font-bold ${
                    passwordStrength.score >= 5 ? 'text-green-600' :
                    passwordStrength.score >= 3 ? 'text-yellow-600' :
                    'text-red-500'
                  }`}>
                    {passwordStrength.score >= 5 ? 'Very Strong' :
                     passwordStrength.score >= 3 ? 'Strong' :
                     passwordStrength.score >= 2 ? 'Fair' : 'Weak'}
                  </span>
                </div>
                
                <div className="flex space-x-1 mb-3">
                  {[1, 2, 3, 4, 5].map((level) => (
                    <div
                      key={level}
                      className={`h-2 flex-1 ${
                        level <= passwordStrength.score
                          ? passwordStrength.score >= 5 ? 'bg-green-500' :
                            passwordStrength.score >= 3 ? 'bg-yellow-500' :
                            'bg-red-500'
                          : 'bg-gray-200'
                      }`}
                    />
                  ))}
                </div>
                
                {passwordStrength.feedback.length > 0 && (
                  <div>
                    <p className="text-sm text-gray-700 mb-2">Your password needs:</p>
                    <ul className="text-sm text-gray-600 space-y-1">
                      {passwordStrength.feedback.map((item, index) => (
                        <li key={index} className="flex items-center">
                          <span className="text-gray-400 mr-2">•</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-lg font-bold text-black mb-3">
              Confirm Password
            </label>
            <input
              type="password"
              id="confirmPassword"
              name="confirm-password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              className={`w-full px-4 py-3 text-lg border-2 bg-white focus:outline-none transition-colors disabled:bg-gray-100 disabled:text-gray-500 ${
                passwordsMatch === null ? 'border-gray-300 focus:border-black' :
                passwordsMatch ? 'border-green-500 focus:border-green-500' :
                'border-red-500 focus:border-red-500'
              }`}
              disabled={isSettingUp}
            />
            
            {passwordsMatch !== null && (
              <div className={`mt-2 text-sm flex items-center ${
                passwordsMatch ? 'text-green-600' : 'text-red-500'
              }`}>
                <span className="mr-2">
                  {passwordsMatch ? '✓' : '×'}
                </span>
                {passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
              </div>
            )}
          </div>

          <button
            onClick={handleSetupEncryption}
            disabled={isSettingUp || !password || !confirmPassword || passwordStrength.score < 3 || !passwordsMatch}
            className="w-full bg-black text-white py-4 px-8 text-lg font-bold hover:bg-gray-800 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-black"
          >
            {isSettingUp ? 'Setting Up Encryption...' : 'Set Up Encryption'}
          </button>
        </div>
      </div>
    </div>
  )
}