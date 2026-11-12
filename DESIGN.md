---
name: Merchant Portal
description: A plain-English NETS merchant portal at Stripe Dashboard quality. Answer first, one main action per screen.
colors:
  bg: "#F5F7FA"
  surface: "#FFFFFF"
  border: "#E2E7EE"
  border-strong: "#CBD3DE"
  ink: "#14213D"
  ink-2: "#46536A"
  ink-3: "#5C6980"
  accent: "#0B4DB8"
  accent-hover: "#08398A"
  accent-soft: "#EAF1FD"
  chart-2: "#A8C3F0"
  red: "#D3162B"
  red-hover: "#B01224"
  red-soft: "#FDE9EB"
  ok: "#0E7A3E"
  ok-bg: "#E3F5EA"
  warn: "#8A5300"
  warn-bg: "#FFF1D6"
  mute-bg: "#EEF1F5"
typography:
  answer:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "clamp(1.35rem, 1.05rem + 1.1vw, 1.85rem)"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.015em"
  headline:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  figure:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "32px"
    fontWeight: 650
    lineHeight: 1.15
    letterSpacing: "-0.025em"
    fontFeature: "tnum"
  title:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "17px"
    fontWeight: 650
    lineHeight: 1.3
  body:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "cv11, ss01"
  body-sm:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.6
  nav-group:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    letterSpacing: "0.06em"
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  full: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.red}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.red-hover}"
  button-primary-lg:
    backgroundColor: "{colors.red}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "0 20px"
    height: "52px"
  button-blue:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "44px"
  button-blue-hover:
    backgroundColor: "{colors.accent-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "44px"
  button-quiet:
    textColor: "{colors.accent-hover}"
    rounded: "{rounded.md}"
    padding: "0 10px"
    height: "44px"
  button-quiet-hover:
    backgroundColor: "{colors.accent-soft}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "48px"
  select:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 34px 0 12px"
    height: "44px"
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "16px 20px 20px"
  pill-ok:
    backgroundColor: "{colors.ok-bg}"
    textColor: "{colors.ok}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "2px 9px 2px 7px"
  pill-warn:
    backgroundColor: "{colors.warn-bg}"
    textColor: "{colors.warn}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "2px 9px 2px 7px"
  pill-bad:
    backgroundColor: "{colors.red-soft}"
    textColor: "{colors.red-hover}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "2px 9px 2px 7px"
  pill-info:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent-hover}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "2px 9px 2px 7px"
  pill-mute:
    backgroundColor: "{colors.mute-bg}"
    textColor: "{colors.ink-2}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "2px 9px 2px 7px"
  nav-item:
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "6px 12px"
    height: "44px"
  nav-item-hover:
    backgroundColor: "{colors.mute-bg}"
  nav-item-active:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent-hover}"
  ask-button:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "48px"
  sidebar:
    backgroundColor: "{colors.surface}"
    padding: "16px 12px"
    width: "264px"
---

# Design System: Merchant Portal

<!-- Recorded from the finished planning-phase mockups in design/ (portal.css, shell.js, home, login, check-up, transactions, assistant). The mockups are the source of truth. When the real Next.js app is built, copy these tokens into Tailwind; do not invent new ones. -->

## Overview

**Creative North Star: "The Plain-Spoken Ledger"**

This is a conventional merchant portal, built to the quality of the Stripe Dashboard, but written for a hawker uncle as much as for an accountant. Every screen opens with the answer as one sentence ("Good week, Ah Hock. You took $4,309..."), then shows the figures, then the details. Each screen has one main action, and it is the only red button on the screen.

The look is light and calm: a pale cool-grey page, white panels with thin grey lines, dark navy text. Two colours do all the work. Blue means data and navigation (charts, links, the selected menu item, the Ask button). Red is the brand mark, the one main action, and problems (money that is short, late or wrong). Green and amber appear only inside status pills. The density is medium: big enough to read on a phone at a stall, tidy enough for an accountant filtering a table on a desktop.

