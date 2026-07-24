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
      />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
