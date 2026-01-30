# Rental Agency SaaS

Modular multi-tenant rental agency platform built with Next.js App Router, TypeScript, Tailwind, and Supabase.

## Setup

1. Create a Supabase project.
2. Create storage buckets:
   - `avatars`
   - `rental_docs`
3. Apply SQL:
   - Run `supabase/schema.sql`
   - Run `supabase/rls.sql`
   - (Optional) Run `supabase/seed.sql`
4. Set environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `RESEND_API_KEY`
   - `INVOICE_FROM_EMAIL`
5. Install dependencies and start:
   - `npm install`
   - `npm run dev`

## Notes

- The app uses server actions and the Supabase server client for data operations.
- Tenant isolation is enforced via RLS using `tenant_id`.
- Admins can approve rentals and bonuses, which creates ledger entries.
- Sourcing agreement uploads require exactly 4 images.
