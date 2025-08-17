'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui'
import { Send, MessageCircle } from 'lucide-react'
import { useE2EE } from '@/hooks/useE2EE'
import { EncryptedData } from '@/lib/client-encryption'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface AiCompanionProps {
  journalContent: string
  userPreferredName?: string
  isOpen: boolean
  onClose?: () => void
  onConversationUpdate?: (messages: Message[]) => void
  journalId?: string // New: to link conversation to specific journal entry
}

export function AiCompanion({ 
  journalContent, 
  userPreferredName = "Claude",
  isOpen,
  onClose,
  onConversationUpdate,
  journalId
}: AiCompanionProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingConversation, setIsLoadingConversation] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { isReady, hasKey, userKey, encrypt, decrypt } = useE2EE()

  // Auto-scroll to bottom when messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isLoading])

  // Load existing conversation when component mounts
  useEffect(() => {
    if (isOpen && journalId && messages.length === 0 && isReady && hasKey) {
      console.log('AiCompanion: Loading existing conversation for journalId:', journalId)
      loadExistingConversation()
    }
  }, [isOpen, journalId, messages.length, isReady, hasKey])

  // Reset conversation when modal is closed
  useEffect(() => {
    if (!isOpen) {
      setMessages([])
      setInput('')
      setIsLoading(false)
    }
  }, [isOpen])

  const loadExistingConversation = async () => {
    if (!journalId || !hasKey) {
      console.log('AiCompanion: Cannot load conversation - missing journalId or key')
      return
    }

    console.log('AiCompanion: Starting to load conversation...')
    setIsLoadingConversation(true)
    try {
      const response = await fetch('/api/journal/ai-companion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'load_conversation',
          journalId
        })
      })

      const data = await response.json()
      console.log('AiCompanion: Load conversation response:', data)
      
      if (data.messages) {
        // Decrypt the messages
        const decryptedMessages = await decryptMessages(data.messages)
        console.log('AiCompanion: Decrypted messages:', decryptedMessages)
        setMessages(decryptedMessages)
        onConversationUpdate?.(decryptedMessages)
      } else {
        console.log('AiCompanion: No existing conversation found')
      }
    } catch (error) {
      console.error('AiCompanion: Failed to load existing conversation:', error)
    } finally {
      setIsLoadingConversation(false)
    }
  }

  const decryptMessages = async (encryptedMessages: EncryptedData): Promise<Message[]> => {
    try {
      if (!hasKey || !userKey) {
        throw new Error('No encryption key available')
      }

      console.log('AiCompanion: Decrypting messages with key length:', userKey.length)
      console.log('AiCompanion: Encrypted messages structure:', {
        hasData: !!encryptedMessages.data,
        hasIv: !!encryptedMessages.iv,
        hasSalt: !!encryptedMessages.salt,
        hasTag: !!encryptedMessages.tag,
        dataLength: encryptedMessages.data?.length,
        ivLength: encryptedMessages.iv?.length,
        saltLength: encryptedMessages.salt?.length,
        tagLength: encryptedMessages.tag?.length
      })
      
      const decryptedJson = await decrypt(encryptedMessages)
      const messages = JSON.parse(decryptedJson)
      console.log('AiCompanion: Successfully decrypted messages, count:', messages.length)
      
      // Convert timestamp strings back to Date objects
      return messages.map((message: { id: string; role: 'user' | 'assistant'; content: string; timestamp: string }) => ({
        ...message,
        timestamp: new Date(message.timestamp)
      }))
    } catch (error) {
      console.error('AiCompanion: Failed to decrypt messages:', error)
      console.error('AiCompanion: Encrypted messages that failed:', encryptedMessages)
      return []
    }
  }

  const encryptMessages = async (messages: Message[]): Promise<EncryptedData | null> => {
    try {
      if (!hasKey || !userKey) {
        throw new Error('No encryption key available')
      }

      console.log('AiCompanion: Encrypting messages, count:', messages.length)
      const messagesJson = JSON.stringify(messages)
      const encrypted = await encrypt(messagesJson)
      console.log('AiCompanion: Successfully encrypted messages')
      return encrypted
    } catch (error) {
      console.error('AiCompanion: Failed to encrypt messages:', error)
      return null
    }
  }

  const initializeConversation = async () => {
    setIsLoading(true)

    try {
      const response = await fetch('/api/journal/ai-companion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          journalContent,
          action: 'start_conversation',
          userPreferredName,
          journalId
        })
      })

      const data = await response.json()
      
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.message,
        timestamp: new Date()
      }

      const newMessages = [assistantMessage]
      setMessages(newMessages)
      onConversationUpdate?.(newMessages)

      // Save the conversation
      await saveConversation(newMessages)
    } catch (error) {
      console.error('AiCompanion: Failed to initialize conversation:', error)
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant', 
        content: "I&apos;m having trouble connecting right now. Please try again in a moment.",
        timestamp: new Date()
      }
      setMessages([errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const saveConversation = async (messagesToSave: Message[]) => {
    if (!journalId || !hasKey) return

    try {
      console.log('AiCompanion: Saving conversation with', messagesToSave.length, 'messages')
      const encryptedMessages = await encryptMessages(messagesToSave)
      if (!encryptedMessages) return

      await fetch('/api/journal/ai-companion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_conversation',
          journalId,
          encryptedMessages
        })
      })
      console.log('AiCompanion: Successfully saved conversation')
    } catch (error) {
      console.error('AiCompanion: Failed to save conversation:', error)
    }
  }

  const sendMessage = async () => {
    if (!input.trim()) return

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input,
      timestamp: new Date()
    }

    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/journal/ai-companion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages,
          journalContent,
          action: 'continue_conversation',
          userPreferredName,
          journalId
        })
      })

      const data = await response.json()
      
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.message,
        timestamp: new Date()
      }

      const finalMessages = [...updatedMessages, assistantMessage]
      setMessages(finalMessages)
      onConversationUpdate?.(finalMessages)

      // Save the updated conversation
      await saveConversation(finalMessages)
    } catch (error) {
      console.error('AiCompanion: Failed to send message:', error)
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: "I&apos;m having trouble responding right now. Please try again.",
        timestamp: new Date()
      }
      const finalMessages = [...updatedMessages, errorMessage]
      setMessages(finalMessages)
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const placeholderText = `Share your thoughts with ${userPreferredName}...`

  if (!isOpen) return null

  return (
    <div className="ai-companion-layout">
      <div className="ai-companion-header">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-gray-600" />
          <h3 className="font-medium text-black font-serif">
            {userPreferredName}
          </h3>
        </div>
      </div>

      <div className="ai-companion-content">
        {!journalContent || !journalContent.trim() ? (
          // No journal content - show prompt to start journaling
          <div className="flex-1 flex items-center justify-center w-full">
            <div className="text-center max-w-md w-full px-4">
              <MessageCircle className="w-16 h-16 mx-auto mb-6 text-gray-400" />
              <p className="text-responsive-xl mb-4 text-gray-700 text-elegant font-medium">
                Start your journal entry today
              </p>
              <p className="text-responsive-sm text-gray-600 mb-8 text-elegant leading-relaxed">
                Write about your day, thoughts, or feelings, then {userPreferredName} will be here to help you reflect deeper and explore your insights together.
              </p>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col min-h-0">
            {isLoadingConversation ? (
              <div className="flex-1 flex items-center justify-center w-full">
                <div className="text-center max-w-md w-full px-4">
                  <div className="loading-dots mb-6">
                    <div className="loading-dot"></div>
                    <div className="loading-dot"></div>
                    <div className="loading-dot"></div>
                  </div>
                  <p className="text-responsive-base text-gray-600 font-serif font-medium">Loading conversation...</p>
                </div>
              </div>
            ) : messages.length === 0 ? (
              // Has journal content but no conversation - show start button
              <div className="flex-1 flex items-center justify-center w-full">
                <div className="text-center max-w-md w-full px-4">
                  <MessageCircle className="w-16 h-16 mx-auto mb-6 text-gray-400" />
                  <p className="text-responsive-xl mb-4 text-gray-700 text-elegant font-medium">
                    Ready to reflect deeper?
                  </p>
                  <p className="text-responsive-sm text-gray-600 mb-8 text-elegant leading-relaxed">
                    {userPreferredName} can help you explore your thoughts and feelings about today&apos;s entry.
                  </p>
                  <Button
                    onClick={initializeConversation}
                    disabled={isLoading}
                    className="flex items-center gap-3 text-elegant px-8 py-3 text-responsive-base font-medium shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 mx-auto"
                    size="lg"
                  >
                    <MessageCircle className="w-5 h-5" />
                    {isLoading ? 'Starting conversation...' : `Chat with ${userPreferredName}`}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="ai-companion-messages">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[85%] px-4 py-3 ${
                          message.role === 'user'
                            ? 'chat-bubble-user'
                            : 'chat-bubble-assistant'
                        }`}
                      >
                        <p className="text-responsive-sm leading-relaxed text-elegant">{message.content}</p>
                        <p className="text-xs opacity-60 mt-2 text-elegant">
                          {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="chat-bubble-assistant px-4 py-3">
                        <div className="loading-dots">
                          <div className="loading-dot"></div>
                          <div className="loading-dot"></div>
                          <div className="loading-dot"></div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <div className="ai-companion-input">
                  <div className="flex gap-3">
                    <textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={placeholderText}
                      className="flex-1 resize-none border border-gray-300 rounded-2xl px-4 py-3 text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent text-elegant"
                      rows={2}
                      disabled={isLoading}
                    />
                    <Button 
                      onClick={sendMessage} 
                      disabled={isLoading || !input.trim()}
                      className="flex items-center gap-2 px-6 text-elegant"
                    >
                      <Send className="w-4 h-4" />
                      Send
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2 text-center text-elegant">
                    Press Enter to send, Shift+Enter for new line
                  </p>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}