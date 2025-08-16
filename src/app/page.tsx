"use client"

import { useSession, signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { 
  BookOpen, 
  PenTool, 
  Map, 
  Mail, 
  Brain, 
  Shield, 
  ArrowRight,
  Sparkles,
  CheckCircle,
  Star,
  Users,
  Zap,
  Target,
  Heart,
  MessageCircle,
  Search,
  GraduationCap,
  Clock,
  TrendingUp,
  Lightbulb,
  Quote
} from 'lucide-react'

export default function Home() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [retryCount, setRetryCount] = useState(0)
  const MAX_RETRIES = 3

  useEffect(() => {
    if (status === 'authenticated' && session) {
      setTimeout(() => {
        checkOnboardingStatus()
      }, 500)
    }
  }, [session, status, router])

  const checkOnboardingStatus = async () => {
    try {
      const response = await fetch('/api/user/onboarding-status')
      
      if (response.ok) {
        const data = await response.json()
        const user = data.user

        const hasStoredE2EE = !!user.encryptionKey
        const hasUnlockedE2EE = hasStoredE2EE && localStorage.getItem('e2ee_session') !== null

        const hasAcceptedTerms = user.createdAt !== user.updatedAt || hasStoredE2EE
        const hasCustomizedAI = !!(user.currentInstitution || user.fieldsOfStudy || user.aiAssistantName || user.aiPersonality)
        const hasCreatedRoadmap = data.hasRoadmaps || false

        setRetryCount(0)

        if (!hasAcceptedTerms) {
          router.push('/onboarding/consent')
        } else if (hasStoredE2EE && !hasUnlockedE2EE) {
          router.push('/auth/unlock')
        } else if (!hasStoredE2EE) {
          router.push('/onboarding/e2ee')
        } else if (!hasCustomizedAI) {
          router.push('/onboarding/customization')
        } else if (!hasCreatedRoadmap) {
          router.push('/onboarding/roadmap')
        } else {
          router.push('/dashboard')
        }
      } else if (response.status === 404) {
        console.log('User not found - redirecting to homepage')
        router.push('/')
      } else {
        if (retryCount < MAX_RETRIES) {
          setRetryCount(prev => prev + 1)
          setTimeout(() => {
            checkOnboardingStatus()
          }, 1000)
        } else {
          router.push('/dashboard')
        }
      }
    } catch (error) {
      console.error('Homepage: Error checking onboarding status:', error)
      if (retryCount < MAX_RETRIES) {
        setRetryCount(prev => prev + 1)
        setTimeout(() => {
          checkOnboardingStatus()
        }, 1000)
      } else {
        router.push('/dashboard')
      }
    }
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center paper-texture">
        <div className="text-center">
          <div className="paper-loading-spinner mx-auto mb-4"></div>
          <div className="loading-text">Loading...</div>
        </div>
      </div>
    )
  }

  if (status === "authenticated" && session) {
    return (
      <div className="min-h-screen flex items-center justify-center paper-texture">
        <div className="text-center">
          <div className="paper-loading-spinner mx-auto mb-4"></div>
          <div className="loading-text">Setting up your account...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen paper-texture">
      {/* Hero Section */}
      <section className="relative py-20">
        <div className="content-wrapper-7xl">
          {/* Badge */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-3 bg-gradient-to-r from-gray-100 to-gray-200 border border-gray-300 px-6 py-3 rounded-full text-sm font-medium text-gray-700 shadow-sm hover:shadow-md transition-all duration-200">
              <div className="bg-gray-300 p-1.5 rounded-full">
                <GraduationCap className="h-4 w-4 text-gray-600" />
              </div>
              <span className="text-elegant tracking-wide">Built by an undergrad, for future PhD students</span>
            </div>
          </div>

          {/* Main Title */}
          <div className="text-center mb-16">
            <h1 className="text-6xl md:text-7xl font-bold text-black mb-8" style={{ fontFamily: 'Cardo, serif' }}>
              Ad Studium
            </h1>
            
            <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-8 leading-tight text-elegant">
              The only AI companion that{' '}
              <span className="relative">
                <span className="bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">grows with you</span>
                <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-gradient-to-r from-gray-400 to-gray-300"></span>
              </span>
              <br />
              as you prepare for PhD programs
            </h2>
            
            <p className="text-xl text-gray-600 max-w-4xl mx-auto mb-12 leading-relaxed text-paper-secondary">
              Unlike general AI tools, every conversation, reflection, and breakthrough becomes part of your story. 
              Build research skills, prepare applications, and develop the mindset you need—with a companion 
              that remembers your growth from day one.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
              <button 
                onClick={() => signIn("google")}
                className="btn-primary group flex items-center gap-3 px-8 py-4 text-lg"
              >
                <Sparkles className="h-5 w-5" />
                 Start with Google
                <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </button>
              
              <a 
                href="https://github.com/Defying-gravity62442/Ad-Studium"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary flex items-center gap-3 px-8 py-4 text-lg"
              >
                <Users className="h-5 w-5" />
                Self-Host on GitHub
              </a>
            </div>
          </div>

          {/* Key Features */}
          <div className="paper-grid max-w-5xl mx-auto">
            <div className="paper-card paper-spacing-md text-center">
              <Brain className="h-8 w-8 text-gray-700 mx-auto mb-4" />
              <div className="font-bold text-black mb-3 text-elegant">Contextual Memory</div>
              <div className="text-paper-secondary text-sm">Hierarchical summaries remember your breakthroughs—even from months ago</div>
            </div>
            <div className="paper-card paper-spacing-md text-center">
              <Target className="h-8 w-8 text-gray-700 mx-auto mb-4" />
              <div className="font-bold text-black mb-3 text-elegant">Single Purpose</div>
              <div className="text-paper-secondary text-sm">Every feature serves one goal: getting you into a PhD program. No distractions.</div>
            </div>
            <div className="paper-card paper-spacing-md text-center">
              <Heart className="h-8 w-8 text-gray-700 mx-auto mb-4" />
              <div className="font-bold text-black mb-3 text-elegant">Personal Companion</div>
              <div className="text-paper-secondary text-sm">Name your AI, customize personality—it becomes your research friend</div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Insight Section */}
      <section className="py-20 bg-gray-50">
        <div className="content-wrapper-7xl">
          <div className="text-center mb-16">
            <h2 className="heading-primary mb-6" style={{ fontFamily: 'Cardo, serif' }}>
              Why This Changes Everything
            </h2>
            <p className="text-xl text-paper-secondary max-w-3xl mx-auto text-elegant">
              Preparing for PhD programs is unique. Your AI companion should be too.
            </p>
          </div>

          <div className="paper-grid-2 gap-12 items-center">
            <div>
              <h3 className="heading-secondary mb-8 text-black">
                Every Interaction Builds Your Story
              </h3>
              
              <div className="space-y-8">
                <div className="flex items-start gap-4">
                  <div className="bg-gray-200 p-3 rounded-lg mt-1 flex-shrink-0">
                    <MessageCircle className="h-5 w-5 text-gray-700" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-black mb-3 text-elegant">No &ldquo;New Chat&rdquo; Mentality</h4>
                    <p className="text-paper-secondary">Unlike general AI tools, everything here is connected. Your journal entry links to your roadmap, your reading reflection connects to your research goals.</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4">
                  <div className="bg-gray-200 p-3 rounded-lg mt-1 flex-shrink-0">
                    <Clock className="h-5 w-5 text-gray-700" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-black mb-3 text-elegant">Memory That Matters</h4>
                    <p className="text-paper-secondary">Our hierarchical summary system means your AI remembers the breakthrough you had six months ago—and knows how it connects to today&apos;s challenges.</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4">
                  <div className="bg-gray-200 p-3 rounded-lg mt-1 flex-shrink-0">
                    <TrendingUp className="h-5 w-5 text-gray-700" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-black mb-3 text-elegant">Growing Intelligence</h4>
                    <p className="text-paper-secondary">The longer you use it, the better it knows you. Your companion evolves from helpful assistant to trusted advisor who truly understands your journey.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="paper-card paper-elevated paper-spacing-lg">
              <Quote className="h-8 w-8 text-gray-600 mb-6" />
              <blockquote className="text-lg italic text-black mb-6 text-elegant leading-relaxed">
                &ldquo;I realized the advantage of making an app for one single ultimate goal: to become a PhD, to do research. Every activity becomes context for AI assistance.&rdquo;
              </blockquote>
              <div className="text-paper-secondary font-medium text-elegant">— The Creator, Undergrad → PhD Aspirant</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="content-wrapper-7xl">
          <div className="text-center mb-16">
            <h2 className="heading-primary mb-6" style={{ fontFamily: 'Cardo, serif' }}>
              Built for Researchers, Not Consumers
            </h2>
            <p className="text-xl text-paper-secondary max-w-3xl mx-auto text-elegant">
              Features designed specifically for the academic mind
            </p>
          </div>

          <div className="paper-grid-2 gap-12">
            {/* Reading Reflection */}
            <div className="paper-card paper-spacing-lg">
              <div className="bg-gray-200 w-16 h-16 rounded-xl flex items-center justify-center mb-6">
                <BookOpen className="h-8 w-8 text-gray-700" />
              </div>
              
              <h3 className="heading-secondary mb-6 text-black">Deep Reading Reflection</h3>
              <p className="text-paper-secondary mb-8 text-elegant">
                Not PDF summarization—that&apos;s what ChatGPT does. Instead, Socratic questioning that challenges your understanding and cross-contextual insights that connect everything you read to your research goals.
              </p>
              
              <div className="paper-card paper-subtle border-gray-300 p-4">
                <div className="text-sm text-gray-700 font-medium mb-3 text-elegant">Example Socratic Question:</div>
                <div className="text-paper-secondary italic text-elegant">&ldquo;You mentioned this study&apos;s findings were &lsquo;surprising,&rsquo; but when I cross-reference with the paper you read last month on [related topic], their results actually seem to contradict each other on a fundamental assumption about [core concept]. What might explain this discrepancy—are they studying different populations, using incompatible definitions, or is one of these theoretical frameworks incomplete? How would you design an experiment to resolve this tension?&rdquo;</div>
              </div>
            </div>

            {/* Intelligent Roadmaps */}
            <div className="paper-card paper-spacing-lg">
              <div className="bg-gray-200 w-16 h-16 rounded-xl flex items-center justify-center mb-6">
                <Map className="h-8 w-8 text-gray-700" />
              </div>
              
              <h3 className="heading-secondary mb-6 text-black">Research-Powered Roadmaps</h3>
              <p className="text-paper-secondary mb-8 text-elegant">
                Perplexity integration ensures your roadmaps use the latest academic information. Break down any goal—PhD applications, research skills, professor outreach, lab experience—into actionable, research-backed steps.
              </p>
              
              <div className="flex items-center gap-3 text-sm text-paper-secondary bg-gray-50 rounded-lg p-4 border border-gray-200">
                <Search className="h-4 w-4" />
                <span className="text-elegant">Real-time data from academic sources</span>
              </div>
            </div>

            {/* Personal Companion */}
            <div className="paper-card paper-spacing-lg">
              <div className="bg-gray-200 w-16 h-16 rounded-xl flex items-center justify-center mb-6">
                <Heart className="h-8 w-8 text-gray-700" />
              </div>
              
              <h3 className="heading-secondary mb-6 text-black">Your Research Friend</h3>
              <p className="text-paper-secondary mb-8 text-elegant">
                Name your companion, customize their personality. The UI uses Apple Messages animations because this feels like texting a friend who happens to be brilliant at research.
              </p>
              
              <div className="paper-card paper-subtle border-gray-300 p-4">
                <div className="text-sm text-gray-700 font-medium mb-3 text-elegant">Design Philosophy:</div>
                <div className="text-paper-secondary text-elegant">Words like &quot;AI&quot; and &quot;generate&quot; rarely appear. This is about relationship, not automation.</div>
              </div>
            </div>

            {/* Letters to Future Self */}
            <div className="paper-card paper-spacing-lg">
              <div className="bg-gray-200 w-16 h-16 rounded-xl flex items-center justify-center mb-6">
                <Mail className="h-8 w-8 text-gray-700" />
              </div>
              
              <h3 className="heading-secondary mb-6 text-black">Letters to Future Self</h3>
              <p className="text-paper-secondary mb-8 text-elegant">
                Write time-capsule letters that unseal at perfect moments. Reflect on growth, celebrate milestones, and find motivation exactly when you need it most on the long PhD journey.
              </p>
              
              <div className="paper-card paper-subtle border-gray-300 p-4">
                <div className="flex items-center gap-3 text-paper-secondary text-sm">
                  <Lightbulb className="h-4 w-4" />
                  <span className="text-elegant">Perfect for milestone motivation</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Philosophy Section */}
      <section className="py-20 bg-gray-50">
        <div className="content-wrapper-4xl text-center">
          <h2 className="heading-primary mb-8" style={{ fontFamily: 'Cardo, serif' }}>
            Built from Experience, For Experience
          </h2>
          
          <div className="paper-card paper-elevated paper-spacing-lg">
                         <p className="text-xl text-paper-secondary leading-relaxed mb-8 text-elegant">
               &ldquo;I know future PhD students because I am one. I understand the uncertainty, the preparation anxiety, the need for tools that help you think like a researcher. This isn&apos;t another productivity app—it&apos;s specifically engineered for our journey to graduate school.&rdquo;
             </p>
            
            <div className="flex items-center justify-center gap-8 text-paper-secondary">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-gray-600" />
                <span className="text-elegant">100% Free & Open Source</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-gray-600" />
                <span className="text-elegant">End-to-End Encrypted</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 bg-black text-white">
        <div className="content-wrapper-4xl text-center">
          <h2 className="text-4xl font-bold mb-8" style={{ fontFamily: 'Cardo, serif' }}>
            Start Building Your Path to PhD
          </h2>
          <p className="text-xl text-gray-300 mb-12 max-w-2xl mx-auto text-elegant">
            Every journey to graduate school needs a companion who understands the preparation process. 
            Yours is waiting to meet you.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button 
              onClick={() => signIn("google")}
              className="group bg-white text-black px-8 py-4 rounded-xl font-semibold text-lg hover:bg-gray-100 transition-all duration-200 flex items-center gap-3 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
            >
              <Zap className="h-5 w-5" />
               Start with Google
              <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </button>
            
            <a 
              href="https://github.com/Defying-gravity62442/Ad-Studium"
              target="_blank"
              rel="noopener noreferrer"
              className="border-2 border-gray-600 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:border-gray-500 hover:bg-gray-800 transition-all duration-200 flex items-center gap-3"
            >
              <Users className="h-5 w-5" />
              Self-Host
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-black border-t border-gray-800">
        <div className="content-wrapper-7xl">
          <div className="text-center">
            <div className="flex items-center justify-center mb-6">
              <h3 className="text-2xl font-bold text-white" style={{ fontFamily: 'Cardo, serif' }}>
                Ad Studium
              </h3>
            </div>
            
            <p className="text-gray-400 mb-6 max-w-2xl mx-auto text-elegant">
              Built by an undergrad, for future PhD students. The only AI companion designed specifically for your graduate school preparation journey.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-sm text-gray-400">
              <span className="text-elegant">Questions or feedback?</span>
              <a 
                href="mailto:heming@cs.washington.edu" 
                className="text-gray-300 hover:text-white hover:underline font-medium text-elegant"
              >
                heming@cs.washington.edu
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}