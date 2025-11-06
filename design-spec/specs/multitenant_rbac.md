### Multi-tenant & RBAC

Model:
- Single DB; all tenant-scoped records include `schoolId`
- Global collections for billing and schools

Access:
- Roles: SuperAdmin, Admin, Teacher, Student, Parent, Accountant
- Permissions mapped to resources/actions (read, write, export)

Requests:
- Require `X-School-Id` header; enforce in middleware
- JWT includes `schoolId` and `role`

Data isolation:
- All queries filter by `schoolId`
- Index compound keys: `{ schoolId: 1, createdAt: -1 }`


