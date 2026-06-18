# BLOK. Brand Guidelines v1.0

> Last updated: June 2026
> Status: Draft
> Agency: BLOK. Web Dev Studio

---

## Quick Reference

| Element | Value |
|---------|-------|
| Brand Name | **BLOK.** (always with uppercase letters & period) |
| Tagline | "Creating websites block by BLOK." |
| Primary Color | #202020 |
| Secondary Color | #f2ede7 |
| Heading Font | Space Grotesk (Geometric Sans-Serif) |
| Body Font | Inter (Clean Sans-Serif) |
| Logo Fonts | Lot (headings) + Garet (body) — logo-only, not for web/print copy |
| Voice | Bold, Direct, Quirky, Confident |
| Style | Brutalism meets immersion |

---

## Brand Concept

### The Name

**BLOK.** evokes the fundamental building blocks of the web — HTML elements, components, sections, and modules. The period at the end is intentional: it signals completion, confidence, and closure. Every project is built block by block, solid and finished.

### The Philosophy

```
WE ARE NOT a faceless agency churning out templates.
WE ARE builders who treat every website like a structure —
  each block placed with intention,
  each edge sharp,
  nothing unnecessary.

BOLD ≠ loud.
BRUTALIST ≠ ugly.
CHEAP ≠ low quality.

We make cool stuff for people who thought they couldn't afford it.
```

### Brand Archetype: The Creator + The Rebel

| Archetype | Manifestation |
|-----------|---------------|
| **The Creator** | Building things from raw materials, craftsmanship, attention to detail |
| **The Rebel** | Breaking conventions, brutalist honesty, not trying to please everyone |

---

## 1. Color Palette

### Brand Colors

| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| **BLOK. Black** | #202020 | rgb(32, 32, 32) | Primary brand color, headings, bold elements, dark mode background |
| **BLOK. Ivory** | #f2ede7 | rgb(242, 237, 231) | Secondary brand color, backgrounds, light mode, contrast against dark |

The BLOK. palette is intentionally minimal — just two core colors. This is a feature, not a limitation. The brand lives in the tension between these two extremes.

### Extended Palette

| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| **Pure White** | #ffffff | rgb(255, 255, 255) | Page backgrounds (light mode), card surfaces |
| **Near Black** | #111111 | rgb(17, 17, 17) | Hover states, footer backgrounds |
| **Dark Gray** | #333333 | rgb(51, 51, 51) | Secondary text, captions |
| **Mid Gray** | #666666 | rgb(102, 102, 102) | Muted text, placeholder text |
| **Light Gray** | #cccccc | rgb(204, 204, 204) | Borders, dividers |
| **Off-White** | #f5f5f5 | rgb(245, 245, 245) | Subtle section backgrounds |

### Accent Colors (Use Sparingly)

| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| **BLOK. Red** | #e63946 | rgb(230, 57, 70) | CTAs, alerts, emphasis — use for maximum impact |
| **BLOK. Lime** | #a7c957 | rgb(167, 201, 87) | Positive states, quirky accents, secondary CTAs |
| **BLOK. Cyan** | #00b4d8 | rgb(0, 180, 216) | Links, info, interactive elements |

> **Rule:** Accent colors should cover no more than 10% of any given design. The brand is primarily black + ivory.

### Color Usage by Mode

| Mode | Background | Text Primary | Text Secondary | Accent |
|------|-----------|-------------|----------------|--------|
| **Light** | #f2ede7 / #ffffff | #202020 | #333333 | As needed |
| **Dark** | #202020 / #111111 | #f2ede7 | #cccccc | As needed |

### Accessibility

| Combination | Ratio | Level |
|-------------|-------|-------|
| #202020 on #f2ede7 | 14.8:1 | **AAA** |
| #f2ede7 on #202020 | 14.8:1 | **AAA** |
| #202020 on #ffffff | 16.7:1 | **AAA** |
| #ffffff on #202020 | 16.7:1 | **AAA** |
| #e63946 on #f2ede7 | 6.2:1 | **AA** |
| #00b4d8 on #202020 | 7.1:1 | **AA** |

---

## 2. Typography

### Logo Fonts (Not for General Use)

The **Lot** and **Garet** typefaces used in the BLOK. logo are stylized, licensed fonts reserved exclusively for the logo mark. They are **not** used for body copy, headings on the website, or any other collateral.

