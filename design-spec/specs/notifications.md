### Notifications Center

Channels: In-app, Email, SMS

Features:
- Templates with variables ({{studentName}}, {{class}}, {{amount}})
- Audience filters (role, class, section)
- Scheduling and rate limits
- Read/unread, mark all read; per-user inbox

API:
- POST /api/notifications/template
- POST /api/notifications/send (bulk)
- GET /api/notifications (inbox)

UX:
- Bell icon with badge; keyboard accessible panel
- Delivery status chips; retry failed


