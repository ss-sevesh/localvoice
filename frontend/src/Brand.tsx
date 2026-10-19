export default function Brand() {
  return <a href="#/" className="brand" aria-label="Local Voice home">
    <span className="brand-symbol" aria-hidden="true"><span className="wave-mark small">{[0, 1, 2, 3, 4].map(i => <span key={i} />)}</span></span>
    <span>local<span className="brand-light">voice</span><span className="brand-dot">.</span></span>
  </a>
}
