# BLOK. Brand Spec (extracted)

## Color Tokens

| Token | Value (Hex) | Value (OKLch) | Usage |
|-------|-------------|----------------|-------|
| `--bg` | #f2ede7 | oklch(94.5% 0.012 80) | Page background (light) |
| `--bg-dark` | #202020 | oklch(15% 0.01 250) | Page background (dark) |
| `--surface` | #ffffff | oklch(100% 0 0) | Card/surface |
| `--surface-dark` | #111111 | oklch(8% 0.005 250) | Footer/hover |
| `--fg` | #202020 | oklch(15% 0.01 250) | Primary text |
| `--fg-dark` | #f2ede7 | oklch(94.5% 0.012 80) | Text on dark |
| `--muted` | #666666 | oklch(50% 0.01 250) | Secondary text |
| `--muted-dark` | #cccccc | oklch(85% 0.005 250) | Muted text on dark |
| `--border` | #cccccc | oklch(85% 0.005 250) | Borders |
| `--border-dark` | #333333 | oklch(30% 0.01 250) | Borders on dark |
| `--accent` | #e63946 | oklch(55% 0.2 25) | CTAs, emphasis |
| `--accent-secondary` | #00b4d8 | oklch(65% 0.16 230) | Links, interactive |
| `--accent-tertiary` | #a7c957 | oklch(75% 0.15 120) | Positive states |

## Font Stacks

- **Display:** `'Space Grotesk', 'Inter', system-ui, sans-serif`
- **Body:** `'Inter', system-ui, sans-serif`
- **Mono:** `'JetBrains Mono', 'Fira Code', monospace`

## Layout Posture

- Brutalist principles: raw honesty, typography-driven, minimal ornamentation, high contrast, exposed grid
- **Radii:** 0px (sharp) or 4px (optional soft) — no rounded cards
- **Borders:** 2px solid, full-strength fg, not muted
- **Shadows:** None (brutalist) — no drop shadows, no glassmorphism
- **Accent budget:** ≤10% of any design; brand is primarily black + ivory
- **Section spacing:** 96–120px desktop, 48–64px mobile
- **Content max-width:** 1200px
- **Full-bleed sections:** encouraged (hero, showcases, CTAs)
- **One "moment" per page:** one hero animation, everything else subtle
- **Grid:** 12 columns, 24px gap