Plain words come first and the technical term sits underneath in smaller grey text ("Check-up" / *Reconciliation*). This is a visual rule, not only a writing rule: every heading pair uses the same two-level style. The design rejects themed or metaphor worlds (an airport-board direction was turned down) and does not copy Stripe's or NETS's branding.

**Key Characteristics:**
- Light page, white panels, 1px hairlines, very quiet shadows.
- Blue for data and navigation; red for brand, the main action and problems.
- Status is always icon + word + colour, never colour alone.
- Inter with tabular numbers for every amount.
- Answer-first sentence at the top of every screen.
- Every touch target is at least 44px tall.

## Colors

A cool, near-white neutral base with two working colours (NETS-like blue and red, in our own shades) and a small set of status colours.

### Primary
- **Ledger Blue** (`accent`): data and navigation. Chart bars (best day), channel-mix bars, the "money to your bank" part of the flow bar, links, the selected sidebar item's icon, the "Ask NETS Assistant" button, the Send button, focus rings, the user's own chat bubble, and the login hero panel.
- **Deep Ledger Blue** (`accent-hover`): hover state for blue buttons, and the text colour on blue-tinted backgrounds (selected menu item label, info pills, "why" boxes, links). In code this is also called `--accent-ink`; it is the same value.
- **Blue Wash** (`accent-soft`): background of the selected menu item, selected table row, selected tab count, info pill, "why" explanation box, and the 3px focus glow around inputs.
- **Pale Chart Blue** (`chart-2`): the normal (not best) bars in the sales chart.

### Secondary
- **Signal Red** (`red`): the brand mark, the single main action button on each screen, the assistant's avatar, and the fee part of the money flow bar. Nothing else.
- **Deep Signal Red** (`red-hover`): hover for the main button, and text for problems: the "Needs your attention" number, fee amounts, differences in the check-up, bad pills, the alert dot. In code also `--red-ink` and `--bad`.
- **Red Wash** (`red-soft`): icon tiles in the to-do list and check-up issues, bad pill background, and the red explanation box. In code also `--bad-bg`.

### Tertiary (status only)
- **Paid Green** (`ok`) on **Mint** (`ok-bg`): "In your bank", "Approved", issues already looked at, an upward change in the assistant figures.
- **Amber Ink** (`warn`) on **Cream** (`warn-bg`): pending or "check this" states, and the "Sample data" tag in the top bar.

### Neutral
- **Cool Paper** (`bg`): the page background behind panels; also the footer strip of an assistant answer card.
- **White** (`surface`): panels, sidebar, top bar controls, inputs, phone tab bar.
- **Hairline** (`border`): every 1px divider: panel edges, table rows, summary strip dividers, top bar bottom edge.
- **Strong Hairline** (`border-strong`): edges of controls you can press or type in (inputs, selects, secondary buttons, segmented control, suggestion chips) and the chart baseline.
- **Navy Ink** (`ink`): main text and figures.
- **Slate** (`ink-2`): secondary text, table headers, labels above figures.
- **Light Slate** (`ink-3`): technical subtitles, sidebar group titles, placeholders, unselected icons. Still passes WCAG AA on white.
- **Mist** (`mute-bg`): sidebar hover, neutral pills, "Soon" tags, tab counts, empty part of the channel-mix bars.

### Named Rules
**The Two Jobs Rule.** Blue is for data and navigation. Red is for the brand, the one main action, and problems. If something is neither, it is navy ink or grey.

**The One Red Button Rule.** Each screen has exactly one red (primary) button: the main action named in that screen's brief ("See what needs attention", "Download for my accountant", "Log in"). Other actions use the secondary, quiet or blue button. A second red button is allowed only inside a problem card where the action fixes that problem (for example "Ask NETS to check" in an assistant answer about late money).

**The Never Colour Alone Rule.** A status always shows an icon, a word and a colour together ("✓ In your bank", "clock Arriving Fri 13 Nov", "alert Late, due Tue 10 Nov"). Colour-blind users and phone screens in sunlight must still read it.

## Typography

**Display Font:** Inter (with system-ui, -apple-system, Segoe UI, sans-serif)
**Body Font:** Inter (same stack)