### Web & Print Font Stack

```css
/* Headings — Space Grotesk (geometric, blunt, distinctive) */
--font-heading: 'Space Grotesk', 'Inter', system-ui, sans-serif;

/* Body — Inter (clean, readable, neutral) */
--font-body: 'Inter', system-ui, sans-serif;

/* Mono — for code snippets */
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;
```

**Space Grotesk** carries the geometric, slightly quirky spirit of Lot while being freely available on Google Fonts. Its blunt terminals and distinctive shapes match the brutalist aesthetic without competing with the logo.

**Inter** is a highly-readable, neutral sans-serif that lets the bold headings do the heavy lifting — exactly right for a content-forward brutalist approach.

### Type Scale

| Element | Size (Desktop) | Size (Mobile) | Weight | Line Height | Font |
|---------|----------------|---------------|--------|-------------|------|
| Display | 64px | 40px | 700 (Bold) | 0.95 | Space Grotesk |
| H1 | 48px | 32px | 700 (Bold) | 1.0 | Space Grotesk |
| H2 | 36px | 28px | 600 (Semibold) | 1.05 | Space Grotesk |
| H3 | 28px | 24px | 600 (Semibold) | 1.1 | Space Grotesk |
| H4 | 22px | 20px | 600 (Semibold) | 1.2 | Inter |
| Body Large | 20px | 18px | 400 (Regular) | 1.5 | Inter |
| Body | 16px | 16px | 400 (Regular) | 1.6 | Inter |
| Small | 14px | 14px | 400 (Regular) | 1.5 | Inter |
| Caption | 12px | 12px | 400 (Regular) | 1.4 | Inter |
| Code | 14px | 14px | 400 (Regular) | 1.6 | Mono |

### Typography Rules

- **Headings should be tight.** Use negative letter-spacing on display sizes: `-0.03em` for 64px, `-0.02em` for 48px.
- **All-caps** is allowed for labels, tags, and navigation. Use `letter-spacing: 0.05em`.
- **Never justify text.** Left-align always.
- **Line length:** Keep body text to 65–75 characters max.
- **Hierarchy** is primarily achieved through weight and size, not color.
- **Lot & Garet are logo-only.** Never use them for body copy, headings, or UI text — they're reserved exclusively for the logo mark.

### Font Loading (Web)

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
```

---

## 3. Logo Usage

### Logo Variants

| Variant | File | Use Case |
|---------|------|----------|
| Logo Dark | `Logo_Dark.png` | On light backgrounds (#f2ede7, #ffffff) |
| Logo Light | `Logo_Light.png` | On dark backgrounds (#202020, #111111) |
| Icon Dark | `Icon_Dark.png` | Small spaces on light backgrounds |
| Icon Light | `Icon_Light.png` | Small spaces on dark backgrounds |
| Symbol Dark | `Symbol_Dark.png` | Favicon, app icon (dark) |
| Symbol Light | `Symbol_Light.png` | Favicon, app icon (light) |
| Symbol Dark Transparent | `Symbol_Dark_Transparent.png` | Overlay on photography |
| Symbol Light Transparent | `Symbol_Light_Transparent.png` | Overlay on photography |
| Secondary Logo Dark | `Secondary_Logo_Dark_Transparent.png` | Alternative layouts |

### Clear Space

Minimum clear space around the logo = the height of the symbol/mark.

```
    ┌─────────────────────────────┐
    │           [x]               │
    │   ┌───────────────────┐     │
    │   │                   │     │
[x] │   │   [BLOK. LOGO]    │ [x] │
    │   │                   │     │
    │   └───────────────────┘     │
    │           [x]               │
    └─────────────────────────────┘
