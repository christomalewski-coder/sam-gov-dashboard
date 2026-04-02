# SAM.gov Hosted Dashboard Package

This is a hosted-ready starter package for a SAM.gov dashboard focused on lighting, ESCO, and SDVOSB pursuits.

## What this package does

- calls the SAM.gov Opportunities API through a serverless relay
- keeps your API key on the server side, not in the browser
- filters and scores opportunities for:
  - lighting
  - ESCO
  - controls
  - energy savings
  - sports lighting
  - street lighting
  - maintenance
- shows:
  - open opportunities
  - pursue / review / watch buckets
  - due-soon items
  - top states by value
  - filterable opportunity table

## Files

- `index.html` - browser dashboard
- `api/search.js` - Vercel serverless API relay + scoring engine
- `.env.example` - environment variable template
- `vercel.json` - Vercel routing config
- `package.json` - minimal project metadata

## Before you deploy

Rotate any SAM.gov API key that has been shared in chat or email, then use the new key below.

## Deploy on Vercel

1. Create a new GitHub repo and upload these files
2. Create a Vercel account and import the repo
3. In Vercel project settings, add this environment variable:

   - `SAM_API_KEY` = your current SAM.gov API key

4. Deploy
5. Open your deployed site
6. Use the search controls to pull live opportunities

## Local test

If you want to test locally with Vercel CLI:

1. install Node.js
2. install Vercel CLI
3. run:
   - `vercel dev`

Then open the local URL Vercel gives you.

## API route

The frontend calls:

- `/api/search`

Query params supported:

- `postedFromDays`
- `limit`
- `q`
- `state`
- `setAside`
- `tier`
- `owner`

## Scoring model

The relay scores each opportunity using:

- keyword match
- target agency match
- set-aside match
- NAICS / PSC match
- state tier weight
- due-soon boost
- estimated value boost

Priority buckets:

- Pursue
- Review
- Watch
- Expired

## Notes

- This starter is intentionally lightweight
- It does not require Power BI
- It works well on Mac because it is browser-native
- You can extend it later with login, saved notes, CRM stages, and email alerts