**Character:** One family, many weights. Inter is loaded at 400, 500, 600, 650 and 700, with the `cv11` and `ss01` alternates on for clearer letters. All money amounts use tabular numbers so columns line up.

### Hierarchy
- **Answer** (600, clamp 1.35rem to 1.85rem, line-height 1.3, max 34ch): the one-sentence answer at the top of Home, Check-up and Transactions. The key figure inside it is coloured Deep Ledger Blue, not italic.
- **Headline** (700, 28px, 24px on phones, line-height 1.2): page titles such as "Check-up" and "Sales & payments". Always followed by a technical subtitle (14px, Light Slate).
- **Figure** (650, 32px, 28px on phones, tight -0.025em, tabular): the big numbers in the summary strip and the transaction detail amount. Smaller figure sizes used in the build: 24px (check-up route stops), 20px (flow labels, comparison rows, assistant figures).
- **Title** (650, 17px): panel headings. Issue headings in the check-up use 18px; detail sub-headings 16px.
- **Body** (400, 16px, line-height 1.5): normal text; answer sub-lines, chat messages. Keep lines under about 70ch.
- **Body small** (400, 14px): descriptions under figures, to-do lines, panel footers, links inside panels (these links are 600).
- **Label** (600, 13px): status pills and table column headers. Table body text is 15px.
- **Nav group** (600, 12px, uppercase, 0.06em tracking): only the four sidebar group titles (My business, My money, Grow, Settings).

### Named Rules
**The Plain Word On Top Rule.** Plain words are the big line; the technical term is the small grey line under or beside it (14px for page titles, 13px in panels, 12px in the sidebar). Never the other way round.

**The Tabular Money Rule.** Every amount, count and percentage uses `font-variant-numeric: tabular-nums` and is right-aligned in tables.

## Layout

- **App frame:** a two-column grid. Left: sidebar, 264px wide, sticky, full height. Right: sticky top bar, then the page.
- **Page:** max width 1240px, centred. Padding 28px top, 64px bottom, sides `clamp(16px, 3vw, 36px)`. Sections stack with a 24px gap (20px on phones).
- **Page head:** the title or answer sentence on the left, actions on the right (they wrap below on narrow screens). On phones every action button becomes full width.
- **Two-column rows:** `1.6fr / 1fr` (chart beside channel mix, table beside to-do list) or equal halves, with a 20px gap. They become one column below 1024px.
- **Transactions split:** table on the left, a 380px sticky detail panel on the right. Below 1180px the detail panel becomes a bottom sheet that slides up.
- **Spacing rhythm:** 4, 8, 12, 16, 20, 24px. Panel padding is 20px (16px on phones). Rows in lists and tables use 12 to 14px vertical padding.
- **Breakpoints:** 1180px (transaction detail becomes a sheet), 1023px (sidebar becomes a drawer, phone tab bar appears, top-bar search hides), 760px (table rows become two-line cards), 640px (summary strip stacks, tighter padding).
- **Phones:** the sidebar slides in from the left (width `min(86vw, 320px)`) over a dark scrim, opened by the menu button or the "More" tab. A fixed bottom tab bar shows Home, Payments, Check-up, Ask, More (54px tall tabs, respects the safe-area inset). Pages add 100px bottom padding so the tab bar never covers content.

## Elevation & Depth

Mostly flat. Depth comes from white panels on a cool-grey page and 1px hairlines. Shadows are very small and only help panels and controls sit on the page; a bigger shadow is used only for things that float over other content.

### Shadow Vocabulary
- **Resting** (`box-shadow: 0 1px 2px rgba(26,34,51,0.06), 0 1px 1px rgba(26,34,51,0.03)`): panels, selects, secondary buttons, assistant answer cards.
- **Floating** (`box-shadow: 0 12px 32px -8px rgba(26,34,51,0.22), 0 2px 6px rgba(26,34,51,0.08)`): only for layers above the page: the phone sidebar drawer, the transaction bottom sheet, the assistant message box.
- **Focus glow** (`box-shadow: 0 0 0 3px #EAF1FD` with a blue border): inputs, search boxes and the login demo cards on focus or hover.
- **Keyboard focus** (`outline: 3px solid #0B4DB8; outline-offset: 2px`): every focusable element.

