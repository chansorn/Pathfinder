---
name: "PathFinder Academic GPS"
description: "Low-stress, structured Thai/English educational guidance design system built around an off-white canvas, deep navy navigation authority, compass emerald progress, and warm amber Beyond 4.00 highlights."
---

## Overview

PathFinder is a calm, modern editorial university admission and career discovery companion for high school students navigating Thailand's TCAS system. Its academic daylight aesthetic avoids dark-mode tech tropes in favor of **Warm Alabaster** paper (`#FAF9F6`), **Deep Sage** ink (`#1F3A3D`), **Eucalyptus Green** progress badges (`#6B9080`), **Warm Sand** card containers (`#EAE4D7`), and **Muted Terracotta** highlights (`#D98A4E`).

## Colors

The palette preserves PathFinder's exact academic daylight colors paired with contrast-verified container and ink tones from the tonal spread.

- **Warm Alabaster (`#FAF9F6`) / Surface:** Soft paper cream canvas with subtle organic divider lines.
- **Deep Sage (`#1F3A3D`) / Primary:** Grounded forest slate for editorial headlines and primary rounded buttons.
- **Eucalyptus Green (`#6B9080`) / Secondary:** Progress badges and completed milestone indicators, paired with deep forest ink (`#12372A` / `#2A4D40`) for AA contrast.
- **Warm Sand (`#EAE4D7`) / Surface Container:** Tactile warm-sand card containers and secondary surfaces.
- **Muted Terracotta (`#D98A4E`) / Tertiary:** Subtle highlights for "Beyond 4.00" and key accents, paired with deep umber ink (`#301400` / `#713700`).

```yaml
colors:
  warm-alabaster: "#FAF9F6"
  deep-sage: "#1F3A3D"
  eucalyptus-green: "#6B9080"
  warm-sand: "#EAE4D7"
  muted-terracotta: "#D98A4E"
  primary: "#1F3A3D"
  on-primary: "#FFFFFF"
  primary-container: "#D9F6FA"
  on-primary-container: "#021F22"
  secondary: "#6B9080"
  on-secondary: "#002116"
  secondary-container: "#D2FAE7"
  on-secondary-container: "#12372A"
  secondary-text: "#2A4D40"
  tertiary: "#D98A4E"
  on-tertiary: "#301400"
  tertiary-container: "#FFEDE4"
  on-tertiary-container: "#4F2500"
  tertiary-text: "#713700"
  surface: "#FAF9F6"
  on-surface: "#1F3A3D"
  surface-container-lowest: "#FDFCF9"
  surface-container-low: "#EAE4D7"
  surface-container: "#E3E2E0"
  on-surface-variant: "#464745"
  outline: "#777775"
  outline-variant: "#C7C6C4"
  error: "#BA1A1A"
  on-error: "#FFFFFF"
```

## Typography

PathFinder uses **Google Sans** across headlines, body copy, and UI labels (paired with **Noto Sans Thai Looped** for Thai script coverage and **JetBrains Mono** for tabular match scores and metrics).

```yaml
typography:
  display-lg:
    fontFamily: "Google Sans"
    fontSize: 44px
    fontWeight: 700
    lineHeight: 54px
    letterSpacing: -0.4px
  display-lg-mobile:
    fontFamily: "Google Sans"
    fontSize: 30px
    fontWeight: 700
    lineHeight: 38px
    letterSpacing: -0.2px
  headline-lg:
    fontFamily: "Google Sans"
    fontSize: 34px
    fontWeight: 700
    lineHeight: 42px
    letterSpacing: -0.2px
  headline-lg-mobile:
    fontFamily: "Google Sans"
    fontSize: 24px
    fontWeight: 700
    lineHeight: 32px
    letterSpacing: 0px
  headline-md:
    fontFamily: "Google Sans"
    fontSize: 22px
    fontWeight: 700
    lineHeight: 30px
    letterSpacing: 0px
  title-lg:
    fontFamily: "Google Sans"
    fontSize: 20px
    fontWeight: 600
    lineHeight: 28px
    letterSpacing: 0px
  title-md:
    fontFamily: "Google Sans"
    fontSize: 16px
    fontWeight: 600
    lineHeight: 24px
    letterSpacing: 0px
  body-lg:
    fontFamily: "Google Sans"
    fontSize: 17px
    fontWeight: 400
    lineHeight: 28px
    letterSpacing: 0px
  body-md:
    fontFamily: "Google Sans"
    fontSize: 15px
    fontWeight: 400
    lineHeight: 24px
    letterSpacing: 0px
  label-lg:
    fontFamily: "Google Sans"
    fontSize: 15px
    fontWeight: 600
    lineHeight: 20px
    letterSpacing: 0px
  label-md:
    fontFamily: "Google Sans"
    fontSize: 13px
    fontWeight: 600
    lineHeight: 18px
    letterSpacing: 0.1px
  label-sm:
    fontFamily: "Google Sans"
    fontSize: 12px
    fontWeight: 600
    lineHeight: 16px
    letterSpacing: 0.2px
  metric-md:
    fontFamily: "JetBrains Mono"
    fontSize: 14px
    fontWeight: 600
    lineHeight: 20px
    letterSpacing: 0px
```

