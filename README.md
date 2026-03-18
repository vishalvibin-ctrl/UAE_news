# UAE Daily — News Briefing v3

Fast, reliable UAE news app with Instagram Reels-style scrolling.

## What's new in v3
- **Own serverless API** (`/api/feed.js`) — no more slow third-party proxies
- **5-minute client-side cache** — instant navigation between tabs
- **Retry with fallback** — own API → rss2json as backup
- **Reels mode** — full-screen vertical snap scrolling

## Project structure
```
├── api/
│   └── feed.js          ← Vercel serverless function (fetches RSS server-side)
├── src/
│   ├── App.jsx          ← Main React app
│   └── main.jsx         ← Entry point
├── public/
│   └── manifest.json    ← PWA manifest
├── index.html
├── package.json
├── vite.config.js
└── vercel.json          ← Routes API and frontend
```

## Deploy
1. Create GitHub repo `uae-news`
2. Upload all files (including `api/` folder and `vercel.json`)
3. Import on Vercel → Deploy
4. Open on iPhone → Add to Home Screen