```

### Minimum Size

| Context | Minimum Width |
|---------|---------------|
| Web — Full Logo | 120px |
| Web — Icon Only | 24px |
| Web — Symbol Only | 32px |
| Print — Full Logo | 30mm |
| Print — Icon | 10mm |

### Logo on Backgrounds

| Background | Which Variant |
|------------|---------------|
| #f2ede7 (Ivory) | Logo_Dark |
| #ffffff (White) | Logo_Dark |
| #202020 (Black) | Logo_Light |
| #111111 (Near Black) | Logo_Light |
| Photography (light) | Symbol_Dark_Transparent |
| Photography (dark) | Symbol_Light_Transparent |
| Accent colors | Logo_Light (white) |

### Logo Don'ts

- ❌ Don't stretch or distort proportions
- ❌ Don't rotate or skew
- ❌ Don't change colors (only #202020 or #f2ede7)
- ❌ Don't add drop shadows or effects
- ❌ Don't apply gradient fills
- ❌ Don't add strokes or outlines
- ❌ Don't crop any portion
- ❌ Don't rearrange the elements
- ❌ Don't place on busy backgrounds without contrast
- ❌ Don't use the period "BLOK" without the period "BLOK."

---

## 4. Voice & Tone

### Brand Personality

| Trait | Description |
|-------|-------------|
| **Bold** | We say what we mean. No fluff, no buzzwords, no corporate speak. |
| **Direct** | We tell you how it is — straightforward, honest, transparent. |
| **Quirky** | We don't take ourselves too seriously. A little weird is welcome. |
| **Confident** | We know our craft. Not arrogant — assured. |
| **Down-to-earth** | We talk to humans, not "stakeholders" or "decision-makers." |

### Voice Chart

| Trait | We Are | We Are Not |
|-------|--------|------------|
| Bold | Direct, declarative | Aggressive, loud for no reason |
| Direct | Clear, straightforward | Rude, dismissive |
| Quirky | Playful, unexpected | Unprofessional, childish |
| Confident | Assured, experienced | Arrogant, know-it-all |
| Down-to-earth | Relatable, human | Casual, sloppy |

### Tone by Context

| Context | Tone | Example |
|---------|------|---------|
| **Homepage** | Bold + welcoming | "Websites built different. Same budget." |
| **Pricing** | Transparent + direct | "Here's what it costs. No hidden fees. No surprises." |
| **Portfolio** | Confident + detailed | "We built this from scratch. Here's how." |
| **Contact** | Friendly + approachable | "Tell us about your thing. We'll see if we click." |
| **Error pages** | Playful + helpful | "Oops. This block went missing. Let's get you back." |
| **Social media** | Quirky + short | "New site dropped. Client's happy. We're proud. Go look." |

### Words We Use

| Use | Avoid |
|-----|-------|
| Build, block, structure | Leverage, synergy, circle back |
| Cool, neat, slick | Revolutionary, game-changing |
| Straight up, honestly | Best-in-class, industry-leading |
| We'll, you'll, let's | Utilize, facilitate |
| Simple, clean, sharp | Seamless, robust, scalable (without context) |

### Sample Copy

**Before (corporate):**
> "We leverage cutting-edge technology to deliver robust, scalable web solutions that optimize your digital presence and drive measurable business outcomes."

**After (BLOK.):**
> "We build websites. Good ones. Fast. And we don't charge you an arm and a leg for it."

**Before (generic):**
> "Our team of experienced professionals is committed to excellence in every project we undertake."

**After (BLOK.):**
> "We're a small team that makes big websites. No suits. No meetings that could've been emails. Just solid work."

---

## 5. Visual Style

### Brutalist Principles

Brutalism in web design is about:

- **Raw honesty** — Don't hide things. Show the structure.
- **Typography-driven** — Let the words do the work. Use big, bold type.
- **Minimal ornamentation** — If it doesn't serve a purpose, remove it.
- **High contrast** — Black and white (or near-white). No soft gradients.
- **Exposed grid** — Let the layout be visible. Don't over-style containers.

### BLOK.'s Brutalism (Softened)

BLOK. takes brutalist principles but softens them with:

- **Warm ivory (#f2ede7)** instead of clinical white — adds humanity
- **Generous whitespace** — brutalist doesn't mean cramped
- **Intentional quirks** — a subtle animation, an unexpected color pop, a playful microcopy
- **Immersive full-bleed sections** — let content breathe edge to edge

### Design Principles

| # | Principle | Description |
|---|-----------|-------------|
| 1 | **Block by block** | Every page is a stack of blocks. Each block does one thing well. |
| 2 | **Say it loud** | If something matters, make it big. Don't whisper your value. |
| 3 | **One cool thing** | Every page gets one "moment" — an animation, a reveal, a surprise. |
| 4 | **Nothing unnecessary** | If you can remove it without losing meaning, remove it. |
| 5 | **Contrast is king** | If everything is the same size/color, nothing matters. |

### Photography & Imagery

| Aspect | Guideline |
|--------|-----------|
| **Style** | Bold, high-contrast, slightly moody. Black & white or desaturated preferred. |
| **Subjects** | Real people, real places. No stock photography clichés. |
| **Overlays** | Use #202020 overlays at 40–60% opacity with white text. |
| **Grain/Texture** | Subtle film grain or paper texture is welcome — adds tactile feel. |
| **Avoid** | Overly polished corporate photos, team handshake photos, generic office shots. |

### Iconography

| Aspect | Guideline |
|--------|-----------|
| **Style** | Outlined, geometric, consistent 2px stroke |
| **Corners** | Sharp (0px radius) — matches brutalist aesthetic |
| **Size** | 24px base grid |
| **Color** | #202020 on light, #f2ede7 on dark |
| **Tone** | Simple, minimal, no fills |

---

## 6. Design Components

### Buttons

| Type | Background | Text | Border | Border Radius | Hover |
|------|------------|------|--------|---------------|-------|
| **Primary** | #202020 | #ffffff | None | 4px | Scale up 1.05x |
| **Secondary** | transparent | #202020 | 2px solid #202020 | 4px | Fill with #202020, text to #ffffff |
| **Accent** | #e63946 | #ffffff | None | 4px | Darken to #c1121f |
| **Ghost** | transparent | #666666 | None | 4px | Text to #202020 |

### Cards

| Property | Value |
|----------|-------|
| Background | #ffffff |
| Border | 2px solid #202020 |
| Border Radius | 0px (sharp) / 4px (optional soft) |
| Padding | 24px |
| Shadow | None (brutalist) |

### Section Spacing

| Token | Value |
|-------|-------|
| Section Padding (Desktop) | 96px / 120px |
| Section Padding (Mobile) | 48px / 64px |
| Block Gap | 24px |
| Content Max Width | 1200px |

### Navigation

| Property | Value |
|----------|-------|
| Background | #202020 or transparent |
| Text | #f2ede7 |
| Active Indicator | 2px underline or filled block |
| Height | 64px / 80px |
| Sticky | Yes |

### Form Inputs

| State | Border | Background | Text |
|-------|--------|------------|------|
| Default | 2px solid #202020 | #ffffff | #202020 |
| Focus | 2px solid #202020 + 4px #f2ede7 ring | #ffffff | #202020 |
| Error | 2px solid #e63946 | #fff5f5 | #202020 |
| Disabled | 2px solid #cccccc | #f5f5f5 | #999999 |

---

## 7. Spacing & Layout

### Spacing Scale

| Token | Value | Usage |
|-------|-------|-------|
| 2xs | 4px | Tiny gaps, icon spacing |
| xs | 8px | Compact elements |
| sm | 12px | Tight spacing |
| md | 16px | Standard gap |
| lg | 24px | Block padding |
| xl | 32px | Large gaps |
| 2xl | 48px | Section margins |
| 3xl | 64px | Major sections |
| 4xl | 96px | Page sections |
| 5xl | 128px | Hero/feature sections |

### Grid

```css
--grid-columns: 12;
--grid-gap: 24px;
--max-width: 1200px;
```

- Use a 12-column grid
- Content max-width: 1200px
- Full-bleed sections are encouraged (hero, showcases, CTAs)

---

## 8. Animation & Motion

### Principles

| Principle | Description |
|-----------|-------------|
| **Purposeful** | Every animation serves a function (reveal, feedback, delight) |
| **Snappy** | Fast transitions (150–300ms). No slow, floaty animations. |
| **Subtle** | If the user notices the animation before the content, it's too much. |
| **One moment** | One "hero" animation per page max. Everything else is subtle. |

### Timing

| Context | Duration | Easing |
|---------|----------|--------|
| Hover states | 150ms | ease-out |
| Page transitions | 300ms | ease-in-out |
| Scroll reveals | 400ms | ease-out |
| Mobile menu | 250ms | ease-out |
| Loading states | 600ms (max) | ease-in-out |

### Recommended Effects

- **Staggered reveals** — Blocks fade in one by one on scroll (100ms stagger)
- **Scale on hover** — Buttons and cards scale to 1.02–1.05x
- **Border draw** — Animated borders that draw in on hover
- **Counter** — Numbers that count up when scrolled into view
- **Magnetic cursor** — (Optional) Elements subtly follow the cursor

---

## 9. AI Image Generation

### Base Prompt Template

Always prepend to image generation prompts:

```
BLOK. brand visual: bold, brutalist, high contrast, immersive, slightly moody.
Dominant colors: #202020 (deep black) and #f2ede7 (warm ivory).
Sharp geometric shapes, blocky compositions, generous negative space.
Editorial photography style with film grain texture.
No gradients, no soft blur, no corporate sterile aesthetic.
```

### Style Keywords

| Category | Keywords |
|----------|----------|
| **Lighting** | High contrast, dramatic, hard shadows, directional |
| **Mood** | Bold, grounded, confident, slightly dark, atmospheric |
| **Composition** | Blocky, geometric, asymmetrical, full-bleed, centered |
| **Treatment** | High contrast monochrome, desaturated, film grain, texture |
| **Aesthetic** | Brutalist, editorial, raw, architectural, minimal |

### Visual Mood Descriptors

- Raw concrete meets warm minimalism
- Architectural precision with human warmth
- Monochrome with intentional pops
- Tactile, textured, physical-feeling digital

### Visual Don'ts

| Avoid | Reason |
|-------|--------|
| Gradients | Conflicts with the raw, flat aesthetic |
| Glossy/glassmorphism | Too polished, not brutalist |
| Busy patterns | Competes with content |
| Corporate stock photos | Inauthentic |
| Soft shadows | Lacks edge — use hard shadows or none |

### Example Prompts

**Hero Background:**
```
BLOK. brand visual: bold, brutalist, high contrast. A massive geometric concrete block structure with warm ivory light spilling through sharp angular gaps. Deep black shadows. Editorial photography style with subtle film grain. Minimal, architectural, immersive. No people. No text.
```

**Social Post:**
```
BLOK. brand visual: A close-up of modular building blocks in #202020 black and #f2ede7 warm ivory. Sharp focus, dramatic side lighting, geometric composition. One block slightly offset for visual tension. Minimal, bold, editorial style. Film grain texture.
```

---

## 10. Deliverables & File Formats

### Logo Files

| File | Usage |
|------|-------|
| `Logo_Dark.png` | Full logo on light backgrounds |
| `Logo_Light.png` | Full logo on dark backgrounds |
| `Icon_Dark.png` | Icon on light backgrounds |
| `Icon_Light.png` | Icon on dark backgrounds |
| `Symbol_Dark.png` | Symbol mark on light |
| `Symbol_Light.png` | Symbol mark on dark |
| `Symbol_Dark_Transparent.png` | Overlay on light photography |
| `Symbol_Light_Transparent.png` | Overlay on dark photography |
| `Secondary_Logo_Dark_Transparent.png` | Alternative logo layout |

> **Recommended additions:** SVG versions of all logo marks for crisp rendering at any size.

### File Naming Convention

```
BLOK._[Variant]_[Color]_[Background].png
Example: BLOK._Logo_Dark.png
         BLOK._Symbol_Light_Transparent.png
```

---

## 11. Brand Compliance Checklist

### Logo
- [ ] Correct variant for background color
- [ ] Sufficient clear space maintained
- [ ] Minimum size requirements met
- [ ] No distortion, rotation, or effects
- [ ] Only #202020 or #f2ede7 colors used

### Colors
- [ ] Primary palette (#202020, #f2ede7) dominates (80%+)
- [ ] Accent colors used sparingly (<10%)
- [ ] Accessible contrast ratios maintained
- [ ] Consistent across all materials

### Typography
- [ ] Space Grotesk for headings
- [ ] Inter for body text
- [ ] Lot & Garet used for logo only (not for body/headings)
- [ ] Appropriate hierarchy (size + weight)
- [ ] No justified text
- [ ] Readable at intended size

### Voice
- [ ] Bold and direct — no corporate fluff
- [ ] Quirky but professional overall
- [ ] Matches BLOK. tone for the context
- [ ] No banned words (synergy, leverage, etc.)

### Visual
- [ ] Brutalist principles followed
- [ ] High contrast maintained
- [ ] Whitespace used generously
- [ ] No unnecessary ornamentation

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | June 2026 | Initial brand guidelines |
