import Background from './Background'
import Brand from './Brand'
import type { User } from './auth'

export default function Landing({ user }: { user: User | null }) {
  const destination = user ? '#/app' : '#/signup'
  return <div className="app-shell marketing-shell">
    <Background />
    <header className="site-header marketing-header">
      <Brand />
      <nav className="marketing-nav" aria-label="Main navigation"><a href="#how-it-works">How it works</a><a href="#privacy">Privacy</a></nav>
      <div className="header-actions"><a className="nav-login" href={user ? '#/app' : '#/login'}>{user ? 'Open workspace' : 'Log in'}</a><a className="button-link compact" href={destination}>{user ? 'Continue' : 'Get started'} <span aria-hidden="true">↗</span></a></div>
    </header>
    <main className="landing-main" id="main-content" tabIndex={-1}>
      <section className="landing-hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow hero-label"><span className="tiny-dot" /> YOUR VOICE. YOUR SPACE.</p>
          <h1 id="hero-title" tabIndex={-1}>A little space<br />for your <em>big thoughts.</em></h1>
          <p className="hero-description">Think out loud. Find your words. Meet a voice companion that listens in your language—and keeps the conversation on your device.</p>
          <div className="hero-actions"><a className="button-link" href={destination}>{user ? 'Back to your workspace' : 'Find your thinking space'} <span aria-hidden="true">↗</span></a><a className="quiet-link" href="#how-it-works">See how it works <span aria-hidden="true">↓</span></a></div>
          <p className="hero-footnote">English, Hindi & a little of both. Entirely local inference.</p>
        </div>
        <div className="conversation-preview" aria-label="Example conversation, not a live session">
          <div className="preview-top"><span><span className="tiny-dot" /> A MOMENT OF CLARITY</span><span>01 / 01</span></div>
          <div className="preview-orbit" aria-hidden="true"><span className="preview-ring" /><span className="preview-core"><span className="wave-mark">{[0, 1, 2, 3, 4].map(i => <span key={i} />)}</span></span></div>
          <div className="preview-dialogue"><p className="eyebrow">YOU</p><p>“I have an idea. Can we<br />think it through together?”</p><div className="preview-response"><span aria-hidden="true">✦</span><p>Of course. Start wherever<br />your mind takes you.</p></div></div>
          <div className="preview-bottom"><span>EXAMPLE CONVERSATION</span><span>Made for natural conversation</span></div>
        </div>
      </section>
      <section className="benefit-strip" aria-label="At a glance"><p><span>01</span> Your language, naturally.</p><p><span>02</span> A voice, not a text box.</p><p><span>03</span> On your device. In your control.</p></section>
      <section className="how-section" id="how-it-works" aria-labelledby="how-title">
        <div className="section-intro"><p className="eyebrow">LESS SETUP. MORE CONVERSATION.</p><h2 id="how-title">From a thought<br />to a conversation.</h2><p>No perfect prompts required. Just a microphone and a moment to yourself.</p></div>
        <ol className="steps"><li><span>01</span><div><h3>Make yourself at home.</h3><p>Create your local account and enter your personal voice workspace.</p></div></li><li><span>02</span><div><h3>Say what’s on your mind.</h3><p>Speak in English, Hindi, or Hinglish. Pause when you’re ready for a reply.</p></div></li><li><span>03</span><div><h3>Let the conversation flow.</h3><p>Listen, explore an idea, or speak to interrupt. It’s a conversation at your pace.</p></div></li></ol>
      </section>
      <section className="privacy-section" id="privacy" aria-labelledby="privacy-title"><div><p className="eyebrow">PRIVATE BY DESIGN</p><h2 id="privacy-title">Some thoughts deserve<br />to stay close.</h2></div><div><p>Recognition, responses, and voice synthesis run locally. Conversations live in your current session and aren’t saved to your account.</p><p className="privacy-detail">Account details stay on this machine. Your email is a local login identifier; we don’t send email or verify ownership.</p><a href={destination} className="quiet-link">Your space is waiting <span aria-hidden="true">↗</span></a></div></section>
      <footer className="marketing-footer"><Brand /><span>Built for the way you think.</span><a href="#/login">Your workspace <span aria-hidden="true">↗</span></a></footer>
    </main>
  </div>
}
