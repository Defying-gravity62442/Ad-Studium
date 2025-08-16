import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { processDocumentFromChunks, TextChunk } from '@/lib/ai/document-processor'
import { generateSecureToken } from '@/lib/encryption'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { chunks, filename, title, totalPages } = await request.json()
    
    if (!chunks || !Array.isArray(chunks) || chunks.length === 0) {
      return NextResponse.json({ error: 'No text chunks provided' }, { status: 400 })
    }

    if (!filename) {
      return NextResponse.json({ error: 'Filename is required' }, { status: 400 })
    }

    // Validate chunks structure with better error messages
    if (!Array.isArray(chunks)) {
      return NextResponse.json({ error: 'Chunks must be an array' }, { status: 400 })
    }

    const validChunks: TextChunk[] = chunks.filter((chunk: any, index: number) => {
      if (!chunk || typeof chunk !== 'object') {
        console.warn(`Chunk ${index} is not an object:`, chunk)
        return false
      }
      if (!chunk.text || typeof chunk.text !== 'string' || chunk.text.trim().length === 0) {
        console.warn(`Chunk ${index} has invalid text:`, chunk.text)
        return false
      }
      if (!chunk.page || typeof chunk.page !== 'number' || chunk.page < 1) {
        console.warn(`Chunk ${index} has invalid page number:`, chunk.page)
        return false
      }
      return true
    })

    if (validChunks.length === 0) {
      return NextResponse.json({ 
        error: 'No valid text chunks found. Chunks must have non-empty text and valid page numbers.',
        totalChunks: chunks.length
      }, { status: 400 })
    }

    if (validChunks.length < chunks.length) {
      console.warn(`Filtered out ${chunks.length - validChunks.length} invalid chunks`)
    }

    const docToken = generateSecureToken()
    
    try {
      // Process the text chunks to generate embeddings
      console.log(`Processing ${validChunks.length} chunks for document ${filename}`)
      const embeddings = await processDocumentFromChunks(validChunks, docToken)
      
      if (embeddings.length === 0) {
        throw new Error('Failed to generate any embeddings from the document chunks')
      }

      console.log(`Generated ${embeddings.length} embeddings`)

      // Create the reading record (title will be encrypted and set later by client)
      const reading = await prisma.reading.create({
        data: {
          userId: session.user.id,
          docToken,
          title: null, // Will be encrypted and set by client
          totalPages: totalPages || null, // Store the total pages from PDF
        },
      })

      // Insert embeddings using raw SQL for pgvector compatibility
      let successfulEmbeddings = 0
      const failedEmbeddings: string[] = []
      
      for (let i = 0; i < embeddings.length; i++) {
        try {
          const embedding = embeddings[i]
          
          // Validate embedding vector
          if (!Array.isArray(embedding.vector) || embedding.vector.length === 0) {
            throw new Error(`Invalid embedding vector at index ${i}`)
          }
          
          // Validate that all vector components are numbers
          const isValidVector = embedding.vector.every(v => typeof v === 'number' && !isNaN(v) && isFinite(v))
          if (!isValidVector) {
            throw new Error(`Embedding vector contains invalid numbers at index ${i}`)
          }
          
          // Sanitize vector components to prevent injection
          const sanitizedVector = embedding.vector.map(v => parseFloat(v.toFixed(8))) // Round to 8 decimal places
          const vectorString = `[${sanitizedVector.join(',')}]`
          
          await prisma.$executeRaw`
            INSERT INTO "DocumentEmbedding" (id, "docToken", content, embedding, metadata, "createdAt")
            VALUES (
              ${generateSecureToken()},
              ${docToken},
              ${embedding.content},
              ${vectorString}::vector,
              ${JSON.stringify(embedding.metadata)}::jsonb,
              NOW()
            )
          `
          successfulEmbeddings++
        } catch (embeddingError) {
          console.error(`Failed to insert embedding ${i}:`, embeddingError)
          const errorMessage = embeddingError instanceof Error ? embeddingError.message : 'Unknown error'
          failedEmbeddings.push(`Embedding ${i}: ${errorMessage}`)
        }
      }
      
      if (successfulEmbeddings === 0) {
        // Clean up the reading record if no embeddings were inserted
        await prisma.reading.delete({ where: { id: reading.id } })
        throw new Error(`Failed to insert any embeddings. Errors: ${failedEmbeddings.join('; ')}`)
      }
      
      if (failedEmbeddings.length > 0) {
        console.warn(`Some embeddings failed to insert: ${failedEmbeddings.join('; ')}`)
      }

      return NextResponse.json({ 
        reading: {
          id: reading.id,
          docToken: reading.docToken,
          originalTitle: filename,
          uploadDate: reading.uploadDate,
          chunksProcessed: validChunks.length,
          embeddingsCreated: successfulEmbeddings,
          embeddingsFailed: failedEmbeddings.length
        }
      })
      
    } catch (processingError) {
      console.error('Failed to process document chunks:', processingError)
      
      // Try to clean up any partial data
      try {
        // First delete embeddings, then reading record
        await prisma.$executeRaw`
          DELETE FROM "DocumentEmbedding" WHERE "docToken" = ${docToken}
        `
        await prisma.reading.deleteMany({
          where: { 
            docToken,
            userId: session.user.id // Extra safety check
          }
        })
        console.log(`Cleaned up partial data for docToken: ${docToken}`)
      } catch (cleanupError) {
        console.error('Failed to cleanup after processing error:', cleanupError)
        // Don't throw - the original error is more important
      }
      
      throw processingError
    }
  } catch (error) {
    console.error('Failed to process document chunks:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return NextResponse.json(
      { 
        error: 'Failed to process document chunks',
        details: errorMessage
      },
      { status: 500 }
    )
  }
}
