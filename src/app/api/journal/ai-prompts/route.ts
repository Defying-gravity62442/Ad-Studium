import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createBedrockService } from '@/lib/ai/bedrock'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { contextData, userCustomization } = await request.json()

    // Validate that we received decrypted context data from the client
    if (!contextData) {
      return NextResponse.json({ error: 'Context data is required' }, { status: 400 })
    }

    const bedrockService = createBedrockService()
    
    // Format the context data for the AI prompt
    const formattedContext = formatContextForAIPrompt(contextData, userCustomization)
    
    const userPrompt = `Based on the following context, generate three daily journal questions that encourage user self-reflection. 

Please respond with ONLY a JSON array of exactly 3 questions, like this format:
["Question 1", "Question 2", "Question 3"]

Keep questions tailored for this user.

Context: ${formattedContext}`

    try {
      const response = await bedrockService.generateResponse({
        messages: [
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.8,
        maxTokens: 800
      })

      // Try to parse the response as JSON
      let prompts
      try {
        prompts = JSON.parse(response.trim())
        if (!Array.isArray(prompts) || prompts.length !== 3) {
          throw new Error('Invalid JSON format')
        }
      } catch (parseError) {
        console.error('Failed to parse JSON response:', parseError)
        // Fallback to parsing as text if JSON fails
        const lines = response.trim().split('\n').filter(line => line.trim().length > 0)
        prompts = lines.slice(0, 3) // Take first 3 lines
      }

      return NextResponse.json({ content: prompts })
    } catch (error) {
      console.error('Failed to generate prompts:', error)
      
      const fallbackContent = [
        "What was the most challenging part of your academic journey today, and how did you handle it?",
        "What specific progress did you make toward your PhD goals this week?",
        "Who or what are you grateful for in your academic journey right now?"
      ]

      return NextResponse.json({ content: fallbackContent })
    }
  } catch (error) {
    console.error('Failed to generate AI prompts:', error)
    return NextResponse.json({ error: 'Failed to generate prompts' }, { status: 500 })
  }
}

function formatContextForAIPrompt(contextData: any, userCustomization?: any): string {
  try {
    const {
      todayCalendarEvents = [],
      weeklyProgress = [],
      previousWeeksSummaries = [],
      activeRoadmaps = [],
      upcomingMilestones = []
    } = contextData

    const parts = []

    // Today's Calendar Events
    if (todayCalendarEvents.length > 0) {
      parts.push('### Today\'s Calendar Events:')
      parts.push(todayCalendarEvents.map((e: any) => `- ${e.summary} (${e.start} - ${e.end})`).join('\n'))
    } else {
      parts.push('### Today\'s Calendar Events: No calendar events found for today')
    }

    // This Week's Progress
    if (weeklyProgress.length > 0) {
      parts.push('### This Week\'s Progress:')
      parts.push(weeklyProgress.map((p: any) => `- ${p.summaryDate}: ${p.content} (Mood: ${p.mood || 'N/A'})`).join('\n'))
    } else {
      parts.push('### This Week\'s Progress: No daily summaries available for this week')
    }

    // Previous Weeks Summary
    if (previousWeeksSummaries.length > 0) {
      parts.push('### Previous Weeks Summary:')
      parts.push(previousWeeksSummaries.map((s: any) => `- Week of ${s.weekStartDate}: ${s.content}`).join('\n'))
    } else {
      parts.push('### Previous Weeks Summary: No weekly summaries available')
    }

    // Active Goals & Roadmaps
    if (activeRoadmaps.length > 0) {
      parts.push('### Active Goals & Roadmaps:')
      parts.push(activeRoadmaps.map((r: any) => `- ${r.title}: ${r.description || 'No description'}`).join('\n'))
    } else {
      parts.push('### Active Goals & Roadmaps: No active roadmaps')
    }

    // Upcoming Milestones
    if (upcomingMilestones.length > 0) {
      parts.push('### Upcoming Milestones:')
      parts.push(upcomingMilestones.map((m: any) => `- ${m.title} (Due: ${m.dueDate}) - ${m.roadmapTitle}`).join('\n'))
    } else {
      parts.push('### Upcoming Milestones: No upcoming milestones')
    }

    // User Academic Profile
    if (userCustomization) {
      const profileParts = []
      if (userCustomization.currentInstitution) {
        profileParts.push(`Institution: ${userCustomization.currentInstitution}`)
      }
      if (userCustomization.fieldsOfStudy) {
        profileParts.push(`Fields of Study: ${userCustomization.fieldsOfStudy}`)
      }
      if (userCustomization.background) {
        profileParts.push(`Background: ${userCustomization.background}`)
      }
      
      if (profileParts.length > 0) {
        parts.push('### User Academic Profile:')
        parts.push(profileParts.join('\n'))
      }
    }

    return `## User Context for Journaling Prompts\n\n${parts.join('\n\n')}`
  } catch (error) {
    console.error('Failed to format context for AI prompt:', error)
    return 'Context data is currently unavailable.'
  }
} 