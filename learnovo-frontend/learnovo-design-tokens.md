# Learnovo Design Tokens

> Extracted from the live codebase (tailwind.config.js, index.css, ThemeContext.jsx).
> Prompts 2, 3, 4 MUST reference this file for all styling decisions.

---

## Colors

### Primary (Teal)
| Token | Value |
|-------|-------|
| primary-50 | `#f0fdfa` |
| primary-100 | `#ccfbf1` |
| primary-200 | `#99f6e4` |
| primary-300 | `#5eead4` |
| primary-400 | `#2dd4bf` |
| **primary-500** | **`#3EC4B1`** (brand color) |
| primary-600 | `#0d9488` |
| primary-700 | `#0f766e` |
| primary-800 | `#115e59` |
| primary-900 | `#134e4a` |

### Secondary (Blue)
| Token | Value |
|-------|-------|
| secondary-50 | `#eff6ff` |
| secondary-100 | `#dbeafe` |
| secondary-200 | `#bfdbfe` |
| secondary-300 | `#93c5fd` |
| secondary-400 | `#60a5fa` |
| **secondary-500** | **`#2355A6`** |
| secondary-600 | `#2563eb` |
| secondary-700 | `#1d4ed8` |
| secondary-800 | `#1e40af` |
| secondary-900 | `#1e3a8a` |

