# Squeek Exit & Merge Planner design

## Overview

A working holder utility for entering a portfolio, reading an ordered merge plan and comparing exit scenarios. The visual system uses an off-white workspace, plain white input sections, one dark power result, and a burnt-orange primary action. Forms precede results; the small public feed is supporting context. There is no marketing hero, decorative chart, wallet control or persistent floating overlay.

The implementation is in `src/main.tsx` and `src/styles.css`. The product heading and **Load demo portfolio** action are visible on the first 390×844 screen, confirmed in Chromium. The final design was reviewed against all six pinned Better Interface domains; evidence and limits are in `VALIDATION.md`.

## Colors

Canonical CSS values are in the `:root` block of `src/styles.css`. Use the semantic tokens already consumed by a component; do not substitute a border token for text.

| Token | Value | Implemented role |
| --- | --- | --- |
| `--surface` | `#ffffff` | Input sections and fields |
| `--ink` | `#202733` | Main text and headings |
| `--muted` | `#596372` | Hints, labels and timestamps |
| `--line` | `#dce0e6` | Structural section and row borders |
| `--input-border` | `#929caa` | Interactive field/secondary-button boundaries |
| `--accent` | `#bc401b` | Primary button, brand mark, DEMO text and exit warning rule |
| `--accent-hover` | `#9d3011` | Primary button hover |
| `--navy` | `#202c3c` | Power result background |
| `--navy-text` | `#f8fafc` | Power numbers and links |
| `--navy-muted` | `#bdc8d6` | Supporting power-panel text |
| `--success` | `#256047` | Calculated gain and LIVE labels |
| `--error` | `#a62d22` | Input errors |
| `--focus` | `#245ec5` | 3px focus outline, offset 4px |

The page background is `#f5f6f8`. The power-panel focus outline uses `#f8fafc` against navy. Disabled controls use pale neutral fills with readable text. The exit warning uses `#78391f` text and an orange leading rule. Status is always written as text as well as color: LIVE, STALE, OFFLINE, UNKNOWN, DEMO. Do not imply readiness with color when cooldown is unknown. There is one intentional light theme; system forced colors have a dedicated focus/boundary adjustment.

The final probe measured resolved solid text/background pairs and passed its 4.5:1 normal / 3:1 large-text thresholds. This is not a full accessibility certification.

## Typography

Use the platform sans-serif stack: `ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`. No external font requests or font assets are required. The only monospace area is the optional manual-copy text area, where the plan is selectable data.

Six sizes are defined in `src/styles.css`: `--sm` 14px, `--body` 16px, `--subheading` 20px, `--heading` 24px, `--metric` 32px and `--display` 40px at the default root size. The interface uses weights 400 and 600. Body line-height is 1.5; headings 1.25; formula text 1.8. Inputs remain 16px on phones. Numeric outputs, timestamps and inputs use tabular figures.

The desktop H1 and total power are 40px with −0.035em tracking. H1 becomes 32px below 1100px; mobile power is 32px. Section headings are 20px on desktop and 16px on phones. All-caps status acronyms are explicit data labels, not heading kickers. Long numbers wrap instead of being clipped. Headings balance; supporting prose uses pretty wrapping and a bounded measure in the About/formula content.

## Layout

The shared content width is at most 1280px. At 1440px it has 80px side margins; below 1360px, 40px margins; below 800px, 24px; below 540px, 16px. Use 8px within a field, 16–24px between related controls and 24–32px between sections. Section padding is 28px, reduced to 24px and then 20px as the content narrows.

Desktop `.workspace` has a flexible main column plus a 340px sidebar, reduced to 300px below 1100px. Below 800px the wrappers become `display: contents` and the visible order is portfolio → power → merge plan → public feed. This keeps the result next to the task on a phone without duplicating state.

`.levels` has five columns, three in the narrower desktop layout, five again when the workspace becomes a single wide column, and two below 540px. The exit section uses a smaller inputs column and larger comparison column on desktop, then stacks below 800px. Intermediate-width exit inputs form two columns; below 540px they stack. JSON export buttons stack to full width on phones. The About section changes from two columns to one. Nothing is fixed or sticky over content.

