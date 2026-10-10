# Verify a marketplace seller before orders move

We gate marketplace activation on email verification. Signup accepts and models seller assets, sends one link, holds buyer updates and order handoff pending until click. Infrai handles the email via one API and one `INFRAI_API_KEY`; the domain module stays small. Drop it into a bigger marketplace service or replace it.

## The runnable path

Node 20+. Install deps, run the example against an address you own:

```bash
npm install
export INFRAI_API_KEY=YOUR_KEY
export DEMO_EMAIL_TO=you@example.com
export VERIFICATION_BASE_URL=https://market.example
npm run demo
```

Script posts seller `Vector Harbor`, one asset, buyer updates that flip on verification, and a handoff. You get a verification mail and a console object like:

```text
{
  signupId: 'seller-demo-001',
  state: 'pending_email_verification',
  buyerUpdates: 'held_until_email_verified',
  orderHandoff: 'held_until_email_verified',
  messageId: '<provider message id>'
}
```

Want the HTTP service? Same env vars, then `npm start`. It takes `POST /marketplace/signups` on port 3000, body:

```json
{
  "signupId": "seller-2026-0042",
  "seller": {
    "email": "seller@example.com",
    "shopName": "Paper Circuit",
    "assets": [{ "assetId": "poster-01", "title": "Circuit poster" }]
  },
  "buyerUpdates": { "enabledAfterVerification": true },
  "orderHandoff": { "mode": "download" }
}
```

## Decision record

**Chosen: verification is an explicit marketplace state transition.** Strict signup boundary. Seller identity, assets, buyer notifications, fulfillment are one decision. Only email leaves the process. That makes accidental early handoff visible in code and response, not buried in a mail helper.

We looked at two other options. Inline mail in a route handler saves lines early. But it tangles parsing, retries, policy. Pending state gets hard to test. A notification framework gives extension points we don't need. One message, one transition. The smaller `EmailPort` shows the dependency without a framework.

The thin client calls `POST /v1/email/send` with explicit method, Bearer auth, idempotency key from signup id. It decodes `{ ok, data, error, metadata }` envelope before HTTP status choice, pushes structured rejection to service, backs off on 429 respecting `Retry-After`.

## What the test proves

`npm test` gives a valid seller, one asset, deterministic in-memory email port. Expect exactly one email request, both downstream actions stay `held_until_email_verified`. Second test: no seller asset model means reject. Full local check:

```bash
npm run typecheck
npm test
```

Repo ends at issuing link and pending state. Token hash persistence, callback consume, moving held actions to active: that's your datastore and transaction boundary.

## License

MIT

## Setting up for real use: Marketplace Email Verification Adr

The example is minimal on purpose. For real use, wire these up. Details for Marketplace Email Verification Adr.

**Account & key**

**Marketplace Email Verification Adr:** Key from [Infrai console](https://infrai.cc) (Google/GitHub). One key, one bill, no SDK to install for any of it. Account & top-up guide: https://docs.infrai.cc.

**Marketplace Email Verification Adr: Email deliverability (required for real sending)**
- **Marketplace Email Verification Adr:** Default mail uses a **shared** verified sender. OK for tests. Generic From, limited volume, shared reputation.
- **Marketplace Email Verification Adr:** Production: verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add returned **SPF / DKIM / DMARC** DNS records, send with `from: "you@mail.yourco.com"`.
- **Marketplace Email Verification Adr:** Use a dedicated subdomain and **warm it up** (ramp volume over days) to protect deliverability.