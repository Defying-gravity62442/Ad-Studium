'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { LayoutDashboard, PenTool, Map, Mail, BookOpen, Archive } from 'lucide-react'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Journal', href: '/journal', icon: PenTool },
  { name: 'Roadmap', href: '/roadmap', icon: Map },
  { name: 'Letter to Future Self', href: '/letter', icon: Mail },
  { name: 'Reading Reflection', href: '/reading', icon: BookOpen },
  { name: 'History', href: '/history', icon: Archive },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <div className="flex flex-col w-64 bg-white border-r border-gray-200">
      <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
        <div className="flex items-center flex-shrink-0 px-4">
          <h1 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Cardo, serif' }}>Ad Studium</h1>
        </div>
        <nav className="mt-5 flex-1 px-2 space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  pathname === item.href
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                  'group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200'
                )}
              >
                <Icon className={cn(
                  'mr-3 h-5 w-5 transition-colors duration-200',
                  pathname === item.href
                    ? 'text-gray-700'
                    : 'text-gray-500 group-hover:text-gray-700'
                )} />
                {item.name}
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}