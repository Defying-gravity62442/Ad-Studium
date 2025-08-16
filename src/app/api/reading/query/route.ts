import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

interface PageFilter {
  docToken: string
  startPage: number
  endPage: number
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { docTokens, queryVector, pageFilters, limit = 5 } = await request.json()

    if (!docTokens || !Array.isArray(docTokens) || docTokens.length === 0) {
      return NextResponse.json({ error: 'Document tokens are required' }, { status: 400 })
    }

    if (!queryVector || !Array.isArray(queryVector)) {
      return NextResponse.json({ error: 'Query vector is required' }, { status: 400 })
    }

    // Sanitize and convert queryVector to the format expected by pgvector
    const sanitizedVector = queryVector.map(v => {
      const num = parseFloat(v)
      if (isNaN(num) || !isFinite(num)) {
        throw new Error('Invalid query vector component')
      }
      return parseFloat(num.toFixed(8))
    })
    const vectorString = `[${sanitizedVector.join(',')}]`

    let results: any[]

    if (pageFilters && pageFilters.length > 0) {
      // For safety, we'll do separate queries for each page filter and combine results
      const allResults: any[] = []
      
      for (const filter of pageFilters as PageFilter[]) {
        try {
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
            LIMIT ${Math.ceil(limit / pageFilters.length)}
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
    const formattedResults = (results as any[]).map(row => ({
      content: row.content,
      similarity: parseFloat(row.similarity),
      metadata: row.metadata
    }))

    return NextResponse.json({ 
      results: formattedResults
    })
  } catch (error) {
    console.error('Failed to query documents with pgvector:', error)
    return NextResponse.json(
      { error: 'Failed to query documents' },
      { status: 500 }
    )
  }
}