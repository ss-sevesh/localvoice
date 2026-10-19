# Repository presentation

Reference: [Starship's README](https://github.com/starship/starship), reviewed on
2026-10-19. Its centered identity, small badge group, animated product preview,
direct navigation and prominent installation instructions informed the hierarchy.
Flowise's README was also inspected for a visual-first product introduction.
Local Voice uses its own artwork, wording, palette and product capture.

Design contract:

- Keep the midnight desert and lavender voice motif from the application.
- Lead with an animated SVG wordmark, a concise purpose and useful section links.
- Place a playable, audible demonstration in the README itself. Keep original-speed
  and direct-download fallbacks available.
  Use a bare GitHub user-attachment URL: GitHub's repository renderer removes HTML
  video tags, even when the Markdown API accepts them.
- Label 1.25× playback; the on-screen measurements remain original 1× measurements.
- Use one short silent GIF as an interface preview, with a clearly labelled link to
  the full audible video. SVG animation respects reduced-motion preferences.
- Keep all installation, hardware, model, architecture, tests and license information.
  Separate historical measurements from the current same-speaker benchmark.
- Avoid vanity counters, invented CI status, copied branding and unsupported claims.

Verify the published GitHub page, the native video player, image loading, links,
mobile layout, and media duration/audio before finishing.
