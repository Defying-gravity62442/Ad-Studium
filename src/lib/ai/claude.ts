interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface GenerateResponseOptions {
  messages: Message[]
  temperature?: number
  maxTokens?: number
}

export async function generateResponse({
  messages,
  temperature = 0.7,
  maxTokens = 1000
}: GenerateResponseOptions): Promise<string> {
  try {
    // Use the centralized Bedrock service instead of direct API calls
    const { createBedrockService } = await import('./bedrock')
    const bedrockService = createBedrockService()
    
    return await bedrockService.generateResponse({
      messages,
      temperature,
      maxTokens
    })
  } catch (error) {
    console.error('Failed to generate Claude response:', error)
    throw new Error('Failed to generate AI response')
  }
}

export async function generateJournalPrompts(userContext?: string): Promise<string[]> {
  const systemPrompt = `You are an AI companion for PhD applicants. Generate 3-5 thoughtful journal prompts that encourage reflection on academic goals, personal growth, and mental well-being. Make them specific to the PhD journey but adaptable to different fields.`

  const userPrompt = `Generate journal prompts for today. ${userContext ? `Context about the user: ${userContext}` : ''}`

  try {
    const response = await generateResponse({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    })

    return response.split('\n').filter(line => line.trim().length > 0)
  } catch (error) {
    console.error('Failed to generate journal prompts:', error)
    return [
      'What progress did you make toward your PhD goals today?',
      'What challenges are you facing, and how might you approach them?',
      'What are you grateful for in your academic journey right now?'
    ]
  }
}

export async function summarizeContent(content: string, type: 'daily' | 'weekly' | 'monthly' | 'yearly'): Promise<string> {
  const systemPrompts = {
    daily: 'Summarize this journal entry and conversation in 2-3 sentences, highlighting key themes, mood, and insights.',
    weekly: 'Summarize these daily summaries into a cohesive weekly overview focusing on patterns, progress, and areas for growth.',
    monthly: 'Create a monthly summary from these weekly summaries, identifying major themes, achievements, and development areas.',
    yearly: 'Generate a comprehensive yearly summary from these monthly summaries, showcasing growth, major milestones, and future directions.'
  }

  try {
    return await generateResponse({
      messages: [
        { role: 'system', content: systemPrompts[type] },
        { role: 'user', content: content }
      ],
      maxTokens: type === 'yearly' ? 2000 : 500
    })
  } catch (error) {
    console.error(`Failed to generate ${type} summary:`, error)
    throw error
  }
}