import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { serializeEncryptedData, parseEncryptedData, validateEncryptedData } from '@/lib/encryption'
import { shouldGenerateDailySummary, getCurrentJournalDate } from '@/lib/date-utils'
import { createBedrockService } from '@/lib/ai/bedrock'

interface DailySummaryResponse {
  context: string
  mood: string[]
  tag: string[]
}

const PREDEFINED_MOODS = [
  'happy', 'sad', 'excited', 'anxious', 'calm', 'frustrated', 'hopeful', 
  'overwhelmed', 'grateful', 'confused', 'motivated', 'tired', 'inspired',
  'worried', 'content', 'stressed', 'peaceful', 'angry', 'nostalgic', 'curious'
]

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's timezone and customization data
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { 
        timezone: true,
        fieldsOfStudy: true,
        aiAssistantName: true,
        aiPersonality: true
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const userTimezone = user.timezone || 'UTC'
    const currentJournalDate = getCurrentJournalDate(userTimezone)

    // Get journal data from request body (sent by client with decrypted content)
    const { journals: clientJournals } = await request.json()
    
    if (!clientJournals || !Array.isArray(clientJournals)) {
      return NextResponse.json({ error: 'No journal data provided' }, { status: 400 })
    }

    const generatedSummaries = []
    const bedrockService = createBedrockService()

    for (const journalData of clientJournals) {
      const journalDateString = journalData.date.split('T')[0]
      
      if (!shouldGenerateDailySummary(journalDateString, userTimezone)) {
        continue // Skip if it's too recent
      }

      try {
        // Use the decrypted content sent from the client
        const contentToSummarize = journalData.content || `Journal entry from ${journalDateString}`
        


        // Generate summary using AI
        const systemPrompt = `You are an AI assistant helping PhD aspirants reflect on their daily journaling. Your task is to create a daily summary that will provide context for future AI interactions.

The user is studying ${user.fieldsOfStudy ? parseEncryptedData(user.fieldsOfStudy) : 'an academic field'}.

CRITICAL: You must respond with ONLY a valid JSON object. No other text, no explanations, no formatting.

Return ONLY this JSON structure:
{
  "context": "A concise summary of the main themes, thoughts, and experiences from this journal entry. Focus on actionable insights and emotional patterns that would be useful for future AI conversations. Keep under 100 words.",
  "mood": ["mood1", "mood2"],
  "tag": ["tag1", "tag2", "tag3"]
}

For mood, choose 2-4 words from this exact list: ${PREDEFINED_MOODS.join(', ')}
For tags, use 3-6 relevant academic/personal development themes like: research, writing, relationships, health, goals, challenges, breakthroughs, etc.

ONLY return the JSON object. Nothing else.`

        const userPrompt = `Please analyze this journal entry and create a daily summary:

${contentToSummarize}`

        const aiResponse = await bedrockService.generateResponse({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.3,
          maxTokens: 1000
        })

        // Parse AI response
        let summaryData: DailySummaryResponse
        try {
          // Clean the response and try to parse JSON
          const cleanedResponse = aiResponse.trim()
          summaryData = JSON.parse(cleanedResponse)
          
          // Validate required fields
          if (!summaryData.context || !summaryData.mood || !summaryData.tag) {
            throw new Error('Missing required fields in AI response')
          }
        } catch (parseError) {
          console.error('Failed to parse AI summary response:', parseError)
          console.error('Raw AI response:', aiResponse)
          
          // Create a fallback summary
          summaryData = {
            context: `Journal entry from ${journalDateString} containing personal reflections and thoughts.`,
            mood: ['content'],
            tag: ['reflection', 'journal']
          }
        }

        // Validate and clean mood data
        const validMoods = summaryData.mood.filter(mood => 
          PREDEFINED_MOODS.includes(mood.toLowerCase())
        ).slice(0, 4)

        // Store summary data temporarily - client will encrypt and store properly
        const tempSummary = {
          context: summaryData.context,
          mood: validMoods.length > 0 ? validMoods.join(',') : null,
          keyTopics: summaryData.tag.slice(0, 6)
        }

        generatedSummaries.push({
          journalId: journalData.journalId,
          date: journalDateString,
          summary: tempSummary
        })

      } catch (error) {
        console.error(`Failed to generate summary for journal ${journalData.journalId}:`, error)
        // Continue with other journals
      }
    }

    return NextResponse.json({ 
      message: `Generated ${generatedSummaries.length} daily summaries`,
      summaries: generatedSummaries
    })

  } catch (error) {
    console.error('Failed to generate daily summaries:', error)
    return NextResponse.json(
      { error: 'Failed to generate daily summaries' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all daily summaries for the user
    const dailySummaries = await prisma.dailySummary.findMany({
      where: {
        journal: {
          userId: session.user.id
        }
      },
      include: {
        journal: {
          select: {
            id: true,
            date: true,
            createdAt: true
          }
        }
      },
      orderBy: { summaryDate: 'desc' }
    })

    // Return encrypted summaries (client will decrypt)
    const summariesWithEncryptedData = dailySummaries.map(summary => ({
      ...summary,
      content: parseEncryptedData(summary.content),
      mood: summary.mood ? parseEncryptedData(summary.mood) : null,
      keyTopics: summary.keyTopics.map(topic => parseEncryptedData(topic))
    }))

    return NextResponse.json({ summaries: summariesWithEncryptedData })
  } catch (error) {
    console.error('Failed to fetch daily summaries:', error)
    return NextResponse.json(
      { error: 'Failed to fetch daily summaries' },
      { status: 500 }
    )
  }
}