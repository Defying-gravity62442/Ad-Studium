import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { queryDocuments } from '@/lib/ai/document-processor'

// Import Claude AI client
import { createBedrockService } from '@/lib/ai/bedrock'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { readingIds, readingLogsData, maxLogs = 8 } = await request.json()

    if (!readingIds || !Array.isArray(readingIds) || readingIds.length === 0) {
      return NextResponse.json({ error: 'Reading IDs are required' }, { status: 400 })
    }

    if (!readingLogsData || !Array.isArray(readingLogsData) || readingLogsData.length === 0) {
      return NextResponse.json({ error: 'Reading logs data is required' }, { status: 400 })
    }

    // Verify all readings belong to the current user
    const readings = await prisma.reading.findMany({
      where: {
        id: { in: readingIds },
        userId: session.user.id
      }
    })

    if (readings.length !== readingIds.length) {
      return NextResponse.json({ error: 'Some readings not found' }, { status: 404 })
    }

    // Use the client-provided decrypted reading logs data
    const allLogs = readingLogsData
      .sort((a, b) => new Date(b.sessionDate + 'T00:00:00').getTime() - new Date(a.sessionDate + 'T00:00:00').getTime())
      .slice(0, maxLogs)

    if (allLogs.length === 0) {
      return NextResponse.json({ 
        error: 'No reading logs found for the selected documents' 
      }, { status: 400 })
    }

    // Get doc tokens and page ranges for RAG retrieval
    const docTokens = [...new Set(allLogs.map(log => log.docToken))]
    
    // Create page filters from reading logs
    const pageFilters = allLogs.map(log => ({
      docToken: log.docToken,
      startPage: log.startPage,
      endPage: log.endPage
    }))
    
    // Generate context from reading logs for the RAG query
    const logContext = allLogs.map(log => {
      return `Reading session: ${log.readingTitle || 'Document'} pages ${log.startPage}-${log.endPage} on ${new Date(log.sessionDate + 'T00:00:00').toDateString()}`
    }).join('\n')

    // Canonical query for foundational concepts
    const canonicalQuery = "A summary of the core concepts, theorems, and main arguments presented in this text."
    
    // Retrieve relevant content using RAG with page filtering
    const retrievedChunks = await queryDocuments(docTokens, canonicalQuery, 5, pageFilters)
    
    // Format context for the LLM
    const documentContext = retrievedChunks.map((chunk, index) => 
      `[Chunk ${index + 1}] ${chunk.content}`
    ).join('\n\n')

    // Determine if we have multiple reading logs for cross-contextual analysis
    const hasMultipleLogs = allLogs.length > 1
    const uniqueDocuments = new Set(allLogs.map(log => log.docToken)).size
    const hasMultipleDocuments = uniqueDocuments > 1

    // System prompt for Socratic reflection - different prompts based on context
    let systemPrompt: string
    
    if (hasMultipleLogs && hasMultipleDocuments) {
      // Multiple reading logs from different documents - full cross-contextual analysis
      systemPrompt = `You help PhD aspirants reflect critically on their reading through Socratic questioning and cross-contextual analysis. Based ONLY on the content retrieved from their reading materials, you will perform two tasks.

**Task 1: Socratic Questions**
Generate exactly three Socratic questions to assess their understanding of TODAY's reading. Each question must target a core concept from the text, encourage critical thinking over recall, be open-ended, and build in complexity.

**Task 2: Cross-Context Inspiration**
Generate exactly three "Cross-Context Inspiration" prompts that connect today's reading with other sources in the provided context. Each prompt must identify a specific connection or contrast, ask an insightful question about the relationship, and clearly cite the sources.

**Important Guidelines:**
- Base your response ONLY on the provided context.
- If the context is insufficient, state this clearly.
- Ensure questions are appropriate for PhD-level thinking.`
    } else if (hasMultipleLogs) {
      // Multiple reading logs from same document - temporal progression analysis
      systemPrompt = `You help PhD aspirants reflect critically on their reading through Socratic questioning and temporal progression analysis. Based ONLY on the content retrieved from their reading materials, you will perform two tasks.

**Task 1: Socratic Questions**
Generate exactly three Socratic questions to assess their understanding of TODAY's reading. Each question must target a core concept from the text, encourage critical thinking over recall, be open-ended, and build in complexity.

**Task 2: Temporal Progression Analysis**
Generate exactly three "Temporal Progression" prompts that analyze how their understanding has evolved across different reading sessions of the same document. Each prompt should focus on:
- How concepts build upon each other across sessions
- Changes in comprehension or perspective over time
- Connections between earlier and later sections of the text
- Patterns in their reading progression

**Important Guidelines:**
- Base your response ONLY on the provided context.
- If the context is insufficient, state this clearly.
- Ensure questions are appropriate for PhD-level thinking.`
    } else {
      // Single reading log - focused deep analysis
      systemPrompt = `You help PhD aspirants reflect critically on their reading through Socratic questioning and Beyond-the-reading. Based ONLY on the content retrieved from their reading materials, you will perform two tasks.

**Task 1: Socratic Questions**
Generate exactly three Socratic questions to assess their understanding of TODAY's reading. Each question must target a core concept from the text, encourage critical thinking over recall, be open-ended, and build in complexity.

**Task 2: Beyond the Reading
Generate exactly three “Extension” prompts that encourage the learner to push their thinking outside the immediate text.

**Important Guidelines:**
- Base Task 1 strictly on the provided context.
- For Task 2, use the text as a springboard, but make sure the prompts reach beyond what is explicitly in the reading.
- If the context is insufficient, state this clearly.
- Ensure questions are appropriate for PhD-level thinking.`
    }

    const userPrompt = `**Context from Reading Logs:**
---
${logContext}

**Retrieved Document Content:**
---
${documentContext}
---

Please generate the Socratic questions and ${hasMultipleLogs && hasMultipleDocuments ? 'cross-context inspiration' : 
hasMultipleLogs ? 'temporal progression analysis' : 'beyond-the-reading'} prompts based on this context.`

    // Call Claude AI for reflection generation
    const bedrockService = createBedrockService()
    const aiResponse = await bedrockService.generateResponse({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      maxTokens: 2000
    })

    // Parse the AI response to extract Socratic questions and cross-contextual inspiration
    // Structure the response for E2EE storage
    const structuredReflection = {
      content: aiResponse,
      socraticQuestions: [], // These will be extracted from the AI response
      crossContextualInspiration: [], // These will be extracted from the AI response
      metadata: {
        readingLogs: allLogs.length,
        documentsAnalyzed: docTokens.length,
        retrievedChunks: retrievedChunks.length,
        sessionDate: new Date().toISOString(),
        readingIds: readingIds,
        analysisType: hasMultipleLogs && hasMultipleDocuments ? 'cross-contextual' : 
                     hasMultipleLogs ? 'temporal-progression' : 'beyond-the-reading'
      }
    }

    // Validate the structured reflection before storing
    if (!aiResponse || typeof aiResponse !== 'string') {
      throw new Error('Invalid AI response format')
    }

    // Create reflection record - store structured data that will be encrypted client-side
    let reflection
    try {
      reflection = await prisma.readingReflection.create({
        data: {
          readingId: readings[0].id, // Associate with the first reading
          question: canonicalQuery,
          response: JSON.stringify(structuredReflection), // This will be encrypted client-side
          aiInsights: JSON.stringify({
            readingLogs: allLogs.length,
            documentsAnalyzed: docTokens.length,
            retrievedChunks: retrievedChunks.length,
            analysisType: hasMultipleLogs && hasMultipleDocuments ? 'cross-contextual' : 
                         hasMultipleLogs ? 'temporal-progression' : 'beyond-the-reading'
          })
        }
      })
    } catch (dbError) {
      console.error('Failed to store reflection:', dbError)
      throw new Error('Failed to store reflection in database')
    }

    return NextResponse.json({ 
      reflection: {
        id: reflection.id,
        content: aiResponse,
        structuredData: structuredReflection, // Include structured data for client-side encryption
        metadata: {
          readingLogsAnalyzed: allLogs.length,
          documentsAnalyzed: docTokens.length,
          retrievedChunks: retrievedChunks.length,
          analysisType: hasMultipleLogs && hasMultipleDocuments ? 'cross-contextual' : 
                       hasMultipleLogs ? 'temporal-progression' : 'beyond-the-reading'
        }
      }
    })

  } catch (error) {
    console.error('Failed to generate reflection:', error)
    return NextResponse.json(
      { error: 'Failed to generate reflection' },
      { status: 500 }
    )
  }
}