# Dragon’s Nest (Command Center)

A luxury-dark dashboard for:
- GitHub repos + workflow runs
- Vercel projects + deployments
- Hugging Face models + Spaces
- Local quick tasks

## 1) Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000

## 2) Configure tokens

Create `.env.local`:

```bash
# GitHub
GITHUB_TOKEN=***

# Vercel
VERCEL_TOKEN=***
VERCEL_TEAM_ID=optional_team_id

# Hugging Face (optional)
HF_TOKEN=***
```

Then restart `npm run dev`.

## 3) Use it

Go to `/dashboard` and select:
- a GitHub repo (auto-discovered from your token)
- a Vercel project (auto-discovered from your token)
- an optional HF username

Selections are stored in the URL query params (bookmarkable).

## 4) Health + badge

- `/api/health` returns configuration status (never returns secrets)
- `/api/badge` returns a simple SVG badge

### Example badge embed (README)

```md
![Dragon’s Nest](https://YOUR-DEPLOYMENT-URL/api/badge)
```

## Security notes

- Tokens are only used on the server (Next.js Server Components + Route Handlers)
- Never commit `.env.local`
