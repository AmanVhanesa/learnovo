### Billing & Subscriptions

- Provider: Stripe (primary), Razorpay (India)
- Plans: Trial 14d, Basic, Pro (yearly). Coupon support.
- Flow:
  1. Admin clicks "Start trial" or "Subscribe" → Create Checkout session with `schoolId` metadata
  2. On success → webhook verifies event, creates `Subscription` record, issues invoice PDF, updates `School.plan`
  3. On failure/expired → send email reminder, keep trial until end
  4. Upgrade/downgrade → proration handled by provider; reflect locally on webhook

#### Webhooks

- Verify signature; idempotent handler using event id store
- Events: `checkout.session.completed`, `invoice.paid`, `customer.subscription.updated`, `customer.subscription.deleted`
- On `invoice.paid` → generate PDF invoice, email to billing contact, store in S3/local uploads

#### Data model (simplified)

- School: id, name, billingEmail, plan, trialEndsAt
- Subscription: id, schoolId, provider, status, currentPeriodEnd
- Invoice: id, schoolId, amount, currency, periodStart, periodEnd, url


