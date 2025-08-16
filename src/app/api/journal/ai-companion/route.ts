import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createBedrockService, BedrockService } from '@/lib/ai/bedrock'
import { gatherAICompanionContext, getUserCustomization, formatUserCustomizationForAI } from '@/lib/context-service'
import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface EncryptedData {
  data: string
  iv: string
  salt: string
  tag: string
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { 
      journalContent, 
      messages, 
      action,
      userPreferredName = 'Claude',
      encryptedMessages, // New: encrypted messages for storage
      journalId, // New: to link conversation to specific journal entry
      contextData, // New: decrypted context from client
      userCustomization // New: decrypted customization from client
    } = await request.json()

    // Handle load_conversation action first (no AI calls needed)
    if (action === 'load_conversation') {
      return await handleLoadConversation(session.user.id, journalId)
    }

    // Handle save_conversation action (no AI calls needed)
    if (action === 'save_conversation') {
      return await handleSaveConversation(session.user.id, journalId, encryptedMessages)
    }

    if (!journalContent || !journalContent.trim()) {
      return NextResponse.json({ error: 'Journal content is required' }, { status: 400 })
    }

    const bedrockService = createBedrockService()
    
    // Use decrypted context data from client, or fallback to server-side gathering
    let formattedContext = ''
    let formattedCustomization = ''
    
    if (contextData && userCustomization) {
      // Use client-provided decrypted data
      formattedContext = formatContextForAICompanion(contextData)
      formattedCustomization = formatUserCustomizationForAI(userCustomization)
    } else {
      // Fallback to server-side gathering (for backward compatibility)
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { timezone: true }
      })
      const userTimezone = user?.timezone || 'UTC'
      
      const [serverContextData, serverUserCustomization] = await Promise.all([
        gatherAICompanionContext(session.user.id, userTimezone),
        getUserCustomization(session.user.id)
      ])
      
      formattedContext = formatContextForAICompanion(serverContextData)
      formattedCustomization = formatUserCustomizationForAI(serverUserCustomization)
    }
    
    if (action === 'start_conversation') {
      return await handleStartConversation(
        bedrockService, 
        journalContent, 
        formattedContext,
        formattedCustomization,
        userPreferredName,
        session.user.id,
        journalId,
        encryptedMessages
      )
    } else if (action === 'continue_conversation') {
      return await handleContinueConversation(
        bedrockService,
        journalContent,
        messages,
        formattedContext,
        formattedCustomization,
        userPreferredName,
        session.user.id,
        journalId,
        encryptedMessages
      )
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Failed to handle AI companion request:', error)
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    )
  }
}

