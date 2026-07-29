import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Toaster } from 'sileo'
import 'sileo/styles.css'
import type { FontSize, Contrast, VoiceType } from '../core/theme'
import { useTalkBack } from '../hooks/useTalkBack'
import Header from './Header'
import Footer from './Footer'

export default function Layout() {
  const [fontSize, setFontSize] = useState<FontSize>(() => {
    return (typeof document !== 'undefined'
      ? (document.documentElement.getAttribute('data-font-size') as FontSize)
      : null) ?? 'normal'
  })

  const [contrast, setContrast] = useState<Contrast>(() => {
    return (typeof document !== 'undefined'
      ? (document.documentElement.getAttribute('data-contrast') as Contrast)
      : null) ?? 'light'
  })

  const [talkBackEnabled, setTalkBackEnabled] = useState(false)
  const [voiceType, setVoiceType] = useState<VoiceType>('female')
  const [navOpen, setNavOpen] = useState(false)

  useTalkBack(talkBackEnabled, voiceType)

  useEffect(() => {
    document.documentElement.setAttribute('data-font-size', fontSize)
  }, [fontSize])

  useEffect(() => {
    document.documentElement.setAttribute('data-contrast', contrast)
  }, [contrast])

  return (
    <div className="flex min-h-screen flex-col">
      <Header
        fontSize={fontSize}
        onFontSizeChange={setFontSize}
        contrast={contrast}
        onContrastChange={setContrast}
        talkBackEnabled={talkBackEnabled}
        onTalkBackToggle={() => setTalkBackEnabled((p) => !p)}
        voiceType={voiceType}
        onVoiceTypeChange={setVoiceType}
        navOpen={navOpen}
        onNavToggle={() => setNavOpen((p) => !p)}
      />
      <main className="mx-auto w-full max-w-[1400px] flex-1 overflow-x-hidden px-4 py-6 md:px-8 lg:px-12">
        <Outlet />
      </main>
      <Footer />
      <Toaster
        position="top-center"
        options={{ fill: '#ffffff', roundness: 14, duration: 5000, autopilot: true }}
      />
    </div>
  )
}
