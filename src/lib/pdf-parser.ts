// Remove the top-level import and use dynamic imports instead
// import * as pdfjsLib from 'pdfjs-dist'

// Set up the worker for pdf.js - only on client side
let pdfjsLib: typeof import('pdfjs-dist') | null = null

async function getPdfJsLib() {
  if (typeof window === 'undefined') {
    throw new Error('PDF processing is only available on the client side')
  }
  
  if (!pdfjsLib) {
    pdfjsLib = await import('pdfjs-dist')
    // Use local worker file for better reliability and CSP compliance  
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
  }
  
  return pdfjsLib
}

export interface PDFChunk {
  text: string
  page: number
}

interface PDFTextItem {
  str: string
  transform?: number[]
  width?: number
  height?: number
}

export interface PDFExtractionResult {
  chunks: PDFChunk[]
  totalPages: number
  message: string
}

export async function extractTextFromPDF(file: File): Promise<PDFExtractionResult> {
  const pdfjs = await getPdfJsLib()
  let pdf: import('pdfjs-dist').PDFDocumentProxy | null = null
  
  try {
    // Validate file size (prevent memory issues)
    const maxSizeInBytes = 50 * 1024 * 1024 // 50MB limit
    if (file.size > maxSizeInBytes) {
      throw new Error('PDF file is too large. Maximum size is 50MB.')
    }

    // Convert file to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer()
    
    if (arrayBuffer.byteLength === 0) {
      throw new Error('PDF file appears to be empty or corrupted.')
    }
    
    // Load the PDF document with error handling
    const loadingTask = pdfjs.getDocument({ 
      data: arrayBuffer,
      password: '', // Attempt with no password first
      verbosity: 0  // Reduce console noise
    })
    
    // Handle password-protected PDFs
    loadingTask.onPassword = () => {
      throw new Error('PDF is password-protected. Please remove the password and try again.')
    }
    
    pdf = await loadingTask.promise
    
    const chunks: PDFChunk[] = []
    const totalPages = pdf.numPages
    
    if (totalPages === 0) {
      throw new Error('PDF contains no pages.')
    }

    // Limit pages for very large documents to prevent memory issues
    const maxPages = 500
    const pagesToProcess = Math.min(totalPages, maxPages)
    
    if (totalPages > maxPages) {
      console.warn(`PDF has ${totalPages} pages. Processing only the first ${maxPages} pages.`)
    }
    
    // Process pages in smaller batches to manage memory
    const batchSize = 10
    for (let batchStart = 1; batchStart <= pagesToProcess; batchStart += batchSize) {
      const batchEnd = Math.min(batchStart + batchSize - 1, pagesToProcess)
      
      // Process batch of pages
      const batchPromises = []
      for (let pageNum = batchStart; pageNum <= batchEnd; pageNum++) {
        batchPromises.push(processPage(pdf, pageNum))
      }
      
      const batchResults = await Promise.allSettled(batchPromises)
      
      // Collect successful results
      for (const result of batchResults) {
        if (result.status === 'fulfilled' && result.value.length > 0) {
          chunks.push(...result.value)
        } else if (result.status === 'rejected') {
          console.warn('Failed to process page:', result.reason)
        }
      }
    }
    
    // If still no chunks, try processing pages with lower thresholds
    if (chunks.length === 0) {
      console.warn('No substantial text chunks found. Trying with lower quality thresholds.')
      
      for (let pageNum = 1; pageNum <= Math.min(totalPages, 50); pageNum++) {
        try {
          const fallbackChunks = await processPage(pdf, pageNum, true)
          chunks.push(...fallbackChunks)
        } catch (error) {
          console.warn(`Failed to process page ${pageNum} in fallback mode:`, error)
        }
      }
    }
    
    if (chunks.length === 0) {
      throw new Error('No readable text could be extracted from the PDF. The document may be image-based, corrupted, or have security restrictions.')
    }
    
    return {
      chunks,
      totalPages: pagesToProcess,
      message: `Extracted ${chunks.length} chunks from ${file.name} (processed ${pagesToProcess}/${totalPages} pages)`
    }
    
  } catch (error) {
    console.error('Error processing PDF:', error)
    
    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('Invalid PDF')) {
        throw new Error('The file does not appear to be a valid PDF document.')
      } else if (error.message.includes('password')) {
        throw new Error('This PDF is password-protected. Please remove the password and try again.')
      } else {
        throw new Error(`Failed to extract text from PDF: ${error.message}`)
      }
    }
    
    throw new Error('Failed to extract text from PDF: Unknown error occurred')
  } finally {
    // Clean up PDF document to free memory
    if (pdf) {
      try {
        pdf.destroy()
      } catch (cleanupError) {
        console.warn('Failed to cleanup PDF document:', cleanupError)
      }
    }
  }
}