### Named Rules
**The Float Means Above Rule.** The floating shadow is only for something that sits on top of other content (drawer, sheet, sticky composer). Panels in the page flow always use the resting shadow.

## Shapes

Soft, rounded rectangles, never sharp and never bubbly.

- **Panels and cards:** 12px corners.
- **Buttons, inputs, selects, menu items, small boxes:** 8px corners.
- **Small inner parts:** 6px (segmented control buttons, "helpful" buttons, the flow bar).
- **Large floating parts:** 16px (chat bubbles, message box, top corners of the phone bottom sheet). Chat bubbles cut one corner to 4px to point at the speaker.
- **Pills, tags, avatars, chips:** fully round.
- **Icon tiles:** 8px for 32px tiles, 10px for 40 to 44px tiles.
- **Icons:** one line-icon set, 24px grid, drawn at 20px (16px small, 14px in pills, 22px in the tab bar), stroke 1.8, round ends. Use the same set everywhere (Lucide matches it in the real app).

## Components

**How to use this in the real app (Next.js + Tailwind + shadcn/ui, plain JavaScript):** put the colours above in `tailwind.config.js` under `theme.extend.colors` using the same names (`bg`, `surface`, `ink`, `accent`, `red`...), and set the shadcn CSS variables to match (`--primary` = red, `--ring` = accent, `--radius` = 8px). Then style shadcn `Button`, `Input`, `Select`, `Card`, `Badge`, `Tabs` and `Table` to the rules below instead of using their default look. Use `lucide-react` for icons.

### Buttons
Calm and solid. Every button is at least 44px tall, 600 weight, 15px text, 8px corners, with an icon on the left (or an arrow on the right for "go" actions). Colour changes on hover take 140ms.
- **Primary (red):** red background, white text, tiny red shadow. The one main action per screen. Large size (52px tall, 16px text, full width) on the login form.
- **Blue:** blue background, white text. For the Send button in the assistant. Not a second main action.
- **Secondary:** white background, navy text, strong hairline border, resting shadow; border darkens to Light Slate on hover. For filters such as "Last 7 days" and other actions next to the main one.
- **Quiet:** no background, Deep Ledger Blue text, 10px side padding; Blue Wash background on hover. For small actions inside cards ("Mark as looked at", "Copy reference").
- **Disabled:** 55% opacity, not-allowed cursor.

### Status pills
- **Style:** fully round, 13px 600 text, a 14px icon (thicker 2.4 stroke) then the word, coloured text on a light tint of the same colour.
- **Types:** ok (green, tick), warn (amber), bad (red, alert), info (blue, clock), mute (grey).
- **Rule:** always icon + word + colour (see The Never Colour Alone Rule).

### Cards / Panels
- **Corner Style:** 12px.
- **Background:** white on the Cool Paper page.
- **Shadow Strategy:** resting shadow (see Elevation & Depth).
- **Border:** 1px Hairline.
- **Internal Padding:** head 18px 20px 0 (title left, a small 600-weight link right such as "See all" or "Explain this"); body 16px 20px 20px; optional footer 12px 20px with a hairline on top.

### Summary strip (signature)
One panel split into three equal parts by vertical hairlines, not three separate cards. Each part: a 14px Slate label, a 32px Figure, a 14px detail line. The "Needs your attention" part turns its number and link Deep Signal Red. On phones the parts stack with horizontal hairlines and the figure sits on the right of its label.

### Money flow bar (signature)
A 40px bar with 6px corners showing sales split into blue (to your bank) and red (NETS fees, at least 10px wide so it is always visible), with a 2px gap. Under it, three labels: Your sales, NETS fees (red), To your bank, each with a 20px figure. Used on Home and as a small 14px version on the login preview.

### Inputs / Fields
- **Style:** white, 1px strong hairline, 8px corners, 48px tall on forms (44px for selects and search inside pages), 16px text, label above in 15px 600.
- **Focus:** border turns blue plus a 3px Blue Wash glow.
- **Search boxes:** the same frame with a 16px search icon inside on the left; the top-bar search is 42px tall and up to 460px wide.
- **Error / Disabled:** not drawn yet (see open items).

