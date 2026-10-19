import { useEffect, useState } from 'react'

export default function Background() {
  const [playing, setPlaying] = useState(() => !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

  useEffect(() => {
    const preference = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!preference) return
    const update = () => setPlaying(!preference.matches)
    preference?.addEventListener('change', update)
    return () => preference?.removeEventListener('change', update)
  }, [])

  return <>
    <div className="desert-background" aria-hidden="true">
      {playing && <video autoPlay muted loop playsInline preload="metadata" poster="/background/purple-desert.jpg">
        <source src="/background/purple-desert.mp4" type="video/mp4" />
      </video>}
    </div>
    <button className="background-toggle" onClick={() => setPlaying(value => !value)} aria-pressed={playing}>
      <span aria-hidden="true">{playing ? 'Ⅱ' : '▷'}</span> {playing ? 'Pause background' : 'Play background'}
    </button>
  </>
}