async function processPage(pdf: import('pdfjs-dist').PDFDocumentProxy, pageNum: number, lowThreshold = false): Promise<PDFChunk[]> {
  const chunks: PDFChunk[] = []
  
  try {
    const page = await pdf.getPage(pageNum)
    const textContent = await page.getTextContent()
    
    // Type-safe text extraction
    const textItems = textContent.items
      .filter((item): item is any => 'str' in item)
      .map((item: any) => item.str)
      .filter(str => str && str.trim().length > 0)
    
    if (textItems.length === 0) {
      return chunks
    }
    
    const pageText = textItems.join(' ')
    
    if (pageText && pageText.trim()) {
      // Clean up the text
      const cleanedText = pageText
        .trim()
        .replace(/\s+/g, ' ') // Replace multiple spaces with single space
        .replace(/\n+/g, ' ') // Replace newlines with spaces
        .replace(/\t+/g, ' ') // Replace tabs with spaces
      
      const minChunkLength = lowThreshold ? 20 : 50
      
      // Split into paragraphs (split by multiple spaces or double newlines)
      const paragraphs = cleanedText
        .split(/\s{3,}|\n\s*\n/) // Split by 3+ spaces or double newlines (safer paragraph indicators)
        .map(p => p.trim())
        .filter(p => p.length > minChunkLength)
      
      // Create chunks for this page
      for (const paragraph of paragraphs) {
        if (paragraph.length > minChunkLength) {
          chunks.push({
            text: paragraph,
            page: pageNum
          })
        }
      }
      
      // If no good paragraphs found, try sentence-based splitting
      if (chunks.length === 0 && cleanedText.length > minChunkLength) {
        const sentences = cleanedText
          .split(/(?<=[.!?])\s+(?=[A-Z])/) // Split on sentence boundaries more carefully
          .map(s => s.trim())
          .filter(s => s.length > (lowThreshold ? 15 : 30))
        
        for (const sentence of sentences) {
          if (sentence.length > (lowThreshold ? 15 : 30)) {
            chunks.push({
              text: sentence,
              page: pageNum
            })
          }
        }
      }
      
      // Last resort: use the whole page text if it's substantial
      if (chunks.length === 0 && cleanedText.length > minChunkLength) {
        chunks.push({
          text: cleanedText,
          page: pageNum
        })
      }
    }
    
    // Clean up page to free memory
    try {
      page.cleanup()
    } catch (cleanupError) {
      console.warn(`Failed to cleanup page ${pageNum}:`, cleanupError)
    }
    
  } catch (error) {
    console.warn(`Error processing page ${pageNum}:`, error)
    // Don't throw - just skip this page
  }
  
  return chunks
}

// Alternative function that processes ArrayBuffer directly (useful for existing code)
export async function extractTextFromPDFBuffer(buffer: ArrayBuffer, filename: string = 'document.pdf'): Promise<PDFExtractionResult> {
  const file = new File([buffer], filename, { type: 'application/pdf' })
  return extractTextFromPDF(file)
}
