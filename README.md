# Ad Studium

> *Your AI companion for the PhD journey*

**Ad Studium** is a sophisticated reflection and preparation platform built specifically for future PhD students. Unlike general-purpose AI tools, every feature serves one ultimate goal: helping you develop the skills, mindset, and preparation needed for successful PhD applications and research careers.

Built by an undergraduate student for fellow PhD aspirants who understand that the journey to graduate school requires deep thinking, long-term planning, and sustained motivation.

## 🎯 Why Ad Studium?

**The Problem**: Generic AI tools treat every conversation as a "new chat." Your breakthrough from six months ago is forgotten, your reading insights exist in isolation, and your research goals remain disconnected from daily activities.

**The Solution**: A companion that grows with you. Every journal entry, reading reflection, and roadmap becomes part of your evolving story. The longer you use it, the better it understands your research journey.

### Key Differentiators

- **Contextual Memory**: Hierarchical summary system remembers your breakthroughs across months and years
- **Single Purpose**: Every feature designed specifically for PhD preparation—no distractions
- **Personal Companion**: Customize your AI's name and personality; this feels like texting a brilliant research friend
- **Research Integration**: Real-time academic data via Perplexity API ensures current, accurate information
- **End-to-End Encryption**: Your personal data is encrypted with keys only you control

## ✨ Features

### 🧠 Deep Reading Reflection
Move beyond PDF summarization. Our RAG-powered system asks Socratic questions that challenge your understanding and provides cross-contextual insights connecting your readings to broader research goals.

### 🗺️ Research-Powered Roadmaps
Transform ambitious goals into actionable steps. Whether it's PhD applications, developing lab skills, or building professor relationships, our Perplexity integration ensures roadmaps use the latest academic information.

### 💭 Contextual Journaling
Your daily reflections become part of a growing narrative. Our hierarchical summary system ensures your AI companion remembers significant moments and can reference them months later during crucial decisions.

### 📮 Letters to Future Self
Write time-capsule letters that unseal at perfect moments. Celebrate milestones, reflect on growth, and find motivation exactly when you need it most on the long PhD preparation journey.

### 🤝 Your Research Companion
Name your AI, customize their personality, and build a relationship that evolves. The UI deliberately avoids words like "generate" and "AI"—this is about companionship, not automation.

## 🛠️ Technical Stack

- **Frontend**: Next.js 15.4.5, React 19.1.0, TypeScript, Tailwind CSS 4
- **Authentication**: NextAuth.js 4.24.11 with Google OAuth
- **Database**: PostgreSQL with Prisma 6.13.0 ORM
- **AI Integration**: 
  - Anthropic Claude (via Amazon Bedrock) for conversational AI
  - Perplexity API for real-time research data
  - Amazon Titan for PDF embeddings and RAG functionality
- **Security**: End-to-end encryption for all user data
- **PDF Processing**: PDF.js for client-side PDF parsing
- **Deployment**: Vercel-ready with self-hosting options

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Google OAuth credentials
- API keys for Amazon Bedrock (Claude), Perplexity, and Amazon Titan

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/ad-studium.git
   cd ad-studium
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Configure the following variables:
   ```env
   # Database
   DATABASE_URL="postgresql://username:password@localhost:5432/ad_studium"
   
   # NextAuth
   NEXTAUTH_URL="http://localhost:3000"
   NEXTAUTH_SECRET="your-secret-key"
   
   # Google OAuth
   GOOGLE_CLIENT_ID="your-google-client-id"
   GOOGLE_CLIENT_SECRET="your-google-client-secret"
   
   # AI APIs
   AWS_BEARER_TOKEN_BEDROCK="your-aws-bedrock-token"
   BEDROCK_INFERENCE_PROFILE_ID="your-bedrock-profile-id"
   AWS_REGION="us-east-1"
   PERPLEXITY_API_KEY="your-perplexity-api-key"
   ```
   
   **Note**: The current implementation uses Amazon Bedrock for Claude access. If you prefer to use other LLM providers (like direct Anthropic API, OpenAI, etc.), you'll need to modify the AI integration files in `src/lib/ai/`.

4. **Set up the database**
   ```bash
   npx prisma migrate dev
   npx prisma generate
   ```

5. **Run the development server**
   ```bash
   npm run dev
   ```

Visit `http://localhost:3000` to start your PhD preparation journey.

