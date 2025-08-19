interface PerplexityRequest {
  model: string
  messages: Array<{
    role: 'system' | 'user' | 'assistant'
    content: string
  }>
  max_tokens?: number
  temperature?: number
  top_p?: number
  stream?: boolean
  presence_penalty?: number
  frequency_penalty?: number
}

interface PerplexityResponse {
  id: string
  model: string
  created: number
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
  object: string
  choices: Array<{
    index: number
    finish_reason: string
    message: {
      role: string
      content: string
    }
    delta?: {
      role?: string
      content?: string
    }
  }>
  // Optional citations and search results provided by Perplexity for source attribution
  citations?: string[]
  search_results?: Array<{
    title: string
    url: string
    date?: string
  }>
}

export class PerplexityService {
  private apiKey: string
  private baseUrl = 'https://api.perplexity.ai/chat/completions'

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('Perplexity API key is required')
    }
    this.apiKey = apiKey
  }

  async chat(params: {
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
    model?: string
    maxTokens?: number
    temperature?: number
    topP?: number
    stream?: boolean
    presencePenalty?: number
    frequencyPenalty?: number
  }): Promise<PerplexityResponse> {
    const {
      messages,
      model = 'sonar-pro',
      maxTokens,
      temperature,
      topP,
      stream = false,
      presencePenalty,
      frequencyPenalty
    } = params

    const requestBody: PerplexityRequest = {
      model,
      messages
    }

    if (maxTokens) requestBody.max_tokens = maxTokens
    if (temperature !== undefined) requestBody.temperature = temperature
    if (topP) requestBody.top_p = topP
    if (stream) requestBody.stream = stream
    if (presencePenalty) requestBody.presence_penalty = presencePenalty
    if (frequencyPenalty) requestBody.frequency_penalty = frequencyPenalty

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Perplexity API error (${response.status}): ${errorText}`)
      }

      const data: PerplexityResponse = await response.json()
      return data
    } catch (error) {
      console.error('Perplexity API request failed:', error)
      throw new Error(`Failed to chat with Perplexity: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async search(params: {
    query: string
    model?: string
    maxTokens?: number
    temperature?: number
  }): Promise<PerplexityResponse> {
    const {
      query,
      model = 'sonar-pro',
      maxTokens = 4000,
      temperature = 0.1
    } = params

    return this.chat({
      messages: [
        {
          role: 'user',
          content: query
        }
      ],
      model,
      maxTokens,
      temperature
    })
  }



  async searchWithCustomPrompt(params: {
    searchPrompt: string
    currentDate: string
  }): Promise<{ text: string; sources: Array<{ title: string; url: string; date?: string }> }> {
    const { searchPrompt } = params

    const searchResponse = await this.search({
      query: searchPrompt,
      model: 'sonar-pro',
      maxTokens: 4000,
      temperature: 0.1
    })

    const text = searchResponse.choices[0]?.message?.content || ''
    const sources = (searchResponse.search_results && searchResponse.search_results.length > 0)
      ? searchResponse.search_results
      : (searchResponse.citations || []).map((url: string) => ({ title: url, url }))

    return { text, sources }
  }
}

export const createPerplexityService = (): PerplexityService => {
  const apiKey = process.env.PERPLEXITY_API_KEY
  if (!apiKey) {
    throw new Error('PERPLEXITY_API_KEY environment variable is not set')
  }
  return new PerplexityService(apiKey)
}