Observed reflow widths: 320, 390, 768, 1024 and 1440px, including a demo and maximum supported values. A 390px viewport with text enlarged to 200% also had no document overflow. These are Chromium checks, not native zoom or physical-device observations.

## Elevation & Depth

The interface is flat. White `.surface` sections have a 1px structural border; the navy power panel is distinguished by tone. There are no shadows or gradient text. Internal rows use dividers only when comparing values. Eligibility information is inline with an information icon; the consequential exit warning has a leading rule. Avoid introducing a second rounded surface inside a section.

## Shapes

Desktop section and power-panel radii are 16px, reduced to 12px on phones. Inputs and buttons use 8px. The compact brand mark uses 12px, or 9px in the phone header. Progress is a 6px rail with 4px rounding. Count labels use small square level markers; feed indicators are circles. Neither kind of marker conveys information without its text.

## Components

- `Icon` in `src/main.tsx`: local 24-unit SVG paths, current-color outline, 1.7px stroke. Icons are decorative and hidden from assistive technology; visible labels name actions.
- `External`: a normal link with destination text and a small external-link glyph. Opens a new tab with `rel="noreferrer"`.
- `Field`: labelled decimal text input, optional marker, persistent hint, and adjacent errors via `aria-describedby`/`aria-invalid`. Input range and six-decimal precision are checked without losing typed text.
- `.button.primary`, `.secondary`, `.subtle`: 44px minimum button height; orange emphasis, outlined secondary, neutral utility. Hover changes only background/border over 120ms. Native disabled state is used when a complete export or live stake import is unavailable.
- `.level-field`: named numeric count, level and its fixed whole-number power. Uses a real fieldset/legend and labels, not placeholder labels.
- `.power-panel`: named live `output` for total power, definition list for P/Q/boost/share, and native formula disclosure. Updating a number never hides a complete value.
- `.merge-steps`: ordered original-inventory pairs with pair before/after power, cumulative gain and cooldown caveat. Six rows are initially visible in a large plan; an explicit button reveals the remainder. The final portfolio and total gain remain below the list.
- `.comparison-table`: consistent Estimate / Now / After midnight columns with table roles, seven metrics in the same order. Unknown daily inputs remain written as Unknown. The timing note explains assumptions next to the comparison.
- `.feed-panel`: per-endpoint LIVE/STALE/OFFLINE/UNKNOWN states, timestamped historical readings, optimistic projection labels and retry status. DEMO affects planning inputs only. No simulated wheel reading is bundled as an application fallback.
- `.export-bar`: copy/download actions, completion errors and a polite status message. Clipboard rejection reveals a selected, focused textarea with manual copy text. No modal or focus trap is needed.
- Native `details`/`summary`: power and fee formulas. Native keyboard behavior and visible focus are retained.

The skip link, Tab/Enter path, visible action focus, invalid forms and copy fallback were exercised in Chromium. Reduced motion disables smooth scrolling and transitions. There is no entrance or continuous animation. Screen-reader announcements were not tested with an actual screen reader.

## Do’s and Don’ts

Reuse the existing surface, field, button, row and output patterns when adding a planning section. Put inputs above their result, keep assumptions beside the affected result and use the shared six-size scale. Let values wrap and maintain 44px form controls. Prefer a native disclosure for explanatory detail.

Keep DEMO inputs explicitly labelled and distinct from timestamped public-feed evidence. Preserve unknown states, eligibility checks and fee warnings. Do not add trading controls, wallet code, mainnet claims, earnings estimates, gradients, nested cards or automatic cascaded merge rounds to this product.

Design guidance: Jakub Krehel, Better Interface (MIT), pinned commit `267330e1adfc66a718fb65fa6918c1f06d0a689e`; documentation method: Paul Bakaus, Impeccable (Apache-2.0), pinned commit `9d715cc4f5564a990ca8345abfdd5df6dc9b41c8`, supplied through IMD. These notes describe the implemented source after its final UI changes.
