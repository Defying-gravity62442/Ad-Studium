import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { parseEncryptedData } from '@/lib/encryption'
import { getWeekRange, getMonthRange, getYearRange } from '@/lib/date-utils'
import { createBedrockService, BedrockService } from '@/lib/ai/bedrock'

interface UserData {
  timezone: string | null
  aiAssistantName: string | null
  fieldsOfStudy: string | null
  aiPersonality: string | null
}

interface DailySummaryData {
  date: string
  content: string
}

interface WeeklySummaryData {
  weekStartDate: string
  weekEndDate: string
  content: string
}

interface MonthlySummaryData {
  monthStartDate: string
  monthEndDate: string
  content: string
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { type, date, dailySummaries, weeklySummaries, monthlySummaries, userFieldsOfStudy, userAssistantName, userAssistantPersonality } = await request.json()
    
    if (!type || !['weekly', 'monthly', 'yearly'].includes(type)) {
      return NextResponse.json({ error: 'Invalid summary type' }, { status: 400 })
    }

    if (!date) {
      return NextResponse.json({ error: 'Date is required' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { 
        timezone: true,
        aiAssistantName: true,
        fieldsOfStudy: true,
        aiPersonality: true
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const userTimezone = user.timezone || 'UTC'
    const targetDate = new Date(date)
    const bedrockService = createBedrockService()

    if (type === 'weekly') {
      const result = await generateWeeklySummary(session.user.id, targetDate, userTimezone, bedrockService, user, dailySummaries, userFieldsOfStudy, userAssistantName, userAssistantPersonality)
      return NextResponse.json(result)
    } else if (type === 'monthly') {
      const result = await generateMonthlySummary(session.user.id, targetDate, userTimezone, bedrockService, user, weeklySummaries, userFieldsOfStudy)
      return NextResponse.json(result)
    } else if (type === 'yearly') {
      const result = await generateYearlySummary(session.user.id, targetDate, userTimezone, bedrockService, user, monthlySummaries, userFieldsOfStudy)
      return NextResponse.json(result)
    }

  } catch (error) {
    console.error('Failed to generate hierarchical summary:', error)
    return NextResponse.json(
      { error: 'Failed to generate hierarchical summary' },
      { status: 500 }
    )
  }
}

async function generateWeeklySummary(
  userId: string, 
  targetDate: Date, 
  userTimezone: string, 
  bedrockService: BedrockService,
  user: UserData,
  clientDailySummaries?: DailySummaryData[],
  clientUserFieldsOfStudy?: string,
  clientUserAssistantName?: string,
  clientUserAssistantPersonality?: string
) {
  const { start, end } = getWeekRange(targetDate, userTimezone)

  // Check if weekly summary already exists
  const existingSummary = await prisma.weeklySummary.findFirst({
    where: {
      userId,
      weekStartDate: start,
      weekEndDate: end
    }
  })

  if (existingSummary) {
    return { 
      message: 'Weekly summary already exists',
      summaryId: existingSummary.id,
      alreadyExists: true
    }
  }

  let summaryTexts = ''
  let dailySummariesCount = 0
  let dailySummaryIds: string[] = []

  if (clientDailySummaries && clientDailySummaries.length > 0) {
    // Use decrypted data from client
    dailySummariesCount = clientDailySummaries.length
    summaryTexts = clientDailySummaries.map(summary => {
      const date = new Date(summary.date).toLocaleDateString()
      return `${date}: ${summary.content}`
    }).join('\n\n')
  } else {
    // Fallback to database fetch (this will have the encryption issue)
    const dailySummaries = await prisma.dailySummary.findMany({
      where: {
        journal: {
          userId,
          date: {
            gte: start,
            lte: end
          }
        },
        isHiddenFromAI: false
      },
      include: {
        journal: {
          select: {
            date: true
          }
        }
      },
      orderBy: {
        summaryDate: 'asc'
      }
    })

    if (dailySummaries.length === 0) {
      return { 
        message: 'No daily summaries found for this week',
        count: 0
      }
    }

    dailySummariesCount = dailySummaries.length
    dailySummaryIds = dailySummaries.map(ds => ds.id)

    // This will have the encryption issue - only use as fallback
    summaryTexts = dailySummaries.map(summary => {
      const decryptedContent = parseEncryptedData(summary.content)
      const date = summary.journal.date.toLocaleDateString()
      return `${date}: ${decryptedContent}`
    }).join('\n\n')
  }

  // Generate weekly summary with AI (both objective and encouraging versions)
  const userFieldOfStudy = clientUserFieldsOfStudy || 'an academic field'
  const assistantPersonality = clientUserAssistantPersonality || 'supportive and encouraging'

  const systemPrompt = `You are an AI assistant helping PhD aspirants reflect on their weekly progress. Your task is to create comprehensive weekly summaries that will provide context for future AI interactions and serve as motivational proof of progress.

The user is studying ${userFieldOfStudy}.

Your role is to:
1. Create an objective summary for factual record-keeping and AI context
2. Create an encouraging proof of progress for motivational purposes

Your personality: ${assistantPersonality}

CRITICAL: You must respond with ONLY a valid JSON object. No other text, no explanations, no formatting.

Return ONLY this JSON structure:
{
  "objectiveSummary": "A factual, comprehensive summary including: research activities, academic milestones, skill development, challenges faced and solutions, key insights, progress patterns, and learning outcomes. Use neutral, analytical tone. Focus on concrete activities and outcomes that would be useful for future AI conversations.",
  "encouragingProof": "Motivational content highlighting: concrete achievements, growth evidence, resilience shown, progress toward PhD goals, skills developed, and personal development. Use warm, personal, encouraging tone with 'you' language. Focus on the user's strengths, progress, and potential."
}

ONLY return the JSON object. Nothing else.`

  const userPrompt = `Please analyze this week's daily summaries and create a weekly summary:

${summaryTexts}`

  try {
    const aiResponse = await bedrockService.generateResponse({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      maxTokens: 2000
    })

    // Parse the JSON response to get both versions
    let objectiveSummary = aiResponse
    let encouragingProof = ''
    
    try {
      const parsedResponse = JSON.parse(aiResponse)
      objectiveSummary = parsedResponse.objectiveSummary || aiResponse
      encouragingProof = parsedResponse.encouragingProof || ''
    } catch (parseError) {
      console.warn('Failed to parse AI response as JSON, using as single summary:', parseError)
      
      // Try to extract JSON from the response if it contains JSON
      try {
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const extractedJson = jsonMatch[0]
          const parsedResponse = JSON.parse(extractedJson)
          objectiveSummary = parsedResponse.objectiveSummary || aiResponse
          encouragingProof = parsedResponse.encouragingProof || ''
        } else {
          // If parsing fails, use the response as the objective summary only
          objectiveSummary = aiResponse
        }
      } catch (extractError) {
        console.warn('Failed to extract JSON from response:', extractError)
        // If parsing fails, use the response as the objective summary
        objectiveSummary = aiResponse
      }
    }

    // Create weekly summary with both versions
    const summary = {
      content: objectiveSummary,
      weekStartDate: start.toISOString(),
      weekEndDate: end.toISOString(),
      dailySummaryIds: dailySummaryIds,
      encouragingProof: encouragingProof // Include the encouraging proof
    }

    return {
      message: 'Weekly summary generated successfully',
      summary,
      dailySummariesCount: dailySummariesCount
    }

  } catch (error) {
    console.error('Failed to generate weekly summary with AI:', error)
    return {
      message: 'AI summary generation failed, using fallback',
      summary: {
        content: `Weekly summary for ${start.toLocaleDateString()} - ${end.toLocaleDateString()}: This week included ${dailySummariesCount} days of journaling with various experiences and reflections.`,
        weekStartDate: start.toISOString(),
        weekEndDate: end.toISOString(),
        dailySummaryIds: dailySummaryIds,
        encouragingProof: '' // No encouraging proof for fallback
      },
      dailySummariesCount: dailySummariesCount
    }
  }
}

async function generateMonthlySummary(
  userId: string, 
  targetDate: Date, 
  userTimezone: string, 
  bedrockService: BedrockService,
  user: UserData,
  clientWeeklySummaries?: WeeklySummaryData[],
  clientUserFieldsOfStudy?: string
) {
  const { start, end } = getMonthRange(targetDate, userTimezone)

  // Check if monthly summary already exists
  const existingSummary = await prisma.monthlySummary.findFirst({
    where: {
      userId,
      monthStartDate: start,
      monthEndDate: end
    }
  })

  if (existingSummary) {
    return { 
      message: 'Monthly summary already exists',
      summaryId: existingSummary.id,
      alreadyExists: true
    }
  }

  // Use client-provided weekly summaries if available, otherwise fetch from database
  let summaryTexts = ''
  let weeklySummariesCount = 0
  let weeklySummaryIds: string[] = []

  if (clientWeeklySummaries && clientWeeklySummaries.length > 0) {
    // Use decrypted data from client
    weeklySummariesCount = clientWeeklySummaries.length
    summaryTexts = clientWeeklySummaries.map((summary, index) => {
      const weekStart = new Date(summary.weekStartDate).toLocaleDateString()
      return `Week ${index + 1} (${weekStart}): ${summary.content}`
    }).join('\n\n')
  } else {
    // Fallback to database fetch (this will have the encryption issue)
    const weeklySummaries = await prisma.weeklySummary.findMany({
      where: {
        userId,
        weekStartDate: {
          gte: start,
          lt: end
        }
      },
      orderBy: {
        weekStartDate: 'asc'
      }
    })

    if (weeklySummaries.length === 0) {
      return { 
        message: 'No weekly summaries found for this month',
        count: 0
      }
    }

    weeklySummariesCount = weeklySummaries.length
    weeklySummaryIds = weeklySummaries.map(ws => ws.id)

    // This will have the encryption issue - only use as fallback
    summaryTexts = weeklySummaries.map((summary, index) => {
      const decryptedContent = parseEncryptedData(summary.content)
      const weekStart = summary.weekStartDate.toLocaleDateString()
      return `Week ${index + 1} (${weekStart}): ${decryptedContent}`
    }).join('\n\n')
  }

  // Generate monthly summary with AI (both objective and encouraging versions)
  const userFieldOfStudy = user.fieldsOfStudy ? parseEncryptedData(user.fieldsOfStudy) : (clientUserFieldsOfStudy || 'an academic field')
  const assistantPersonality = user.aiPersonality ? parseEncryptedData(user.aiPersonality) : 'supportive and encouraging'

  const systemPrompt = `You are an AI assistant helping PhD aspirants reflect on their monthly progress. Your task is to create comprehensive monthly summaries that will provide context for future AI interactions and serve as motivational proof of progress.

The user is studying ${userFieldOfStudy}.

Your role is to:
1. Create an objective summary for factual record-keeping and AI context
2. Create an encouraging proof of progress for motivational purposes

Your personality: ${assistantPersonality}

CRITICAL: You must respond with ONLY a valid JSON object. No other text, no explanations, no formatting.

Return ONLY this JSON structure:
{
  "objectiveSummary": "A factual, comprehensive summary including: research activities, academic milestones, skill development, challenges faced and solutions, key insights, progress patterns, and learning outcomes. Use neutral, analytical tone. Focus on concrete activities and outcomes that would be useful for future AI conversations.",
  "encouragingProof": "Motivational content highlighting: concrete achievements, growth evidence, resilience shown, progress toward PhD goals, skills developed, and personal development. Use warm, personal, encouraging tone with 'you' language. Focus on the user's strengths, progress, and potential."
}

ONLY return the JSON object. Nothing else.`

  const userPrompt = `Please create a monthly summary based on these weekly summaries:

${summaryTexts}`

  try {
    const aiResponse = await bedrockService.generateResponse({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      maxTokens: 2500
    })

    // Parse the JSON response to get both versions
    let objectiveSummary = aiResponse
    let encouragingProof = ''
    
    try {
      const parsedResponse = JSON.parse(aiResponse)
      objectiveSummary = parsedResponse.objectiveSummary || aiResponse
      encouragingProof = parsedResponse.encouragingProof || ''
    } catch (parseError) {
      console.warn('Failed to parse AI response as JSON, using as single summary:', parseError)
      
      // Try to extract JSON from the response if it contains JSON
      try {
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const extractedJson = jsonMatch[0]
          const parsedResponse = JSON.parse(extractedJson)
          objectiveSummary = parsedResponse.objectiveSummary || aiResponse
          encouragingProof = parsedResponse.encouragingProof || ''
        } else {
          // If parsing fails, use the response as the objective summary only
          objectiveSummary = aiResponse
        }
      } catch (extractError) {
        console.warn('Failed to extract JSON from response:', extractError)
        // If parsing fails, use the response as the objective summary
        objectiveSummary = aiResponse
      }
    }

    // Create monthly summary with both versions
    const summary = {
      content: objectiveSummary,
      monthStartDate: start.toISOString(),
      monthEndDate: end.toISOString(),
      weeklySummaryIds: weeklySummaryIds,
      encouragingProof: encouragingProof // Include the encouraging proof
    }

    return {
      message: 'Monthly summary generated successfully',
      summary,
      weeklySummariesCount: weeklySummariesCount
    }

  } catch (error) {
    console.error('Failed to generate monthly summary with AI:', error)
    return {
      message: 'AI summary generation failed, using fallback',
      summary: {
        content: `Monthly summary for ${start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}: This month included ${weeklySummariesCount} weeks of progress with various achievements and challenges.`,
        monthStartDate: start.toISOString(),
        monthEndDate: end.toISOString(),
        weeklySummaryIds: weeklySummaryIds,
        encouragingProof: '' // No encouraging proof for fallback
      },
      weeklySummariesCount: weeklySummariesCount
    }
  }
}

async function generateYearlySummary(
  userId: string, 
  targetDate: Date, 
  userTimezone: string, 
  bedrockService: BedrockService,
  user: UserData,
  clientMonthlySummaries?: MonthlySummaryData[],
  clientUserFieldsOfStudy?: string
) {
  const { start, end } = getYearRange(targetDate, userTimezone)

  // Check if yearly summary already exists
  const existingSummary = await prisma.yearlySummary.findFirst({
    where: {
      userId,
      yearStartDate: start,
      yearEndDate: end
    }
  })

  if (existingSummary) {
    return { 
      message: 'Yearly summary already exists',
      summaryId: existingSummary.id,
      alreadyExists: true
    }
  }

  // Use client-provided monthly summaries if available, otherwise fetch from database
  let summaryTexts = ''
  let monthlySummariesCount = 0
  let monthlySummaryIds: string[] = []

  if (clientMonthlySummaries && clientMonthlySummaries.length > 0) {
    // Use decrypted data from client
    monthlySummariesCount = clientMonthlySummaries.length
    summaryTexts = clientMonthlySummaries.map((summary) => {
      const monthName = new Date(summary.monthStartDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      return `${monthName}: ${summary.content}`
    }).join('\n\n')
  } else {
    // Fallback to database fetch (this will have the encryption issue)
    const monthlySummaries = await prisma.monthlySummary.findMany({
      where: {
        userId,
        monthStartDate: {
          gte: start,
          lt: end
        }
      },
      orderBy: {
        monthStartDate: 'asc'
      }
    })

    if (monthlySummaries.length === 0) {
      return { 
        message: 'No monthly summaries found for this year',
        count: 0
      }
    }

    monthlySummariesCount = monthlySummaries.length
    monthlySummaryIds = monthlySummaries.map(ms => ms.id)

    // This will have the encryption issue - only use as fallback
    summaryTexts = monthlySummaries.map((summary) => {
      const decryptedContent = parseEncryptedData(summary.content)
      const monthName = summary.monthStartDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      return `${monthName}: ${decryptedContent}`
    }).join('\n\n')
  }

  // Generate yearly summary with AI
  const userFieldOfStudy = user.fieldsOfStudy ? parseEncryptedData(user.fieldsOfStudy) : (clientUserFieldsOfStudy || 'an academic field')
  const assistantPersonality = user.aiPersonality ? parseEncryptedData(user.aiPersonality) : 'supportive and encouraging'

  const systemPrompt = `You are an AI assistant helping PhD aspirants reflect on their yearly progress. Your task is to create comprehensive yearly summaries that will provide context for future AI interactions and serve as motivational proof of progress.

The user is studying ${userFieldOfStudy}.

Your role is to:
1. Create an objective summary for factual record-keeping and AI context
2. Create an encouraging proof of progress for motivational purposes

Your personality: ${assistantPersonality}

CRITICAL: You must respond with ONLY a valid JSON object. No other text, no explanations, no formatting.

Return ONLY this JSON structure:
{
  "objectiveSummary": "A factual, comprehensive yearly summary including: major research themes, significant academic milestones, completed projects, major challenges and resolutions, key learning outcomes, skill development patterns, and academic growth trajectory. Use neutral, analytical tone. Focus on concrete activities and outcomes that would be useful for future AI conversations.",
  "encouragingProof": "Motivational content highlighting: major achievements, transformative growth, resilience through challenges, progress toward PhD goals, skills mastered, and personal development journey. Use warm, personal, encouraging tone with 'you' language. Focus on the user's strengths, progress, and potential."
}

ONLY return the JSON object. Nothing else.`

  const userPrompt = `Please create a yearly summary based on these monthly summaries:

${summaryTexts}`

  try {
    const aiResponse = await bedrockService.generateResponse({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      maxTokens: 3000
    })

    // Parse the JSON response to get both versions
    let objectiveSummary = aiResponse
    let encouragingProof = ''
    
    try {
      const parsedResponse = JSON.parse(aiResponse)
      objectiveSummary = parsedResponse.objectiveSummary || aiResponse
      encouragingProof = parsedResponse.encouragingProof || ''
    } catch (parseError) {
      console.warn('Failed to parse AI response as JSON, using as single summary:', parseError)
      
      // Try to extract JSON from the response if it contains JSON
      try {
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const extractedJson = jsonMatch[0]
          const parsedResponse = JSON.parse(extractedJson)
          objectiveSummary = parsedResponse.objectiveSummary || aiResponse
          encouragingProof = parsedResponse.encouragingProof || ''
        } else {
          // If parsing fails, use the response as the objective summary only
          objectiveSummary = aiResponse
        }
      } catch (extractError) {
        console.warn('Failed to extract JSON from response:', extractError)
        // If parsing fails, use the response as the objective summary
        objectiveSummary = aiResponse
      }
    }

    // Create yearly summary with both versions
    const summary = {
      content: objectiveSummary,
      yearStartDate: start.toISOString(),
      yearEndDate: end.toISOString(),
      monthlySummaryIds: monthlySummaryIds,
      encouragingProof: encouragingProof // Include the encouraging proof
    }

    return {
      message: 'Yearly summary generated successfully',
      summary,
      monthlySummariesCount: monthlySummariesCount
    }

  } catch (error) {
    console.error('Failed to generate yearly summary with AI:', error)
    return {
      message: 'AI summary generation failed, using fallback',
      summary: {
        content: `Yearly summary for ${start.getFullYear()}: This year included ${monthlySummariesCount} months of progress with significant growth and development in academic pursuits.`,
        yearStartDate: start.toISOString(),
        yearEndDate: end.toISOString(),
        monthlySummaryIds: monthlySummaryIds,
        encouragingProof: `Despite challenges, you've made significant progress this year with ${monthlySummariesCount} months of dedicated work. Your commitment to your academic journey is commendable.`
      },
      monthlySummariesCount: monthlySummariesCount
    }
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ 
        error: 'Unauthorized',
        details: 'No valid session found. Please log in again.'
      }, { status: 401 })
    }

    // Fetch all hierarchical summaries for the user
    const [weeklySummaries, monthlySummaries, yearlySummaries] = await Promise.all([
      prisma.weeklySummary.findMany({
        where: { userId: session.user.id },
        orderBy: { weekStartDate: 'desc' },
        take: 10
      }),
      prisma.monthlySummary.findMany({
        where: { userId: session.user.id },
        orderBy: { monthStartDate: 'desc' },
        take: 12
      }),
      prisma.yearlySummary.findMany({
        where: { userId: session.user.id },
        orderBy: { yearStartDate: 'desc' },
        take: 5
      })
    ])

    return NextResponse.json({
      weeklySummaries,
      monthlySummaries,
      yearlySummaries
    })

  } catch (error) {
    console.error('Failed to fetch hierarchical summaries:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch hierarchical summaries',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}