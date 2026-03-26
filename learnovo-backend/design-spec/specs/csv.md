### CSV Import/Export

Entities: Students, Fees, Attendance

Import Flow:
1) Download sample CSV → map columns → validate preview (first 20 rows)
2) Errors grouped with row numbers; allow fix & re-upload
3) Background import job; notify on completion

Export Flow:
- Filters (date range, class, section); schedule recurring exports weekly/monthly

Backend:
- Async jobs with status: queued, processing, completed, failed
- Webhook or polling endpoint for status; downloadable URL on completion

CSV Columns (Students): name, admissionNo, class, section, guardianPhone, dob, gender