## Layout & Spacing

The layout uses a **Fluid Grid** on mobile (`390px`, 16px page margins, single-column stack) and a **Fixed-Max-Width 12-Column Grid** on desktop (`max-width: 1200px`, 24px–32px page margins, 24px gutters). Every spacing value adheres to a strict 4px/8px rhythm so cards, stepper tracks, and waypoint lists align cleanly.

```yaml
spacing:
  gutter-xs: 4px
  gutter-sm: 8px
  gutter-md: 16px
  gutter-lg: 24px
  gutter-xl: 32px
  section: 48px
  page-margin: 24px
```

## Elevation & Depth

PathFinder uses **Tonal Layering + Low-Contrast Outlines** rather than heavy drop shadows. The `#F8FAFC` canvas sits at the base; interactive cards and route previews sit on crisp `#FFFFFF` (`surface-container-lowest`) with `1px` `outline-variant` borders (`#C4C7C9`) and subtle ambient lift only on primary floating elements.

## Shapes

Organic, relaxed geometry inspired by rounded study notebooks and hand-drawn route pins: full pills (`full`) for interest tags and status chips, `12px` (`md`) for buttons, and generous `20px` (`lg`) corners for cards.

```yaml
rounded:
  sm: 8px
  DEFAULT: 12px
  md: 14px
  lg: 20px
  xl: 28px
  full: 9999px
```

## Motion & Micro-interaction

Motion is calm, crisp, and purposeful—like a GPS locking onto a route. Interactive buttons and pill tags respond within `120ms`, while route cards and drawers enter smoothly over `240ms` with deceleration easing. Honor `prefers-reduced-motion` and animate only `transform`, `opacity`, and color.

```yaml
motion:
  state-change:
    duration: 120ms
    delay: 0ms
    timingFunction: ease-out
  surface-enter:
    duration: 240ms
    delay: 0ms
    timingFunction: cubic-bezier(0.2, 0, 0, 1)
  surface-exit:
    duration: 160ms
    delay: 0ms
    timingFunction: cubic-bezier(0.3, 0, 1, 1)
```

## Voice & Content Strategy

- **Tone of voice:** Encouraging, structured, and clear—like a knowledgeable senior mentor who turns overwhelming TCAS rules into a calm step-by-step map. Bilingual Thai/English: Thai for primary student-facing guidance and CTAs, English for standardized terms (`TCAS`, `GPAX`, `TGAT/TPAT`, `Beyond 4.00`, `AI GPS`).
- **Button and action labels:** Action-oriented verb phrases naming the next step (e.g., `เริ่มต้นค้นหาเส้นทางของคุณ`, `ล็อกเส้นทางนี้`, `ปรับเส้นทางใหม่`).
- **Numbers & trust:** Use `tabular-nums` for GPAX (`4.00`), match percentages (`94%`), and countdowns (`8 เดือน`). Always include a clear reminder to verify official yearly weightings on `mytcas.com`.

## Components

Component implementations live as individual HTML sticker sheet files in
`components/`. Each file contains the canonical, styled HTML components with
`<!-- COMPONENT: name -->` comment markers. Read each file before use.

- **Button** → `@components/button.html`: `button-primary`, `button-icon`, `button-with-icon`
- **Card** → `@components/card.html`: `card-elevated`, `card-action`, `card-interactive`, `card-interactive-2`
- **Chip** → `@components/chip.html`: `chip-action`, `chip-input`, `chip-with-icon`
- **Progress Bar** → `@components/progress-bar.html`: `progress-bar-default`