## 📖 Usage

### Getting Started

1. **Sign in** with your Google account
2. **Customize your companion** - give them a name and personality
3. **Set up encryption** - your data is end-to-end encrypted
4. **Create your first roadmap** - break down a PhD-related goal
5. **Start journaling** - begin building your contextual story

### Best Practices

- **Be consistent**: Regular journaling builds the most valuable context
- **Upload papers**: Reading reflection works best with actual academic papers
- **Set real goals**: Roadmaps are most helpful for concrete, time-bound objectives
- **Write letters**: Use future self letters for major milestones and decision points

## 🔒 Privacy & Security

- **End-to-end encryption**: All personal data encrypted with user-controlled keys
- **No tracking**: No analytics, no data selling, no user profiling
- **Data minimization**: Only collects what's necessary for functionality
- **Immediate deletion**: No backups - deleted data is permanently removed
- **Open source**: Full transparency - audit the code yourself
- **Self-hostable**: Run your own instance for complete control

### Data Processing Details

- **Journal entries & personal content**: Fully encrypted at rest
- **PDF documents**: Converted to numerical embeddings for RAG functionality (cannot be reversed to original text)
- **AI interactions**: Decrypted locally, processed through secure relay to third-party providers
- **Calendar data**: Only accessed with explicit permission

## 📄 License

This project is licensed under the **Business Source License 1.1** - see the [LICENSE](LICENSE.md) file for complete terms.

### Key License Provisions

- **Permitted Uses**: Personal, educational, and development use
- **Commercial Restriction**: No commercial hosting, resale, or redistribution without separate license
- **Change Date**: July 25, 2029 - automatically converts to MIT License
- **No Commercial Licenses**: Currently not offering commercial licensing

**Important**: This is a personal project provided free of charge. Commercial use requires separate licensing arrangements.

## 🤝 Contributing

Ad Studium is built by and for the PhD aspirant community. Contributions are welcome!

### Development Setup

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and test thoroughly
4. Commit with clear messages: `git commit -m 'Add amazing feature'`
5. Push to your branch: `git push origin feature/amazing-feature`
6. Open a Pull Request

### Contribution Guidelines

- **Focus on the mission**: Features should serve PhD preparation specifically
- **Maintain quality**: Follow existing code patterns and include tests
- **Consider privacy**: Any new features must respect our privacy-first approach
- **Document changes**: Update relevant documentation

### Areas for Contribution

- **Reading analysis**: Improve RAG pipeline and Socratic questioning
- **Research integration**: Enhance Perplexity API usage for academic sources
- **UI/UX**: Refine the companion-like interface design
- **Performance**: Optimize for large amounts of contextual data
- **Accessibility**: Ensure the app works for all users
- **AI Provider Integration**: Add support for additional LLM providers (OpenAI, direct Anthropic API, etc.)

## 🙋‍♂️ Support & Contact

- **Issues**: [GitHub Issues](https://github.com/yourusername/ad-studium/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/ad-studium/discussions)
- **Email**: [heming@cs.washington.edu](mailto:heming@cs.washington.edu)

## 🎓 About the Creator

Ad Studium was created by an undergraduate student preparing for PhD applications. Having experienced the challenges of research preparation firsthand, this tool represents everything needed for the journey to graduate school—built by someone who truly understands the path.

## ⚖️ Legal Information

### For Hosted Service Users
- **Terms of Service**: [View Terms](https://adstudium.app/TERMS.html)
- **Privacy Policy**: [View Privacy Policy](https://adstudium.app/PRIVACY.html)

### For Self-Hosting
- **License**: [Business Source License 1.1](LICENSE.md) - governs your use of the codebase

### Important Disclaimers

- **Personal Project**: This is a personal open-source project, not a commercial service
- **No Guarantees**: Service provided "as-is" without warranties
- **Data Responsibility**: Users are responsible for their content and data
- **Third-Party Services**: AI and calendar integrations subject to their respective terms

## 🌟 Acknowledgments

- Built for the PhD aspirant community
- Inspired by the need for thoughtful, research-focused tools
- Powered by Claude (Anthropic), Perplexity, and Amazon Bedrock APIs
- Thanks to all future contributors and users

---

*Ready to begin your PhD preparation journey? [Get started now](https://adstudium.app) or star this repository to follow our progress.*