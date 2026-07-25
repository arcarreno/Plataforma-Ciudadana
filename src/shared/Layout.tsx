import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import type { FontSize } from '../core/theme'
import { useTalkBack } from '../hooks/useTalkBack'
import Header from './Header'
import Footer from './Footer'

export default function Layout() {
  const [fontSize, setFontSize] = useState<FontSize>(() => {
    return (typeof document !== 'undefined'
      ? (document.documentElement.getAttribute('data-font-size') as FontSize)
      : null) ?? 'normal'
  })

  const [talkBackEnabled, setTalkBackEnabled] = useState(false)
  const [navOpen, setNavOpen] = useState(false)

  useTalkBack(talkBackEnabled)

  useEffect(() => {
    document.documentElement.setAttribute('data-font-size', fontSize)
  }, [fontSize])

  return (
    <div className="flex min-h-screen flex-col">
      <Header
        fontSize={fontSize}
        onFontSizeChange={setFontSize}
        talkBackEnabled={talkBackEnabled}
        onTalkBackToggle={() => setTalkBackEnabled((p) => !p)}
        navOpen={navOpen}
        onNavToggle={() => setNavOpen((p) => !p)}
      />
      <main className="mx-auto w-full max-w-[1400px] flex-1 overflow-x-hidden px-4 py-6 md:px-8 lg:px-12">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
