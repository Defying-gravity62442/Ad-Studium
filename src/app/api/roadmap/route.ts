import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { serializeEncryptedData, parseEncryptedData, validateEncryptedData } from '@/lib/encryption'
import { createPerplexityService } from '@/lib/ai/perplexity'
import { createBedrockService } from '@/lib/ai/bedrock'
import type { Prisma } from '@prisma/client'
import type { EncryptedData } from '@/lib/encryption'
import { inferSourceType } from '@/lib/utils/source-utils'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const roadmaps = await prisma.roadmap.findMany({
      where: { userId: session.user.id },
      include: {
        milestones: {
          orderBy: { order: 'asc' }
        },
        goal: true
      },
      orderBy: { createdAt: 'desc' }
    })

    // Return encrypted data as-is - client will decrypt
    const roadmapsWithEncryptedData = roadmaps.map(roadmap => ({
      ...roadmap,
      title: parseEncryptedData(roadmap.title),
      milestones: roadmap.milestones.map(milestone => ({
        ...milestone,
        title: parseEncryptedData(milestone.title),
        description: milestone.description ? parseEncryptedData(milestone.description) : null
      }))
    }))

    return NextResponse.json({ roadmaps: roadmapsWithEncryptedData })
  } catch (error) {
    console.error('Failed to fetch roadmaps:', error)
    return NextResponse.json(
      { error: 'Failed to fetch roadmaps' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { 
      title, 
      goalId, 
      generateWithAI, 
      encryptedTitle, 
      encryptedMilestones,
      currentDepartment,
      currentInstitution,
      background,
      toneInstruction
    } = await request.json()

    // For AI generation, we need plaintext data temporarily
    if (generateWithAI) {
      if (!title) {
        return NextResponse.json(
          { error: 'Goal is required for AI generation' },
          { status: 400 }
        )
      }

      const currentDate = new Date().toISOString().split('T')[0]

      // Step 1: Search with Perplexity
      const perplexityService = createPerplexityService()
      
      const searchResults = await perplexityService.searchForRoadmap({
        goal: title.trim(),
        currentDepartment: currentDepartment?.trim(),
        currentInstitution: currentInstitution?.trim(),
        background: background?.trim(),
        currentDate
      })

      // Step 2: Process with Claude Bedrock
      const bedrockService = createBedrockService()
      
      const generatedRoadmap = await bedrockService.generateRoadmapFromSearch({
        goal: title.trim(),
        searchResults: searchResults.text,
        currentDepartment: currentDepartment?.trim(),
        currentInstitution: currentInstitution?.trim(),
        background: background?.trim(),
        currentDate,
        toneInstruction: toneInstruction?.trim(),
        // Provide Perplexity sources text to nudge Bedrock but we will not use its formatted links
        sourcesText: `\n\nSources from search (for your awareness, do not fabricate):\n${(searchResults.sources || [])
          .map(s => `- ${s.title}: ${s.url}`)
          .join('\n')}`
      })

      // Sort milestones by deadline to ensure chronological order
      const sortedMilestones = generatedRoadmap.milestones.sort((a, b) => {
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
      })

      // Return the AI-generated roadmap to client for encryption
      // Client will encrypt and send back in a separate request
      return NextResponse.json({ 
        aiRoadmap: {
          title: generatedRoadmap.roadmap_title,
          description: generatedRoadmap.message,
          milestones: sortedMilestones.map(milestone => ({
            title: milestone.action,
            description: milestone.notes,
            dueDate: milestone.deadline
          })),
          // Use Perplexity sources directly and infer type
          sources: (searchResults.sources || []).map(s => ({
            title: s.title,
            url: s.url,
            type: inferSourceType(s.url, s.title)
          }))
        }
      })
    }

    // Handle pre-encrypted data
    if (!validateEncryptedData(encryptedTitle)) {
      return NextResponse.json(
        { error: 'Invalid encrypted title format' },
        { status: 400 }
      )
    }



    type IncomingEncryptedMilestone = {
      encryptedTitle: EncryptedData
      encryptedDescription?: EncryptedData | null
      dueDate?: string | null
    }

    const roadmapData: Prisma.RoadmapUncheckedCreateInput = {
      userId: session.user.id,
      goalId,
      title: serializeEncryptedData(encryptedTitle),
    }

    // Handle encrypted milestones if provided
    if (encryptedMilestones && Array.isArray(encryptedMilestones)) {
      const typedMilestones = encryptedMilestones as IncomingEncryptedMilestone[]
      // Validate all milestones are properly encrypted
      for (const milestone of typedMilestones) {
        if (!validateEncryptedData(milestone.encryptedTitle)) {
          return NextResponse.json(
            { error: 'Invalid encrypted milestone title format' },
            { status: 400 }
          )
        }
        if (milestone.encryptedDescription && !validateEncryptedData(milestone.encryptedDescription)) {
          return NextResponse.json(
            { error: 'Invalid encrypted milestone description format' },
            { status: 400 }
          )
        }
      }

      roadmapData.milestones = {
        create: typedMilestones.map((milestone, index: number) => ({
          title: serializeEncryptedData(milestone.encryptedTitle),
          description: milestone.encryptedDescription ? serializeEncryptedData(milestone.encryptedDescription) : null,
          dueDate: milestone.dueDate || null,
          order: index
        }))
      }
    }

    const roadmap = await prisma.roadmap.create({
      data: roadmapData,
      include: {
        milestones: {
          orderBy: { order: 'asc' }
        }
      }
    })

    return NextResponse.json({ 
      roadmap: {
        ...roadmap,
        title: encryptedTitle,
        milestones: roadmap.milestones.map((milestone, index) => ({
          ...milestone,
          title: encryptedMilestones?.[index]?.encryptedTitle || null,
          description: encryptedMilestones?.[index]?.encryptedDescription || null
        }))
      }
    })
  } catch (error) {
    console.error('Failed to create roadmap:', error)
    return NextResponse.json(
      { error: 'Failed to create roadmap' },
      { status: 500 }
    )
  }
}