# CLAUDE.md — Learnovo Frontend

## Skills-First Workflow

Before starting any task, check available skills and read the relevant SKILL.md files:

```bash
# List all available skills
ls /mnt/skills/public/
ls /mnt/skills/user/       # User-added skills (if any)
ls /mnt/skills/examples/   # Example skills

# Read a skill before using it
cat /mnt/skills/public/<skill-name>/SKILL.md
```

**Always read the SKILL.md before writing any code or creating any file.** Multiple skills may apply to a single task — read all relevant ones.

### Skill Triggers

**File Creation Skills:**

| Task | Skill |
|------|-------|
| HTML page, landing page, React component, UI work | `frontend-design` |
| Word document, report, letter | `docx` |
| Slide deck, presentation | `pptx` |
| Spreadsheet, CSV processing | `xlsx` |
| PDF creation, reading, merging | `pdf` |
| Creating or improving skills | `skill-creator` |

**Global Skills — invoke when relevant to any task:**

| Skill | When to Invoke |
|-------|---------------|
| `api-design` | Designing or reviewing REST endpoints, pagination, error responses, versioning |
| `tdd-workflow` | Writing tests, targeting 80%+ coverage, unit/integration/E2E work |
| `security-review` | Auth flows, input validation, secrets handling, rate limiting, XSS/CSRF/injection |
| `deployment-patterns` | CI/CD, Docker, health checks, rollback, production readiness |
| `frontend-patterns` | React/Next.js work, state management, performance, UI best practices |
| `liquid-glass-design` | iOS 26 Liquid Glass UI — blur, reflection, morphing (SwiftUI/UIKit/WidgetKit) |

**Multi-skill tasks:** If a task spans multiple skills (e.g., "build a React dashboard with API integration"), read **all** relevant skill files before starting — both file creation and global skills.

---

## Stack
Tailwind CSS (CDN) · Single-file HTML · Mobile-first · ES6+

## Output Rules
- Single `index.html` with all styles inline
- Tailwind via CDN — no build step
- Mobile-first responsive design
- Serve locally with `node serve.mjs` → `http://localhost:3000`
- Never screenshot a `file:///` URL

## Screenshots
- Puppeteer is installed globally
- Only use on static UI — animations can't be captured accurately
- Run: `node screenshot.mjs http://localhost:3000`
- Min 2 comparison rounds against any reference; stop only when no visible differences remain

## Brand
- Check `brand_assets/` for logos, colors, style guides — use them
- Never invent brand colors when real ones exist
- Custom palette always — never default Tailwind blue/indigo

## Design Rules

| Rule | Do | Don't |
|------|----|-------|
| **Typography** | Display/serif headings + clean sans body | Use a single generic font for everything |
| **Heading tracking** | Tight: `-0.03em` | Default loose tracking |
| **Body line-height** | Generous: `1.7` | Cramped `1.2` or default |
| **Shadows** | Layered, color-tinted | Flat `shadow-md` |
| **Animations** | Only `transform` and `opacity` | `transition-all` |
| **Interactive states** | `hover` + `focus-visible` + `active` on every clickable element | Missing interaction feedback |
| **Images** | Placeholders via `https://placehold.co/WIDTHxHEIGHT` | Broken or missing image links |

## API Integration
- Base URL from environment, never hardcoded
- Auth token sent in `Authorization` header for protected routes
- Handle standard response shape:
```json
{ "success": true/false, "message": "...", "data": {}, "requestId": "uuid" }
```
- Show user-friendly messages from `errors[].message` on validation failures (400)
- Handle 401 → redirect to login, 403 → show permission error

## File Delivery
- All final files go to `/mnt/user-data/outputs/`
- Use `present_files` tool to share with the user
- Working/temp files stay in `/home/claude/`