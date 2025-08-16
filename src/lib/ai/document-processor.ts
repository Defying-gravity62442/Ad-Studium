import { generateResponse } from '@/lib/ai/claude'

interface DocumentEmbedding {
  content: string
  vector: number[]
  metadata: {
    page?: number
    section?: string
    chunk?: number
  }
}

export interface TextChunk {
  text: string
  page: number
}

export async function processDocumentFromChunks(
  chunks: TextChunk[],
  docToken: string
): Promise<DocumentEmbedding[]> {
  try {
    const embeddings: DocumentEmbedding[] = []

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      if (chunk.text.trim().length < 50) continue

      const vector = await generateEmbedding(chunk.text)
      
      embeddings.push({
        content: chunk.text,
        vector,
        metadata: {
          page: chunk.page,
          chunk: i
        }
      })
    }

    return embeddings
  } catch (error) {
    console.error('Failed to process document chunks:', error)
    throw new Error('Failed to process document chunks')
  }
}



async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const region = process.env.AWS_REGION || 'us-east-1'
    const bearerToken = process.env.AWS_BEARER_TOKEN_BEDROCK || ''
    
    if (!bearerToken) {
      throw new Error('AWS_BEARER_TOKEN_BEDROCK environment variable is not set')
    }

    const response = await fetch(`https://bedrock-runtime.${region}.amazonaws.com/model/amazon.titan-embed-text-v2:0/invoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${bearerToken}`,
      },
      body: JSON.stringify({
        inputText: text,
        dimensions: 1024,
        normalize: true
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Embedding API error (${response.status}): ${errorText}`)
    }

    const data = await response.json()
    return data.embedding
  } catch (error) {
    console.error('Failed to generate embedding:', error)
    throw error
  }
}

interface PageFilter {
  docToken: string
  startPage: number
  endPage: number
}

export async function queryDocuments(
  docTokens: string[],
  query: string,
  limit: number = 5,
  pageFilters?: PageFilter[]
): Promise<Array<{ content: string, similarity: number, metadata: Record<string, unknown> }>> {
  try {
    const queryVector = await generateEmbedding(query)
    
    // Use direct database query instead of internal API call
    return await queryDocumentsWithVector(docTokens, queryVector, limit, pageFilters)
  } catch (error) {
    console.error('Failed to query documents:', error)
    throw error
  }
}

async function queryDocumentsWithVector(
  docTokens: string[],
  queryVector: number[],
  limit: number = 5,
  pageFilters?: PageFilter[]
): Promise<Array<{ content: string, similarity: number, metadata: Record<string, unknown> }>> {
  const { prisma } = await import('@/lib/db')
  
  try {
    // Sanitize vector components
    const sanitizedVector = queryVector.map(v => {
      if (typeof v !== 'number' || isNaN(v) || !isFinite(v)) {
        throw new Error('Invalid query vector component')
      }
      return parseFloat(v.toFixed(8))
    })
    const vectorString = `[${sanitizedVector.join(',')}]`
    let results: any[]

    if (pageFilters && pageFilters.length > 0) {
      const allResults: any[] = []
      
      for (const filter of pageFilters) {
        try {
          // Ensure minimum limit of 1 per filter
          const filterLimit = Math.max(1, Math.ceil(limit / pageFilters.length))
          
          const filterResults = await prisma.$queryRaw`
            SELECT 
              id,
              "docToken",
              content,
              metadata,
              1 - (embedding <-> ${vectorString}::vector) as similarity
            FROM "DocumentEmbedding"
            WHERE "docToken" = ${filter.docToken}
            AND (metadata->>'page')::int >= ${filter.startPage}
            AND (metadata->>'page')::int <= ${filter.endPage}
            AND embedding IS NOT NULL
            ORDER BY embedding <-> ${vectorString}::vector
            LIMIT ${filterLimit}
          `
          allResults.push(...(filterResults as any[]))
        } catch (error) {
          console.error(`Error querying with page filter for docToken ${filter.docToken}:`, error)
          // Continue with other filters instead of failing completely
        }
      }
      
      // Sort combined results by similarity and limit
      results = allResults
        .sort((a, b) => parseFloat(b.similarity) - parseFloat(a.similarity))
        .slice(0, limit)
    } else {
      // Fallback to simple doc token filtering without page ranges
      results = await prisma.$queryRaw`
        SELECT 
          id,
          "docToken",
          content,
          metadata,
          1 - (embedding <-> ${vectorString}::vector) as similarity
        FROM "DocumentEmbedding"
        WHERE "docToken" = ANY(${docTokens})
        AND embedding IS NOT NULL
        ORDER BY embedding <-> ${vectorString}::vector
        LIMIT ${limit}
      `
    }

    // Format the results to match our expected interface
    return (results as any[]).map(row => ({
      content: row.content,
      similarity: parseFloat(row.similarity),
      metadata: row.metadata || {}
    }))
  } catch (error) {
    console.error('Failed to query documents with vector:', error)
    throw error
  }
}

export async function generateSocraticQuestions(
  documentContent: string,
  userContext?: string
): Promise<string[]> {
  const systemPrompt = `You are a Socratic questioning expert helping PhD students engage deeply with academic texts. 
  Generate 3-5 thought-provoking questions that:
  1. Encourage critical thinking about the content
  2. Connect ideas to broader themes
  3. Promote reflection on implications and applications
  4. Are specific to the document content provided`

  const userPrompt = `Based on this document content, generate Socratic questions:
  
  ${documentContent}
  
  ${userContext ? `Additional context: ${userContext}` : ''}`

  try {
    const response = await generateResponse({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      maxTokens: 1000,
      temperature: 0.7
    })

    // Parse the response to extract questions
    const questions = response
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && (line.startsWith('-') || line.startsWith('•') || line.match(/^\d+\./)))
      .map(line => line.replace(/^[-•\d\.\s]+/, '').trim())
      .filter(line => line.length > 0)

    return questions.length > 0 ? questions : [
      'What are the key assumptions underlying this work?',
      'How does this connect to your current understanding of the field?',
      'What questions does this raise for your own research?'
    ]
  } catch (error) {
    console.error('Failed to generate Socratic questions:', error)
    return [
      'What are the key assumptions underlying this work?',
      'How does this connect to your current understanding of the field?',
      'What questions does this raise for your own research?'
    ]
  }
}