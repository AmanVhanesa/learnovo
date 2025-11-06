### White-label & Theming

- Per-school theme: logo URL, primary color, accent color
- Custom login page: background image, welcome text, support link
- Preview: live theme switcher in Settings → Theme
- Optional custom domain: CNAME to tenant subdomain

Implementation:
- CSS variables derived from tokens; override per school
- Persist theme in `School.settings.theme`