async function handleStartConversation(
  bedrockService: BedrockService, 
  journalContent: string, 
  context: string,
  userCustomization: string,
  userPreferredName: string,
  userId: string,
  journalId: string,
  encryptedMessages?: EncryptedData
) {
  const userPrompt = `You are ${userPreferredName}, a supportive friend helping someone with their PhD journey. You just read their journal entry and want to start a warm, natural conversation about it.

Here's what they wrote today:
${journalContent}

Context about them:
${context}

${userCustomization}

Start a friendly conversation about their journal entry. Be warm, understanding, and ask a thoughtful question to help them reflect deeper. Keep it natural and conversational - like a good friend would respond.`

  try {
    const response = await bedrockService.generateResponse({
      messages: [
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.8,
      maxTokens: 500
    })

    const assistantMessage = {
      id: crypto.randomUUID(),
      role: 'assistant' as const,
      content: response.trim(),
      timestamp: new Date()
    }

    // Save the conversation to database
    if (encryptedMessages) {
      await handleSaveConversation(userId, journalId, encryptedMessages)
    }

    return NextResponse.json({ message: assistantMessage.content })
  } catch (error) {
    console.error('Failed to start conversation:', error)
    
    const fallbackMessage = `I just read your journal entry, and I can sense there's a lot on your mind. Your journey toward your PhD is clearly important to you. What part of today's experience would you like to explore more deeply together?`
    
    return NextResponse.json({ message: fallbackMessage })
  }
}

async function handleContinueConversation(
  bedrockService: BedrockService,
  journalContent: string,
  messages: Message[],
  context: string,
  userCustomization: string,
  userPreferredName: string,
  userId: string,
  journalId: string,
  encryptedMessages?: EncryptedData
) {
  const userPrompt = `You are ${userPreferredName}, a supportive friend helping someone with their PhD journey. You're continuing a conversation about their journal entry.

Original journal entry: ${journalContent}

Context about them:
${context}

${userCustomization}

Continue the conversation naturally. Be warm, understanding, and supportive. Respond like a good friend would.`

  // Convert messages to the format expected by Bedrock
  const conversationMessages = messages.map(msg => ({
    role: msg.role,
    content: msg.content
  }))

  try {
    const response = await bedrockService.generateResponse({
      messages: [
        { role: 'user', content: userPrompt },
        ...conversationMessages
      ],
      temperature: 0.8,
      maxTokens: 600
    })

    const assistantMessage = {
      id: crypto.randomUUID(),
      role: 'assistant' as const,
      content: response.trim(),
      timestamp: new Date()
    }

    // Save the updated conversation to database
    if (encryptedMessages) {
      await handleSaveConversation(userId, journalId, encryptedMessages)
    }

    return NextResponse.json({ message: assistantMessage.content })
  } catch (error) {
    console.error('Failed to continue conversation:', error)
    
    const fallbackMessage = "I appreciate you sharing that with me. Your thoughts and feelings are valid, and I'm here to support you through this journey."
    
    return NextResponse.json({ message: fallbackMessage })
  }
}

async function handleLoadConversation(userId: string, journalId: string) {
  try {
    const journal = await prisma.journal.findFirst({
      where: {
        id: journalId,
        userId: userId
      },
      include: {
        aiConversations: true
      }
    })

    console.log('Found journal:', !!journal, 'has conversation:', !!journal?.aiConversations)

    if (!journal || !journal.aiConversations) {
      return NextResponse.json({ messages: [] })
    }

    const conversation = journal.aiConversations
    
    // Return the encrypted messages - client will decrypt
    return NextResponse.json({ 
      messages: conversation.messages as any
    })
  } catch (error) {
    console.error('Failed to load conversation:', error)
    return NextResponse.json({ messages: [] })
  }
}

async function handleSaveConversation(userId: string, journalId: string, encryptedMessages: EncryptedData) {
  try {
    // Check if conversation already exists
    const existingConversation = await prisma.aiConversation.findFirst({
      where: {
        journalId: journalId
      }
    })

    if (existingConversation) {
      // Update existing conversation
      await prisma.aiConversation.update({
        where: { id: existingConversation.id },
        data: {
          messages: encryptedMessages as unknown as Prisma.InputJsonValue,
          updatedAt: new Date()
        }
      })
    } else {
      // Create new conversation
      await prisma.aiConversation.create({
        data: {
          journalId: journalId,
          messages: encryptedMessages as unknown as Prisma.InputJsonValue
        }
      })
    }
  } catch (error) {
    console.error('Failed to save conversation:', error)
  }
}

function formatContextForAICompanion(contextData: any): string {
  try {
    const {
      weeklyDailySummary = [],
      previousWeeksSummaries = [],
      moodTrends = []
    } = contextData

    const parts = []

    // This Week's Daily Progress
    if (weeklyDailySummary.length > 0) {
      parts.push('### This Week\'s Daily Progress:')
      parts.push(weeklyDailySummary.map((d: any) => `- ${d.summaryDate}: ${d.content} (Mood: ${d.mood || 'N/A'})`).join('\n'))
    } else {
      parts.push('### This Week\'s Daily Progress: No daily summaries available for this week')
    }

    // Previous Weeks Summary
    if (previousWeeksSummaries.length > 0) {
      parts.push('### Previous Weeks Summary:')
      parts.push(previousWeeksSummaries.map((s: any) => `- Week of ${s.weekStartDate}: ${s.content}`).join('\n'))
    } else {
      parts.push('### Previous Weeks Summary: No weekly summaries available')
    }

    // Recent Mood Trends
    if (moodTrends.length > 0) {
      parts.push('### Recent Mood Trends:')
      parts.push(moodTrends.filter((m: any) => m.mood).map((m: any) => `- ${m.date}: ${m.mood}`).join('\n'))
    } else {
      parts.push('### Recent Mood Trends: No mood data available')
    }

    return `## User Context for AI Companion\n\n${parts.join('\n\n')}`
  } catch (error) {
    console.error('Failed to format context for AI companion:', error)
    return 'Context data is currently unavailable.'
  }
}


