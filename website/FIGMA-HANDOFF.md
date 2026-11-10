# Figma Handoff

## Frames

- Desktop: `1440 × 900`, use `preview-desktop.png` as the editable-layout reference.
- Mobile: `390 × 844`, use `preview-mobile.png` as the editable-layout reference.
- Site width: max `1440px`; desktop page inset `32px`; mobile inset `16px`.
- Section rhythm: `112px` desktop / `76px` mobile vertical padding.

## Sections

1. Fixed navigation, height `72px` desktop / `64px` mobile.
2. Hero: left thesis, right real HarmonyOS screenshot, generated pantry graph background.
3. Problem: statement grid and resource still life.
4. Product loop: four tabs and one real interface stage.
5. Trusted AI: dark editorial section and mechanism console.
6. Personal graph: diagram plus local/global/multi-hop modes.
7. Multi-device: asymmetric Web, tablet and mini program collage.
8. Engineering proof: ledger rows, capability boundary and CTAs.
9. Footer: project and team facts.

## Type

- Display: Noto Serif SC / Source Han Serif SC / Songti SC.
- UI: HarmonyOS Sans SC / Noto Sans SC / Microsoft YaHei.
- Hero: 64px desktop / 40px mobile, weight 800, line-height 1.14.
- Section heading: 68px max desktop / 46px mobile.
- Body: 16px, line-height 1.65.
- Labels: 11px, uppercase or tabular where appropriate.

## Color Tokens

Use `tokens.css` as the source of truth. Primary surfaces:

- Deep navy: `--navy-950` / `--navy-900`.
- Reading surface: `--paper-50` / `--paper-100`.
- Primary green: `--brand-600`; action highlight: `--mint-300`.
- Data cyan: `--cyan-600`; relationship mint: `--teal-500`.
- Ink: `--ink-900` / `--ink-700` / `--ink-500`.

## Components

- Buttons: 50px height, 8px radius, primary mint and outline dark.
- Device frames: real screenshots only, 24-38px radii.
- Tabs: 4 states, `aria-selected=true` uses navy surface.
- Lightbox: native dialog, 16px radius, 92dvh max image height.
- Evidence ledger: line-separated rows, no table borders.

## Notes

The Figma connector in this session requires authentication, so no remote Figma file was created or modified. These frames and tokens are ready to be imported and rebuilt with Auto Layout once access is available.
