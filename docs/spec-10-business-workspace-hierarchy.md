# Spec 10 — Business / Workspace Hierarchy

**Status: NOT NEEDED. Closed 2026-08-19 without building anything.**

This started as a spec for making a business *own* several workspaces. On
working through what was actually wanted, the answer turned out to be: the model
already does it. This file exists so the idea is not proposed again from scratch.

---

## What was asked for

> "One person can be part of several businesses or business workspaces. I own 3
> businesses, so I'm part of three different business workspaces, all with
> different books, because I'm the owner of those businesses."

> "I own a business and I'm an advisor for another company. I have my own
> business workspace, and I can look at the other business workspace for the
> company I advise."

## Why nothing needs building

The term is **business workspace** — one thing, not two. A business workspace is
one business, one set of books. People attach to it with a role.

That is exactly the existing schema:

- `businesses` — one row per business workspace
- `business_members (business_id, user_id, role)` — many-to-many, so one person
  can belong to any number of workspaces, with a **different role in each**
- `business_id` is the tenancy key on 24 tables, so every workspace already has
  its own chart of accounts, ledger, invoices, customers and reports

Verified against live data on 2026-08-19:

| account | workspaces | owns | member of |
|---|---|---|---|
| jeeordahnoh@gmail.com | 5 | 5 | 0 |
| jeeordahnoh2@gmail.com | 2 | 1 | 1 |
| fiscalaidotcom@gmail.com | 2 | 1 | 1 |

...and each workspace holds its own accounts and entries — separate books, no
sharing:

| workspace | own accounts | own entries |
|---|---|---|
| JRDO RE Capital | 10 | 7 |
| Finquanta | 10 | 4 |
| Upmark | 10 | 3 |

Both stated examples are already satisfied. The advisor case is the second row of
the first table: owner of one workspace, member of another.

## What a hierarchy would have been for, and why it was rejected

A parent object owning several workspaces solves a *different* problem: a holding
company that wants one login, one subscription and **consolidated reporting**
across subsidiaries. That brings intercompany elimination, a shared chart of
accounts or a mapping between several, and group-level billing.

None of that was wanted. Three businesses owned by one person are three separate
things that happen to share a person — which is precisely what the flat model
expresses.

**If it is ever revisited**, the trigger is a customer asking for a consolidated
P&L across workspaces. Until somebody asks for that, the parent table has no job.

## The only real work here: naming

The concept is **"business workspace"**. The codebase and UI have drifted between
"business" and "workspace" as if they were different things — they are not.

- Internal names stay as they are. `businesses`, `business_members` and
  `business_id` are on 24 tables and renaming them buys nothing.
- **User-facing text** should say "business workspace" (or "workspace" where
  context makes it obvious), consistently, in all ten locales.

That is a copy change, not an architecture change.

## Related

- `finquanta-next-up.md` — the parked note that led here
- Spec 08 — billing, which is per business workspace and stays that way
