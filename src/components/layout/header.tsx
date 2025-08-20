'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui'

export function Header() {
  const pathname = usePathname()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  
  // Don't show header on homepage or onboarding pages
  if (pathname === '/' || pathname.startsWith('/onboarding')) {
    return null
  }

  const navLinks = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/journal', label: 'Journal' },
    { href: '/roadmap', label: 'Roadmap' },
    { href: '/letter', label: 'Letter' },
    { href: '/reading', label: 'Reading' },
    { href: '/history', label: 'History' },
  ]

  return (
    <header className="header-nav">
      <div className="header-border">
        <div className="header-container">
          <div className="header-content">
            <Link href="/dashboard" className="app-name">
              Ad Studium
            </Link>
            
            {/* Desktop Navigation */}
            <nav className="nav-desktop" data-tutorial="navigation">
              {navLinks.map((link) => (
                <Link 
                  key={link.href}
                  href={link.href} 
                  className={`nav-link ${
                    pathname === link.href 
                      ? 'nav-link-active' 
                      : 'nav-link-inactive'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Desktop Actions */}
            <div className="header-actions">
              <Link href="/settings">
                <Button variant="ghost" size="sm" className="text-sm">
                  Settings
                </Button>
              </Link>
              <Button variant="outline" size="sm" className="text-sm">
                Sign Out
              </Button>
            </div>

            {/* Mobile menu button */}
            <button
              className="mobile-menu-button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Toggle menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isMobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className="mobile-menu">
            <div className="mobile-menu-container">
              <div className="mobile-menu-content">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`mobile-nav-link ${
                      pathname === link.href
                        ? 'mobile-nav-link-active'
                        : 'mobile-nav-link-inactive'
                    }`}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {link.label}
                  </Link>
                ))}
                <div className="mobile-menu-actions">
                  <Link href="/settings" onClick={() => setIsMobileMenuOpen(false)}>
                    <Button variant="ghost" size="sm" className="w-full justify-start text-base h-12">
                      Settings
                    </Button>
                  </Link>
                  <Button variant="outline" size="sm" className="w-full text-base h-12">
                    Sign Out
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}