### Background Colors
| Context | Light | Dark |
|---------|-------|------|
| Page | `gray-50` (#f9fafb) | `#000000` |
| Card | `white` (#ffffff) | `#1C1C1E` |
| Surface/Hover | `gray-50` | `#2C2C2E` |
| Input | `white` | `#1C1C1E` |
| Sidebar | `white/95` (with backdrop-blur-xl) | `#1C1C1E` |
| Table header | `gray-50/80` | `#2C2C2E` |

### Text Colors
| Context | Light | Dark |
|---------|-------|------|
| Primary (headings, body) | `gray-900` (#111827) | `white` |
| Secondary (subtitles) | `gray-500` (#6b7280) | `#8E8E93` |
| Muted (placeholders) | `gray-400` (#9ca3af) | `#636366` |
| Error | `red-600` | `#FF453A` |
| Label | `gray-700` (#374151) | `#8E8E93` |

### Border Colors
| Context | Light | Dark |
|---------|-------|------|
| Default | `gray-200` (#e5e7eb) | `#38383A` |
| Subtle | `gray-100` | `#2C2C2E` |
| Strong | `gray-300` | `#48484A` |
| Focus ring | `primary-500` | `#3EC4B1` |

---

## Border Radius
| Token | Value | Usage |
|-------|-------|-------|
| sm | `rounded-md` (6px) | Filter pills, small badges |
| md | `rounded-lg` (8px) | Never use on cards/containers — reserved for inner elements |
| lg | `rounded-xl` (12px) | Buttons, inputs, tab items, icon containers |
| xl | `rounded-2xl` (16px) | Cards, stat cards, tables, modals, containers |
| 2xl | `rounded-3xl` (20px) | Landing page special elements only |

**Rule:** All page-level containers, cards, and tables use `rounded-2xl`. Never use `rounded-lg` for top-level containers.

---

## Box Shadows
| Token | Value |
|-------|-------|
| glass | `0 0 0 1px rgba(255,255,255,0.05), 0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.04)` |
| glass-md | `0 0 0 1px rgba(255,255,255,0.06), 0 2px 4px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)` |
| glass-lg | `0 0 0 1px rgba(255,255,255,0.08), 0 4px 8px rgba(0,0,0,0.04), 0 16px 40px rgba(0,0,0,0.08)` |
| glow-primary | `0 0 20px -4px rgba(62,196,177,0.3)` |
| glow-sm | `0 0 12px -2px rgba(62,196,177,0.2)` |

---

## Simulated Glass (NO backdrop-filter)
Use on: page section containers, chart wrapper cards, empty state containers.
```css
background: rgba(255, 255, 255, 0.08);
border: 1px solid rgba(255, 255, 255, 0.15);
box-shadow: 0 4px 24px rgba(0, 0, 0, 0.10);
border-radius: 16px;
```
In Tailwind (dark mode):
```
bg-white/[0.08] border border-white/[0.15] shadow-[0_4px_24px_rgba(0,0,0,0.10)] rounded-2xl
```

---

## Real Glass (backdrop-filter) — STRICT LIMIT
Allowed ONLY on:
- Sidebar (`backdrop-blur-xl`)
- Top navbar (`backdrop-blur-xl`)
- Modals/dialogs (`backdrop-blur-sm` on overlay)
- Dashboard stat cards (max 6) — uses `.stat-card-glass` class

---

## Buttons
| Variant | Classes |
|---------|---------|
| **Primary** | `bg-primary-600 text-white hover:bg-primary-500 shadow-md` / dark: `bg-[#3EC4B1] text-black hover:bg-[#35a89a]` |
| **Secondary** | `bg-secondary-600 text-white hover:bg-secondary-500 shadow-md` |
| **Outline** | `border border-gray-300 text-gray-700 bg-white hover:bg-gray-50` / dark: `border-[#38383A] text-white bg-transparent hover:bg-[#2C2C2E]` |
| **Ghost** | `text-gray-600 hover:bg-gray-100/80` / dark: `text-[#3EC4B1] hover:bg-[rgba(62,196,177,0.08)]` |
| **Danger** | `bg-red-600 text-white hover:bg-red-500` / dark: `bg-[#FF453A] hover:bg-[#FF6961]` |
| **Icon** | `p-2 rounded-xl text-gray-400 hover:bg-gray-100/80 hover:text-gray-600` |

All buttons: `rounded-xl h-10 px-4 text-sm font-semibold active:scale-[0.97]`
Small: `h-8 px-3 text-xs rounded-lg`
Large: `h-12 px-6 text-base`

---

## Inputs
```
h-11 sm:h-10 rounded-xl border-gray-200 bg-white px-3.5 py-2 text-sm
focus: ring-2 ring-primary-500 border-primary-500
dark: bg-[#1C1C1E] border-[#38383A] focus:ring-[#3EC4B1] focus:border-[#3EC4B1]
```

---

## Tables
| Element | Style |
|---------|-------|
| Container | `rounded-2xl overflow-hidden shadow-glass` |
| Header bg | `bg-gray-50/80` / dark: `bg-[#2C2C2E]` |
| Header text | `text-[11px] font-semibold text-gray-500 uppercase tracking-wider` |
| Cell text | `text-xs sm:text-sm text-gray-700` / dark: `text-white` |
| Row hover | `bg-primary-50` / dark: `bg-[#2C2C2E]` |
| Row border | `border-b border-gray-50` / dark: `border-[#2C2C2E]` |
| Min width | `600px` (horizontal scroll on mobile) |

**NO glass, NO backdrop-filter on table rows or cells.**

---

## Status Badges
| Status | Light | Dark |
|--------|-------|------|
| Active | `bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200` | `bg-[rgba(48,209,88,0.12)] text-[#30D158]` |
| Inactive | `bg-gray-50 text-gray-600 ring-1 ring-gray-200` | `bg-[rgba(142,142,147,0.12)] text-[#8E8E93]` |
| Pending | `bg-amber-50 text-amber-700 ring-1 ring-amber-200` | `bg-[rgba(255,214,10,0.12)] text-[#FFD60A]` |
| Terminated / Overdue | `bg-red-50 text-red-700 ring-1 ring-red-200` | `bg-[rgba(255,69,58,0.12)] text-[#FF453A]` |
| Paid / Success | `bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200` | `bg-[rgba(48,209,88,0.12)] text-[#30D158]` |

Badge base: `inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold`

---

## Typography
| Token | Value |
|-------|-------|
| Font family | `Inter, system-ui, -apple-system, sans-serif` |
| xs | `0.75rem` (12px) |
| sm | `0.875rem` (14px) |
| base | `1rem` (16px) |
| lg | `1.125rem` (18px) |
| xl | `1.25rem` (20px) |
| 2xl | `1.5rem` (24px) |
| Body letter-spacing | `-0.011em` |
| Heading letter-spacing | `-0.025em` |
| Font weights used | 400 (normal), 500 (medium), 600 (semibold), 700 (bold) |

---

## Spacing Scale
Standard Tailwind 4px scale: `1=4px, 2=8px, 3=12px, 4=16px, 5=20px, 6=24px, 8=32px`
Card padding: `p-3 sm:p-4 lg:p-5`
Page section gap: `space-y-4 sm:space-y-6`

---

## Modals
| Property | Value |
|----------|-------|
| Overlay | `bg-black/40 dark:bg-black/75 backdrop-blur-sm` |
| Content bg | `bg-white` / dark: `bg-[#1C1C1E]` |
| Border radius | `rounded-t-2xl sm:rounded-2xl` (bottom-sheet on mobile) |
| Shadow | `shadow-glass-lg` |
| Animation | `animate-scale-in` |
| Max width | `max-w-md` (default), `max-w-2xl` (large), `max-w-3xl` (xl) |
| Max height | `max-h-[100vh] sm:max-h-[90vh]` |

---

## Sidebar
| Property | Value |
|----------|-------|
| Width | `256px` (`w-64`) |
| Background | `bg-white/95 backdrop-blur-xl` / dark: `bg-[#1C1C1E]` |
| Border | `border-r border-gray-200/60` / dark: `border-[#38383A]` |
| Position | Fixed left, full height |
| Transition | `transform duration-300 ease-in-out` |

---

## Navbar / Header
| Property | Value |
|----------|-------|
| Height | `h-16` (64px) |
| Background | `bg-white/80 backdrop-blur-lg` / dark: `bg-[#000000]/80` |
| Border | `border-b border-gray-200/60` |
| Position | Fixed top, full width |

---

## Toast (react-hot-toast)
| Property | Value |
|----------|-------|
| Position | Top-right (desktop), top-center full-width (mobile) |
| Background | `bg-white/95 backdrop-blur-xl` / dark: `bg-[#1C1C1E]` |
| Border radius | `rounded-2xl` |
| Shadow | `shadow-glass-lg` |
| Variants | Success (green left border), Error (red), Warning (amber), Info (blue) |

---

## Loading States
| Element | Style |
|---------|-------|
| Spinner | `animate-spin rounded-full h-8 w-8 border-2 border-gray-200 border-t-primary-500` |
| Skeleton | `bg-gray-200/60 rounded-xl animate-pulse` / dark: `bg-[#2C2C2E]` |

---

## Empty State
| Property | Value |
|----------|-------|
| Icon container | `w-12 h-12 bg-gray-50 dark:bg-[#2C2C2E] rounded-full flex items-center justify-center` |
| Icon color | `text-gray-400 dark:text-[#636366]` |
| Title | `text-sm font-medium text-gray-900 dark:text-white` |
| Description | `text-sm text-gray-500 dark:text-[#8E8E93]` |
| CTA button | `btn btn-primary` |

---

## Technical Stack
| Item | Value |
|------|-------|
| React Router | v6.15.0 (`react-router-dom`) |
| Routing pattern | Nested routes under `/app/*` with `<ProtectedRoute>` |
| API base URL | `import.meta.env.VITE_API_URL` (fallback: `http://localhost:5001/api`) |
| Auth token storage | `localStorage` — keys: `token`, `user`, `tenant` |
| HTTP client | Axios with interceptor (auth token auto-attached) |
| Server state | TanStack React Query v5 |
| Form library | React Hook Form v7 (some forms use useState) |
| CSS framework | Tailwind CSS v3.3.3 |
| Icons | Lucide React |
| Toasts | react-hot-toast |
| Charts | Chart.js + react-chartjs-2 |
| Animations | Framer Motion + CSS keyframes |
| Build tool | Vite 4.4.9 |
| Dark mode | Class-based (`darkMode: 'class'`), toggled via ThemeContext |

---

## Chart Colors (Chart.js palette)
| Usage | Color |
|-------|-------|
| Primary line/area | `rgb(62, 196, 177)` / `rgba(62, 196, 177, 0.1)` |
| Success (collected/submitted) | `#10b981` |
| Warning (pending) | `#f59e0b` |
| Danger (overdue/late) | `#ef4444` |

---

## Glass Performance Rules (CRITICAL)

**ALLOWED backdrop-filter:** Sidebar, Navbar, Modals, Dashboard stat cards (max 6)

**ALLOWED simulated glass (no backdrop-filter):** Page section containers, Chart cards, Empty state containers

**NEVER apply glass to:** Table rows, list items (>6), form inputs, pagination, scrollable content
