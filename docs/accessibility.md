# Accessibility audit (WCAG 2.2 AA)

Scope: the public reading site (home, search, post, 404s, the `/admin/mcp`
guide) and the studio editor (dashboard, new/edit post, block editor, preview,
delete dialog, toasts). Clerk's hosted sign-in UI is third-party and out of
scope.

## Method

- **Automated:** axe-core 4.14 (`@axe-core/playwright`) with the WCAG 2.0/2.1/2.2
  A and AA rule sets, on desktop (1280px) and mobile (390px) viewports, in each
  interactive state: search results open, insert menu open, validation errors
  and their toast, preview, delete dialog, and all four code themes.
- **Manual / scripted:** keyboard-only walkthroughs (tab order, focus
  visibility on every stop, focus after each editor action, dialog focus
  handling), 320px reflow, and contrast of what axe doesn't measure
  (placeholders, focus indicators, icon-only controls).

These checks now run on every PR as the `End-to-end and accessibility` job
(see [`e2e/README.md`](../e2e/README.md)).

## Findings and fixes

| #   | WCAG                        | Where                                     | Problem                                                                                                           | Fix                                                                                                        |
| --- | --------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 1   | 2.5.3 Label in Name         | Logo link (every page)                    | `aria-label="Blogs home"` didn't contain the visible text (axe: serious)                                          | Name comes from the content: visible "Blogs" + visually hidden "home"                                      |
| 2   | 2.5.3 Label in Name         | MCP guide, Copy button                    | Name "Copy MCP server URL" didn't contain the visible "Copy URL" / "Copied"                                       | "Copy URL of the MCP server", and "Copied" once copied                                                     |
| 3   | 4.1.2 / 1.3.1               | Search results                            | Each `role="option"` wrapped a link (axe `nested-interactive`: serious)                                           | The link _is_ the option (`<a role="option">`), so it still opens in a new tab                             |
| 4   | 1.4.3 Contrast              | Toasts (editor)                           | Sonner's rich-color error toast is 4.34:1 (#e60000 on #fff0f0); success/info/warning are similar                  | Darker text tokens for all four kinds                                                                      |
| 5   | 2.4.3 Focus Order           | Delete dialog                             | Tab left the modal for the page behind it, Escape stopped working once it had, and focus wasn't returned on close | Tab/Shift+Tab cycle inside the dialog; closing returns focus to the button that opened it                  |
| 6   | 2.4.3 Focus Order           | Block editor, "+" insert menu             | Opening the menu removed the focused button, dropping focus to `<body>`                                           | Focus moves to the first block type; Escape/Cancel return to "+"; picking a type focuses the new block     |
| 7   | 2.4.3 Focus Order           | Block editor                              | Deleting a block dropped focus to `<body>`; moving a block to the top/bottom left focus on a now-disabled arrow   | Focus goes to the next (or previous) block, the toolbar when none are left, and the other arrow at an edge |
| 8   | 2.1.2 No Keyboard Trap      | Code block field                          | Tab inserts spaces, so the only way out was Shift+Tab, and that wasn't said                                       | Esc then Tab leaves the field; the hint says so and is the field's description                             |
| 9   | 2.4.7 Focus Visible         | Post title, heading and text block fields | `outline-none` with no replacement: no focus indicator at all                                                     | The global focus outline on the title; the block card gets a 4:1 border + ring while focused               |
| 10  | 2.4.7 Focus Visible         | Post cards (home)                         | The covering link had `outline-none`; the card's only cue was a 4px lift                                          | The card draws the outline when its link has keyboard focus                                                |
| 11  | 2.4.7 Focus Visible         | Image resize handles                      | Focusable sliders with `outline-none` and no other cue                                                            | The handle turns brand blue with a white ring when focused                                                 |
| 12  | 1.4.11 Non-text Contrast    | Search box, inputs, tags field            | Focus shown by a brand-100 ring (1.2:1) or brand-300/400 border (2.0–2.9:1)                                       | brand-500 border (4.1:1) plus ring                                                                         |
| 13  | 1.4.11 Non-text Contrast    | "+" between blocks                        | Icon at 60% opacity (≈2.6:1)                                                                                      | 80% (≈3.8:1)                                                                                               |
| 14  | 1.4.3 Contrast              | Placeholders (search, editor fields)      | `text-muted` at 50–80% opacity: 2.1–3.8:1                                                                         | Full `text-muted` (6.0:1)                                                                                  |
| 15  | 2.5.8 Target Size (Minimum) | Code theme switcher (post page, mobile)   | Theme buttons 18.7px tall, closer than 24px to each other when wrapped (axe: serious)                             | At least 24px tall                                                                                         |
| 16  | 2.5.8 Target Size (Minimum) | Tag chips, insert menu                    | Remove-tag buttons were 16px; insert-menu choices 20px                                                            | 24px                                                                                                       |
| 17  | 2.4.1 Bypass Blocks         | Public site, studio, 404                  | Landmarks only, no skip link past the header/sidebar                                                              | "Skip to content" link, first in the tab order, focusing `<main>`                                          |
| —   | 2.3.3 (AAA, bonus)          | Everywhere                                | Spinners, shimmer and card lifts ignored "reduce motion"                                                          | Animations and transitions collapse under `prefers-reduced-motion`                                         |

## Already in good shape

Every field has a label, errors are tied to their field with
`aria-describedby` and announced (`role="alert"`), save state and search
results are announced through live regions, toggles use `aria-pressed`, nav
uses `aria-current`, the search box follows the ARIA combobox pattern, the
dashboard table has scoped headers, every page has a single `<h1>`, a title
and `lang`, drag-to-reorder has keyboard move buttons (2.5.7), the image
resize handles are keyboard sliders, and pages reflow at 320px.

## Not covered here

- **Screen reader passes** (NVDA, VoiceOver, TalkBack): the semantics are
  checked by axe and the role-based Playwright locators, but nobody has listened
  to the flows end to end yet.
- **Alt text** is up to the author. The editor allows an empty alt (decorative
  image); a nudge when an image block has none would help.
- **Dark mode** doesn't exist yet, so only the light theme was checked.
- **Clerk's sign-in/sign-up UI** is Clerk's own.
