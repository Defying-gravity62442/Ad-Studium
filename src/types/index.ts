export interface User {
  id: string
  name?: string
  email: string
  image?: string
  encryptionKey?: string
  hasCompletedOnboarding: boolean
  timezone?: string
  currentInstitution?: string
  fieldsOfStudy?: string
  aiAssistantName?: string
  aiPersonality?: string
  createdAt: Date
  updatedAt: Date
}


export interface Journal {
  id: string
  userId: string
  title?: string
  content: string
  mood?: string
  tags: string[]
  isInCoolingPeriod: boolean
  canEditUntil: Date
  createdAt: Date
  updatedAt: Date
  date: Date
}

export interface AiMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export interface AiConversation {
  id: string
  journalId: string
  messages: AiMessage[]
  createdAt: Date
  updatedAt: Date
}

export interface Goal {
  id: string
  userId: string
  title: string
  description?: string
  targetDate?: Date
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface Roadmap {
  id: string
  userId: string
  goalId?: string
  title: string
  description?: string
  status: 'ACTIVE' | 'COMPLETED' | 'PAUSED' | 'CANCELLED'
  milestones: Milestone[]
  createdAt: Date
  updatedAt: Date
}

export interface Milestone {
  id: string
  roadmapId: string
  title: string
  description?: string
  dueDate?: string // YYYY-MM-DD format
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE'
  order: number
  createdAt: Date
  updatedAt: Date
}

export interface LetterToFutureSelf {
  id: string
  userId: string
  title?: string
  content: string
  unsealDate: Date
  isSealed: boolean
  isUnsealed: boolean
  createdAt: Date
  updatedAt: Date
}

export interface Reading {
  id: string
  userId: string
  docToken: string
  title: string
  uploadDate: Date
  journalLinkId?: string
  reflections: ReadingReflection[]
  createdAt: Date
  updatedAt: Date
}

export interface ReadingReflection {
  id: string
  readingId: string
  question: string
  response: string
  aiInsights?: string
  createdAt: Date
  updatedAt: Date
}

export interface Summary {
  id: string
  content: string
  mood?: string
  keyTopics: string[]
  isHiddenFromAI: boolean
  createdAt: Date
}

export interface DailySummary extends Summary {
  journalId: string
  summaryDate: Date
}

export interface WeeklySummary extends Summary {
  userId: string
  weekStartDate: Date
  weekEndDate: Date
}

export interface MonthlySummary extends Summary {
  userId: string
  monthStartDate: Date
  monthEndDate: Date
}

export interface YearlySummary extends Summary {
  userId: string
  yearStartDate: Date
  yearEndDate: Date
}

export interface ApiResponse<T> {
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination?: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}