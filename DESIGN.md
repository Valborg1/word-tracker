# Design system

The November Word Tracker is one page (`index.html`). All tokens are CSS variables on `:root` at the top of the file. Change them there, not inline.

## Principles

- **Phone first.** Most people open the tracker from a WhatsApp link right after writing. The things they need (today's progress and the Add box) are visible without scrolling at 390px wide, and everything still fits at 320px.
- **Numbers are the content.** Totals use the serif at large sizes with tabular figures. Chrome stays quiet: flat cards, thin rules, one accent colour.
- **Say it in words, not just colour.** Every coloured state also has text ("Goal met", "to go today").
- **Calm feedback.** Wins get a message and a colour change, never confetti, sound or animation.

## Colour

| Token | Light | Dark | Use |
|---|---|---|---|
| `--paper` | `#f2f4f7` | `#12161d` | Page background; input fill |
| `--sheet` | `#ffffff` | `#1a2029` | Cards, tab bar |
| `--sheet-2` | `#e8ecf2` | `#232b36` | Empty progress-bar track |
| `--ink` | `#1b2433` | `#e6eaf0` | Body text; toast background |
| `--ink-soft` | `#5a6577` | `#9aa5b5` | Secondary text, labels, hints |
| `--rule` | `#d6dce5` | `#2e3846` | Borders and dividers |
| `--blue` | `#2b4c7e` | `#8fb0e0` | The accent: buttons, progress, "goal met" days, positive numbers |
| `--blue-light` | `#c9d6ea` | `#2a3a55` | "Wrote" days, focus ring, toast action text |
| `--blue-mid` | `#7c98c4` | `#4f6c99` | Quote rule |
| `--on-blue` | `#ffffff` | `#0f1726` | Text on `--blue` |
| `--gold` | `#b07d12` | `#e0b04a` | **Today** (calendar ring) and **today's goal met** (Today bar). Never for small text in light mode (about 3.6:1 on white) |
| `--danger` | `#a3322a` | `#e98a80` | Errors and destructive buttons |

Dark mode follows `prefers-color-scheme`; every token above has a dark value.

## Type

- **Literata** (`--serif`): headings, big numbers (totals, stats, leaderboard words), the quote. Weights 400/600/700.
- **Atkinson Hyperlegible** (`--sans`): everything else. Base 16px / 1.5.
- Numbers use `font-variant-numeric: tabular-nums` so they don't jitter as they change.
- Sizes: hero total 2.75rem; your name 1.5rem; card titles and stat values 1.125rem; body and the Today count 1rem; labels and hints 0.8125–0.875rem.

## Layout

- One centred column, `max-width: 560px`, 16px side padding.
- Cards: `--sheet`, 1px `--rule` border, 12px radius, 18px padding, 14px apart.
- A fixed bottom tab bar (My progress / Group / Admin). The page reserves room for it, including `scroll-padding-bottom` so focused fields aren't hidden behind it.

## Components

| Component | Class | Notes |
|---|---|---|
| Card | `.card` | The default container. Don't nest cards. |
| Hero card | `.card.hero` | Name, project, month total, month bar, then the Today section. |
| Today section | `.hero-today` | Divider, "Today" / "Goal met" with "640 of 1,667", a 6px bar (`.bar.gold` once met), and on your own page the Add form. |
| Add row | `.quick` | Input and button side by side at every width; both 48px tall; button min 96px wide. |
| Progress bar | `.bar` / `.bar.gold` | Decorative (`aria-hidden`); the text next to it carries the meaning. |
| Stats | `.stats.three` | Three equal boxes: Pace (today only), Needed / day (the month), Streak. Every label, value and sub-line fits on one line at 320px; below 360px the boxes use 8px side padding and 0.75rem labels. |
| Calendar | `.cal`, `.day` | States: `none`, `partial` (wrote), `met`, `future` (dashed), `today` (gold ring), `selected` (ink outline). Days up to today are buttons on your own page. |
| Day editor | `.day-editor` | Opens under the calendar for the tapped day. Sets that day's total. Escape or Close returns focus to the day. |
| Buttons | `.btn` + `secondary`, `danger`, `plain`, `small`, `block` | Min 44px tall (36px for `small`, used only in dense lists). |
| Segmented control | `.seg` | `aria-pressed` on the active option. |
| Toast | `.toast` (+ `.has-action`) | Bottom-centre above the tabs. 2.8s plain; 6s with an action (Undo), paused while hovered or focused. |
| Field error | `.field-error` | Under the field, linked with `aria-describedby`; the field gets `aria-invalid`. |

## Patterns

- **Forms:** every input has a visible `<label>`; placeholders are never the only label. The word-count fields on My progress (Add box, day editor) are `type="text" inputmode="numeric"` and accept commas and spaces ("1,200"). The registration goal and the Admin entry box are still `type="number"`.
- **Adding vs setting:** the Add box adds this session's words to today. Only the calendar day editor sets a day's total.
- **Pace is today only.** It never shows the month's ahead/behind number; Needed / day covers the month.

  | Situation | Value | Sub-line |
  |---|---|---|
  | Before Nov 1 | — | starts Nov 1 |
  | Below today's goal | 1,027 | to go today |
  | Exactly at the goal | Done (`--blue`) | goal met |
  | Past the goal | +113 (`--blue`) | over goal |
  | After Nov 30 | — | November’s done |

- **Saving:** the button reads "Adding…" or "Saving…" and every button is disabled while a request runs. On error the typed value stays and a toast explains.
- **Undo over confirmation** for quick, reversible actions (Add). Use `confirm()` only for deleting entries or users.
- **Today's goal met:** the message "Daily goal met! 1,780 of 1,667", the Today bar turns gold, and the row reads "Goal met" for the rest of the day.
- **Copy:** short and plain, in sentence case. The app's name, **November Word Tracker**, is the one exception: always title case. Numbers use thousands separators. Use the curly apostrophe (’).
