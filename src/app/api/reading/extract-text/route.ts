import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Only PDF files are supported' }, { status: 400 })
    }

    // This endpoint is deprecated - PDF parsing should be done on the frontend
    return NextResponse.json(
      { 
        error: 'This endpoint is deprecated. Please use frontend PDF parsing instead.',
        message: 'PDF parsing has been moved to the frontend for better reliability. Please update your client code to use the frontend PDF parser.'
      },
      { status: 410 } // Gone status code
    )
  } catch (error) {
    console.error('Failed to extract text from PDF:', error)
    return NextResponse.json(
      { error: 'Failed to extract text from PDF' },
      { status: 500 }
    )
  }
}