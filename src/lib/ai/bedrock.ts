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

interface GoalSanityCheck {
  missingInfo: string[]
  clarifications: string[]
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
    clarifications?: string
    searchResults: string
    currentDepartment?: string
    currentInstitution?: string
    background?: string
    currentDate: string
    toneInstruction?: string
    sourcesText?: string
  }): Promise<GeneratedRoadmap> {
    const {
      goal,
      clarifications,
      searchResults,
      currentDepartment,
      currentInstitution,
      background,
      currentDate,
      toneInstruction = 'Keep the tone encouraging and supportive.',
    } = params

    const systemPrompt = `You help future PhD students transform ambitious academic goals into structured, actionable strategies. You are currently assisting a student in ${currentDepartment || 'an unspecified field'} at ${currentInstitution || 'an unspecified institution'}${background ? `\n\nUser Background: ${background}` : ''}

You will receive web search results containing information about academic programs, professors, research papers, application requirements, deadlines, and related academic content from reputable sources. The search results may not all be relevant to the user's goal. Only reference the search results that you find the most relavant.

Your task is to analyze this information and create a comprehensive action plan in JSON format. Use the most relevant information as your primary source for inference.

Return ONLY a valid JSON object with these exact fields:

- message (string): Clear, concise summary of the user's goal and key requirements ${toneInstruction}
- roadmap_title (string): Short, meaningful title for the roadmap (max 8 words)
- milestones (array of objects): Step-by-step action plan. Each item must contain:
    - action (string): Brief, imperative instruction (12-15 words maximum).
    - deadline (string): Realistic completion date based on ${currentDate} in YYYY-MM-DD format.
    - notes (string): Extremely detailed, beginner-friendly instructions. Explain every step clearly, including where to click, what to write, what tools to use, and any terminology that may need clarification.
    
IMPORTANT: 
- The dates you output should be after ${currentDate}, before the hard deadline.
- If the hard deadline from the search results is very different from that in your knowledge, confirm if they are really deadline of the same thing. If you are sure they are the same thing, use the ones from the search results.
- If the timeline between ${currentDate} and the hard deadline seems infeasible, compress steps as necessary — still ensuring all dates are after ${currentDate} and before the hard deadline.
- Please output actions in chronological order.
- Do not repeat steps the user has already completed. You may assume that the user has already completed all the steps that are typically required to get to that stage. If you think there are not much left to do, keep the plan short.
- Do not hallucinate. If you are not sure about something, do not include it.
`

    const userPrompt = `User Goal: ${goal}
    User Clarifications: ${clarifications}
    Search results: ${searchResults}`

    try {
      const response = await this.generateResponse({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
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

  async checkGoalSanity(params: {
    goal: string
    currentDepartment?: string
    currentInstitution?: string
    background?: string
  }): Promise<GoalSanityCheck> {
    const { goal, currentDepartment, currentInstitution, background } = params

    const systemPrompt = `You are an academic advisor. Before creating a roadmap for the user's academic goal, your role is to first verify the goal and request clarification if necessary.

Please check:
	1.	Whether any critical information is missing that you need before making a roadmap.
	2.	Whether there are inaccuracies in the user's stated goal (e.g., a program that does not exist to your knowledge).
	3.	Whether the user may already have taken steps toward this goal but has not mentioned their progress.

Important Rule: Do not ask the user for details you could reasonably look up online.

Output: Respond only with valid JSON in the following format:

{
  "missingInfo": [ "string" ],  
  "clarifications": [ "string" ]  
}`

    const userPrompt = `User Goal: ${goal}
User Background: ${currentDepartment ? `Studying ${currentDepartment}` : 'Field not specified'} at ${currentInstitution || 'institution not specified'}${background ? `\n\nAdditional Background: ${background}` : ''}

Please analyze this goal for completeness and clarity.`

    try {
      const response = await this.generateResponse({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.2,
        maxTokens: 2000
      })

      // Extract JSON from markdown code blocks if present
      let jsonResponse = response
      if (response.includes('```json')) {
        const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/)
        if (jsonMatch) {
          jsonResponse = jsonMatch[1].trim()
        }
      } else if (response.includes('```')) {
        const codeMatch = response.match(/```\s*([\s\S]*?)\s*```/)
        if (codeMatch) {
          jsonResponse = codeMatch[1].trim()
        }
      }

      const sanityCheck = JSON.parse(jsonResponse)
      return sanityCheck
    } catch (error) {
      console.error('Failed to perform goal sanity check:', error)
      // Return a default response if parsing fails
      return {
        missingInfo: [],
        clarifications: []
      }
    }
  }

  async generateSearchPrompt(params: {
    goal: string
    clarifications: string
    currentDepartment?: string
    currentInstitution?: string
    background?: string
    currentDate: string
  }): Promise<string> {
    const { goal, clarifications, currentDepartment, currentInstitution, background, currentDate } = params

    const systemPrompt = `You are tasked with formulating search queries to prepare a detailed roadmap for the user's goal. The user will provide their goal and any clarifications. Return only the search prompt text (no JSON or extra formatting). When constructing the query, follow these rules:
	1.	Clearly state what information must be gathered.
	2.	Specify the types of sources to prioritize (e.g., official university websites, program pages, government portals, etc.).
	3.	Ensure the information is up-to-date as of ${currentDate}.
	4.	Request specific actionable details (deadlines, requirements, application steps, fees, contact information, etc.).
  5.  Make the query specific to the user's goal.
  6   Make the query concise.
  `

    const userPrompt = `Original Goal: ${goal}
Additional Clarifications: ${clarifications}
User Background: ${currentDepartment ? `Studying ${currentDepartment}` : 'Field not specified'} at ${currentInstitution || 'institution not specified'}${background ? `\n\nAdditional Background: ${background}` : ''}

Please create a comprehensive search prompt that will gather all necessary information for creating a detailed roadmap.`

    try {
      const response = await this.generateResponse({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        maxTokens: 1500
      })

      return response.trim()
    } catch (error) {
      console.error('Failed to generate search prompt:', error)
      // Return a fallback search prompt
      return `Search for information about ${goal} including requirements, deadlines, application processes, and relevant resources. Focus on official sources and current information.`
    }
  }
}

export const createBedrockService = (): BedrockService => {
  return new BedrockService()
}