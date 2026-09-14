# Nativa

*Travel like a local. Explore like a global.*

A mobile-first web app that turns **destination + time available + interests + a Tourist↔Insider dial** into a short, evidence-backed itinerary — built on the thesis that popularity ≠ local relevance.

Scope for v1: Kumbakonam, Pune, and Mumbai. No login, no saved itineraries.

## Stack

- **Next.js** (App Router) + **TypeScript** + **Tailwind**, deployed on Vercel
- **Supabase Postgres** for the recommendation dataset
- Card content is generated and human-verified **ahead of time**, not at request time — the live app only filters and ranks pre-built rows, so there is no LLM call in the request path

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project layout

```
src/app/          App Router pages and API routes
scripts/          Offline data-prep pipeline (not part of the deployed app)
```
