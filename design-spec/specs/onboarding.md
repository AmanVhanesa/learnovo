### Onboarding Wizard (New School)

Steps (progressive):
1) School Profile: name, logo, primary color, timezone, academic year
2) Fee Heads: create default heads (Tuition, Transport, Exam), currency
3) Academic Calendar: terms/semesters, holidays, working days
4) Classes & Sections: defaults (Nursery–12), sections A/B/C
5) Admin Users: invite principal and accountant

UX:
- Save & exit anytime; autosave per step
- Inline help and examples; validation + keyboard navigable
- Final review summary with edit links

API expectations:
- POST /api/schools, then PATCH per step; id in header X-School-Id
- Upload logo to /uploads; return URL


