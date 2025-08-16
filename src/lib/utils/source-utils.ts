export type SourceType =
  | 'official'
  | 'publisher'
  | 'preprint'
  | 'video'
  | 'blog'
  | 'forum'
  | 'social'
  | 'reference'
  | 'code'
  | 'docs'
  | 'news'
  | 'course'
  | 'unknown'

function getHostname(url: string): string | null {
  try {
    const u = new URL(url)
    return u.hostname.toLowerCase()
  } catch {
    return null
  }
}

export function inferSourceType(url: string, title?: string): SourceType {
  const hostname = getHostname(url) || ''
  const host = hostname.replace(/^www\./, '')
  const lowerTitle = (title || '').toLowerCase()

  // Official academic/government
  if (/\.edu(\.|$)/i.test(host) || /\.gov(\.|$)/i.test(host) || /\.mil(\.|$)/i.test(host)) {
    return 'official'
  }

  // Docs subdomains
  if (host.startsWith('docs.') || host.includes('.docs.')) {
    return 'docs'
  }

  // Video platforms
  if (/youtube\.com|youtu\.be|vimeo\.com|bilibili\.com/.test(host)) {
    return 'video'
  }

  // Preprint servers
  if (/arxiv\.org|biorxiv\.org|medrxiv\.org/.test(host)) {
    return 'preprint'
  }

  // Academic/publisher portals
  if (
    /nature\.com|science\.org|cell\.com|springer\.com|springeropen\.com|link\.springer\.com|tandfonline\.com|ieee\.org|ieeexplore\.ieee\.org|acm\.org|dl\.acm\.org|oup\.com|oxfordacademic\.com|cambridge\.org|sagepub\.com|wiley\.com|onlinelibrary\.wiley\.com|sciencedirect\.com|elsevier\.com|pnas\.org/.test(
      host
    )
  ) {
    return 'publisher'
  }

  // Code repositories
  if (/github\.com|gitlab\.com|bitbucket\.org/.test(host)) {
    return 'code'
  }

  // Reference sites
  if (/wikipedia\.org|britannica\.com/.test(host)) {
    return 'reference'
  }

  // Courses/learning
  if (/khanacademy\.org|coursera\.org|edx\.org|udacity\.com|udemy\.com|classcentral\.com/.test(host)) {
    return 'course'
  }

  // Forums/Q&A
  if (/stackoverflow\.com|stackexchange\.com|reddit\.com|hackernews\.com|news\.ycombinator\.com|quora\.com/.test(host)) {
    return 'forum'
  }

  // Social
  if (/x\.com|twitter\.com|linkedin\.com|facebook\.com|instagram\.com|tiktok\.com/.test(host)) {
    return 'social'
  }

  // News media
  if (
    /nytimes\.com|theguardian\.com|washingtonpost\.com|wsj\.com|bbc\.co\.uk|bbc\.com|reuters\.com|apnews\.com|bloomberg\.com|ft\.com|cnbc\.com|forbes\.com/.test(
      host
    )
  ) {
    return 'news'
  }

  // Blogs
  if (/medium\.com|substack\.com|dev\.to|hashnode\.com/.test(host) || host.startsWith('blog.')) {
    return 'blog'
  }

  // Fall back on hints from title
  if (lowerTitle.includes('arxiv')) return 'preprint'
  if (lowerTitle.includes('official')) return 'official'
  if (lowerTitle.includes('guide') || lowerTitle.includes('docs')) return 'docs'
  if (lowerTitle.includes('tutorial') || lowerTitle.includes('course')) return 'course'

  return 'unknown'
}


