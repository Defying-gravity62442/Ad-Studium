interface BedrockMessage {
  role: 'user' | 'assistant'
  content: string
}

interface BedrockRequest {
  anthropic_version: string
  max_tokens: number
  messages: BedrockMessage[]
  system?: string
  temperature?: number
}

interface BedrockResponse {
  content: Array<{
    text: string
    type: 'text'
  }>
  id: string
  model: string
  role: 'assistant'
  stop_reason: string
  stop_sequence: null
  type: 'message'
  usage: {
    input_tokens: number
    output_tokens: number
  }
}

interface RoadmapMilestone {
  action: string
  deadline: string
  notes: string
}

interface GeneratedRoadmap {
  message: string
  roadmap_title: string
  milestones: RoadmapMilestone[]
  sources: Array<{
    title: string
    url: string
    type: string
  }>
}

export class BedrockService {
  private bearerToken: string
  private region: string
  private inferenceProfileId: string
  private baseUrl: string

  constructor() {
    this.bearerToken = process.env.AWS_BEARER_TOKEN_BEDROCK || ''
    this.region = process.env.AWS_REGION || 'us-east-1'
    this.inferenceProfileId = process.env.BEDROCK_INFERENCE_PROFILE_ID || ''
    this.baseUrl = `https://bedrock-runtime.${this.region}.amazonaws.com`

    if (!this.bearerToken) {
      throw new Error('AWS_BEARER_TOKEN_BEDROCK environment variable is not set')
    }
    if (!this.inferenceProfileId) {
      throw new Error('BEDROCK_INFERENCE_PROFILE_ID environment variable is not set')
    }
  }

  async generateResponse(params: {
    messages: Array<{ role: 'system' | 'user' | 'assistant', content: string }>
    temperature?: number
    maxTokens?: number
  }): Promise<string> {
    const { messages, temperature = 0.3, maxTokens = 4000 } = params

    const systemMessage = messages.find(m => m.role === 'system')
    const conversationMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      }))

    const requestBody: BedrockRequest = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: maxTokens,
      messages: conversationMessages,
      temperature
    }

    if (systemMessage) {
      requestBody.system = systemMessage.content
    }

    try {

      
      const response = await fetch(`${this.baseUrl}/model/${this.inferenceProfileId}/invoke`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.bearerToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Bedrock API error (${response.status}): ${errorText}`)
      }

      const data: BedrockResponse = await response.json()
      const aiResponse = data.content[0]?.text || ''
      

      
      return aiResponse
    } catch (error) {
      console.error('Bedrock API request failed:', error)
      throw new Error(`Failed to generate response with Bedrock: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async generateRoadmapFromSearch(params: {
    goal: string
    searchResults: string
    currentDepartment?: string
    currentInstitution?: string
    background?: string
    currentDate: string
    toneInstruction?: string
    sourcesText?: string
  }): Promise<GeneratedRoadmap> {
    const {
      searchResults,
      currentDepartment,
      currentInstitution,
      background,
      currentDate,
      toneInstruction = 'Keep the tone encouraging and supportive.',
    } = params

    const systemPrompt = `You help PhD aspirants transform ambitious academic goals into structured, actionable strategies. You are currently assisting a student in ${currentDepartment || 'an unspecified field'} at ${currentInstitution || 'an unspecified institution'}${background ? `\n\nUser Background: ${background}` : ''}

You will receive web search results containing information about academic programs, professors, research papers, application requirements, deadlines, and related academic content from reputable sources.

Your task is to analyze this information and create a comprehensive action plan in JSON format. Use the provided information as your primary source for inference.

Return ONLY a valid JSON object with these exact fields:

- message (string): Clear, concise summary of the user's goal and key requirements ${toneInstruction}
- roadmap_title (string): Short, meaningful title for the roadmap (max 8 words)
- milestones (array of objects): Step-by-step action plan. Each item must contain:
    - action (string): Brief, imperative instruction (12-15 words maximum)
    - deadline (string): Realistic completion date based on ${currentDate} in YYYY-MM-DD format. The deadline must not be in the past.
    - notes (string): Extremely detailed, beginner-friendly instructions. Explain every step clearly, including where to click, what to write, what tools to use, and any terminology that may need clarification.`

    const userPrompt = `Search results: ${searchResults}`

    try {
      const response = await this.generateResponse({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        maxTokens: 4000
      })

      // Extract JSON from markdown code blocks if present
      let jsonResponse = response
      if (response.includes('```json')) {
        const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/)
        if (jsonMatch) {
          jsonResponse = jsonMatch[1].trim()
        }
      } else if (response.includes('```')) {
        // Handle other code blocks
        const codeMatch = response.match(/```\s*([\s\S]*?)\s*```/)
        if (codeMatch) {
          jsonResponse = codeMatch[1].trim()
        }
      }

      const roadmap = JSON.parse(jsonResponse)
      return roadmap
    } catch (error) {
      console.error('Failed to generate roadmap from search results:', error)
      throw new Error(`Failed to generate roadmap: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}

export const createBedrockService = (): BedrockService => {
  return new BedrockService()
}