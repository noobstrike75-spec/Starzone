# Starzone — Setup Guide (Tecno Pop9 / Termux / Acode)

Your phone only needs to **edit and send** code. Building and hosting
happens on free cloud services.

## 1. One-time Termux setup

Open Termux and run:

```
pkg update && pkg upgrade -y
pkg install git nodejs -y
```

## 2. Get a free API key

Sign up at https://dashboard.api-football.com/register — the free
tier gives you 100 requests/day, enough to build and test with.

## 3. Get this project onto your phone

Open this project in Acode, then in Termux:

```
cd ~/storage/shared/starzone
git init
git add .
git commit -m "Initial scaffold"
```

## 4. Create a GitHub repo and push

1. On github.com (in your phone browser), create a new empty repo
   called `starzone`.
2. Back in Termux:

```
git remote add origin https://github.com/YOUR_USERNAME/starzone.git
git branch -M main
git push -u origin main
```

(Termux will ask for your GitHub username and a Personal Access
Token as the password — generate one at
github.com → Settings → Developer settings → Personal access tokens.)

## 5. Deploy on Vercel (this does the actual "building")

1. Go to vercel.com, sign up with your GitHub account.
2. Click "New Project" → import `starzone`.
3. In the project's Environment Variables, add:
   - `API_FOOTBALL_KEY` = your key from step 2
4. Click Deploy.

Vercel builds the whole site on their servers — your phone does
nothing heavy. You get a live URL like `starzone.vercel.app`.

## 6. Your everyday workflow after this

```
# edit files in Acode
cd ~/storage/shared/starzone
git add .
git commit -m "describe your change"
git push
```

Every push auto-redeploys the live site within ~1 minute.

## What's in this scaffold

- `app/page.js` — homepage showing today's fixtures
- `lib/api-football.js` — data-fetching layer (swap providers here later)
- `lib/predictions.js` — Poisson-model match predictor (win/draw/loss %, expected score)
- `.env.example` — copy to `.env.local` and fill in your key for local testing
