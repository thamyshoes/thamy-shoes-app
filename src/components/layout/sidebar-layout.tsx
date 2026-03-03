'use client'

import { useState, useCallback } from 'react'
import { Sidebar } from './sidebar'
import { Header } from './header'
import type { UserSession } from '@/types'

interface SidebarLayoutProps {
  user: UserSession
  children: React.ReactNode
}

export function SidebarLayout({ user, children }: SidebarLayoutProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  const openDrawer = useCallback(() => setDrawerOpen(true), [])
  const closeDrawer = useCallback(() => setDrawerOpen(false), [])

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <div className="hidden md:flex">
        <Sidebar perfil={user.perfil} />
      </div>

      {/* Mobile drawer overlay */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={closeDrawer}
            aria-hidden="true"
          />
          <div className="relative z-50 h-full w-56 animate-in slide-in-from-left duration-200">
            <Sidebar perfil={user.perfil} onNavigate={closeDrawer} />
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header user={user} onMenuClick={openDrawer} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  )
}