### Segmented control and tabs
- **Segmented control** (transaction "Result" filter): strong-hairline frame, 3px inner padding, 36px buttons with 6px corners; the pressed one gets Blue Wash with Deep Ledger Blue text.
- **Tabs** (check-up results): 44px buttons with a 2px underline; the selected tab is Deep Ledger Blue with a blue underline, and its count bubble turns Blue Wash.

### Tables
15px text, 13px 600 Slate headers on a hairline, 12px 16px cells, hairline between rows. Amounts right-aligned, 600 weight, tabular. A second line inside a cell is 13px Light Slate. The selected row is Blue Wash. Below 760px each row becomes a two-line card (time and place on the left, amount and status on the right).

### Navigation
- **Sidebar:** white, hairline on the right. From top: the brand (32px red square mark with a white letter, then "Merchant Portal" in 16px 700), the outlet switcher ("Showing" + select; a static name card when there is only one outlet), the four groups, and the "Ask NETS Assistant" button pinned at the bottom (blue, 48px tall). The menu list fades out at the bottom when it scrolls.
- **Menu item:** 44px tall, icon + plain label (15px 500) with the technical term under it (12px Light Slate), 8px corners. Hover: Mist. Current page: Blue Wash, Deep Ledger Blue label at 650, blue icon. Not-yet-built items are greyed out with a round "Soon" tag and cannot be clicked.
- **Top bar:** sticky, slightly see-through Cool Paper with a blur and a hairline below. Contains the search box, a "Sample data" amber tag, the alerts button (42px square, red dot when there are new alerts) and the user chip (avatar, name, role · business).
- **Phone tab bar:** see Layout. Current tab is Deep Ledger Blue with a blue icon.

### Assistant conversation
The user's message is a blue bubble on the right. The assistant's answer is a white answer card (corner pointing to a 36px red avatar tile) with a 17px lead sentence, an optional three-figure row split by hairlines, action buttons, and a Cool Paper footer showing the data source and "Was this helpful?". Suggested questions are round 44px chips with a strong hairline. The message box sticks to the bottom with a floating shadow and a line under it saying the assistant can only read data.

## Do's and Don'ts

### Do:
- **Do** open every screen with a one-sentence answer, and put the key figure in it in Deep Ledger Blue.
- **Do** use exactly one red primary button per screen for that screen's main action.
- **Do** show status as icon + word + colour in a pill, every time.
- **Do** put the plain word first and the technical term underneath in smaller Light Slate text.
- **Do** use tabular numbers for every amount and right-align amounts in tables.
- **Do** keep every touch target at least 44px tall, and test each screen at phone width.
- **Do** group related figures in one panel divided by hairlines (summary strip, comparison rows) instead of a grid of small cards.
- **Do** label sample figures as "Sample data".

### Don't:
- **Don't** use red for decoration, headings or navigation; red means brand, main action or a problem.
- **Don't** use blue for warnings or problems.
- **Don't** show a status with colour only (a coloured dot or coloured text with no word).
- **Don't** use the floating shadow on panels that sit in the page.
- **Don't** add small uppercase labels above page headlines or panel titles; the uppercase style belongs to the four sidebar group titles only.
- **Don't** add new colours, font sizes or corner sizes outside this file; reuse the tokens above.
- **Don't** use the NETS logo or copy Stripe's branding.

## Open items (not designed yet)

These were known gaps when the mockups were signed off. Design them later using the tokens above; do not treat their absence as a rule.
- **Error, empty and loading states** are not drawn for any screen (including field errors on the login form).
- **The sales chart has no previous-week comparison series** yet; only the current week is shown.
- **There is no designed motion moment.** Motion today is only small state changes: 140ms colour changes on buttons, 260 to 280ms slides for the phone drawer and bottom sheet, using the easing `cubic-bezier(0.16, 1, 0.3, 1)`, all switched off when the user prefers reduced motion.
- ~~**Table row hover**~~ Fixed 2026-11-12: a hovered table row uses the page colour Cool Paper (`bg`, `#F5F7FA`) so it shows against the white panel.
