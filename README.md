# Adarsh Kumar Website

A lightweight personal website for Adarsh Kumar.

## Files

- `index.html` contains the page content.
- `styles.css` contains the responsive layout and visual design.
- `script.js` contains navigation behavior, Spotify display polling, and hero canvas animation.
- `server.js` serves the site locally and proxies Spotify's currently-playing API.

## Local Spotify Setup

1. Copy `.env.example` to `.env`.
2. Paste your Spotify app values into `.env`.
3. Run `npm start`.
4. Open `http://127.0.0.1:8888/login` once and approve Spotify access.
5. Open `http://127.0.0.1:8888/`.

The refresh token is saved locally in `.spotify-refresh-token`, which is ignored by git.

## Vercel Spotify Setup

The homepage calls `/api/currently-playing`, which is implemented for Vercel in
`api/currently-playing.js`.

Add these Environment Variables in Vercel:

- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `SPOTIFY_REFRESH_TOKEN`

Use the local `.spotify-refresh-token` value for `SPOTIFY_REFRESH_TOKEN`. Do not
commit `.env` or `.spotify-refresh-token`.
