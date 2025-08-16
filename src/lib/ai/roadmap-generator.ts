import { createBedrockService } from './bedrock'

export interface RoadmapMilestone {
  title: string
  description?: string
  dueDate?: string
  estimatedDuration?: number
}

export interface GeneratedRoadmap {
  milestones: RoadmapMilestone[]
  researchSources?: string[]
}

export async function generateRoadmap({
  title,
  description
}: {
  title: string
  description?: string
}): Promise<GeneratedRoadmap> {
  const systemPrompt = `You are an expert academic advisor helping PhD applicants create structured roadmaps. 
  Based on the goal provided, generate a detailed roadmap with 5-10 milestones that are:
  1. Specific and actionable
  2. Time-bound with realistic deadlines
  3. Progressive (building on each other)
  4. Relevant to PhD application success
  
  Format your response as JSON with this structure:
  {
    "milestones": [
      {
        "title": "Milestone title",
        "description": "Detailed description of what needs to be done",
        "dueDate": "YYYY-MM-DD",
        "estimatedDuration": 7
      }
    ],
    "researchSources": ["Source 1", "Source 2"]
  }`

  const userPrompt = `Create a roadmap for this PhD application goal:
  Title: ${title}
  ${description ? `Description: ${description}` : ''}
  
  Consider typical PhD application timelines, requirements, and best practices.`

  try {
    const bedrockService = createBedrockService()
    
    const response = await bedrockService.generateResponse({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      maxTokens: 2000
    })

    const roadmap = JSON.parse(response)
    return roadmap
  } catch (error) {
    console.error('Failed to generate roadmap:', error)
    
    return {
      milestones: [
        {
          title: 'Research Target Programs',
          description: 'Identify and research PhD programs that align with your interests and career goals',
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          estimatedDuration: 14
        },
        {
          title: 'Prepare Application Materials',
          description: 'Draft personal statement, research proposal, and gather recommendation letters',
          dueDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          estimatedDuration: 60
        },
        {
          title: 'Submit Applications',
          description: 'Complete and submit all PhD applications before deadlines',
          dueDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          estimatedDuration: 30
        }
      ]
    }
  }
}
