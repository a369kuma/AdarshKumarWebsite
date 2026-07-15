const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const ROOT = __dirname;
const ENV_PATH = path.join(ROOT, ".env");
const TOKEN_PATH = path.join(ROOT, ".spotify-refresh-token");
const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

function loadEnv() {
  if (!fs.existsSync(ENV_PATH)) return;

  const lines = fs.readFileSync(ENV_PATH, "utf8").split(/\r?\n/);
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;

    const separator = trimmed.indexOf("=");
    if (separator === -1) return;

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
    if (key && !process.env[key]) {
      process.env[key] = value;
    }
  });
}

function send(response, status, body, headers = {}) {
  response.writeHead(status, {
    "Cache-Control": "no-store",
    ...headers,
  });
  response.end(body);
}

function sendJson(response, status, payload) {
  send(response, status, JSON.stringify(payload), {
    "Content-Type": "application/json; charset=utf-8",
  });
}

function getSpotifyConfig() {
  return {
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    redirectUri: process.env.SPOTIFY_REDIRECT_URI || "http://127.0.0.1:8888/callback",
  };
}

function assertSpotifyConfig(response) {
  const config = getSpotifyConfig();
  const hasRealValues = config.clientId
    && config.clientSecret
    && config.redirectUri
    && !config.clientId.includes("your_client")
    && !config.clientSecret.includes("your_client");

  if (hasRealValues) {
    return config;
  }

  sendJson(response, 500, {
    error: "Missing Spotify config. Add your real SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET to .env.",
  });
  return null;
}

function spotifyAuthHeader(config) {
  return `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`;
}

async function requestAccessToken(config, params) {
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: spotifyAuthHeader(config),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(data.error_description || data.error || `Spotify token request failed: ${response.status}`);
  }

  return data;
}

async function exchangeCodeForToken(code) {
  const config = getSpotifyConfig();
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: config.redirectUri,
  });

  return requestAccessToken(config, params);
}

async function refreshAccessToken() {
  const config = getSpotifyConfig();
  const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN
    || (fs.existsSync(TOKEN_PATH) ? fs.readFileSync(TOKEN_PATH, "utf8").trim() : "");

  if (!refreshToken) {
    throw new Error("Missing refresh token. Visit /login and approve Spotify access first.");
  }

  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  return requestAccessToken(config, params);
}

async function getCurrentlyPlaying() {
  const token = await refreshAccessToken();
  const response = await fetch("https://api.spotify.com/v1/me/player/currently-playing", {
    headers: {
      Authorization: `Bearer ${token.access_token}`,
    },
  });

  if (response.status === 204) {
    return { isPlaying: false, text: "Not playing anything" };
  }

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(data.error?.message || `Spotify currently-playing request failed: ${response.status}`);
  }

  if (!data?.item) {
    return { isPlaying: false, text: "Not playing anything" };
  }

  const title = data.item.name || "Unknown track";
  const artists = Array.isArray(data.item.artists)
    ? data.item.artists.map((artist) => artist.name).filter(Boolean).join(", ")
    : "";

  return {
    isPlaying: Boolean(data.is_playing),
    title,
    artists,
    text: artists ? `${title} - ${artists}` : title,
    url: data.item.external_urls?.spotify || null,
  };
}

function safeStaticPath(pathname) {
  const decoded = decodeURIComponent(pathname);
  const requested = decoded === "/" ? "/index.html" : decoded;
  const segments = requested.split("/").filter(Boolean);
  if (segments.some((segment) => segment.startsWith("."))) {
    return null;
  }

  const fullPath = path.normalize(path.join(ROOT, requested));

  if (!fullPath.startsWith(ROOT)) {
    return null;
  }

  const allowedRootFiles = new Set(["index.html", "styles.css", "script.js"]);
  const relativePath = path.relative(ROOT, fullPath);
  if (!relativePath.startsWith(`assets${path.sep}`) && !allowedRootFiles.has(relativePath)) {
    return null;
  }

  return fullPath;
}

function serveStatic(request, response, url) {
  const fullPath = safeStaticPath(url.pathname);
  if (!fullPath || !fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
    send(response, 404, "Not found", { "Content-Type": "text/plain; charset=utf-8" });
    return;
  }

  const extension = path.extname(fullPath);
  response.writeHead(200, {
    "Content-Type": MIME_TYPES[extension] || "application/octet-stream",
  });
  fs.createReadStream(fullPath).pipe(response);
}

async function handleLogin(response) {
  const config = assertSpotifyConfig(response);
  if (!config) return;

  const state = crypto.randomBytes(16).toString("hex");
  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    scope: "user-read-currently-playing",
    redirect_uri: config.redirectUri,
    state,
  });

  response.writeHead(302, {
    Location: `https://accounts.spotify.com/authorize?${params}`,
  });
  response.end();
}

async function handleCallback(response, url) {
  const config = assertSpotifyConfig(response);
  if (!config) return;

  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    send(response, 400, `Spotify authorization failed: ${error}`, { "Content-Type": "text/plain; charset=utf-8" });
    return;
  }

  if (!code) {
    send(response, 400, "Missing Spotify authorization code.", { "Content-Type": "text/plain; charset=utf-8" });
    return;
  }

  try {
    const token = await exchangeCodeForToken(code);
    if (!token.refresh_token) {
      throw new Error("Spotify did not return a refresh token. Remove the app approval in Spotify and try /login again.");
    }

    fs.writeFileSync(TOKEN_PATH, token.refresh_token, { mode: 0o600 });
    send(response, 200, `
      <!doctype html>
      <html lang="en">
        <meta charset="utf-8" />
        <title>Spotify connected</title>
        <body style="font-family: system-ui; padding: 32px;">
          <h1>Spotify connected.</h1>
          <p>Your currently-playing token is saved locally. You can go back to the portfolio.</p>
          <p><a href="/">Open portfolio</a></p>
        </body>
      </html>
    `, { "Content-Type": "text/html; charset=utf-8" });
  } catch (error) {
    send(response, 500, error.message, { "Content-Type": "text/plain; charset=utf-8" });
  }
}

async function handleCurrentlyPlaying(response) {
  const config = assertSpotifyConfig(response);
  if (!config) return;

  try {
    const current = await getCurrentlyPlaying();
    sendJson(response, 200, current);
  } catch (error) {
    sendJson(response, 500, {
      error: error.message,
      text: "Spotify not connected",
    });
  }
}

loadEnv();

const server = http.createServer((request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (request.method === "GET" && url.pathname === "/login") {
    handleLogin(response);
    return;
  }

  if (request.method === "GET" && url.pathname === "/callback") {
    handleCallback(response, url);
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/currently-playing") {
    handleCurrentlyPlaying(response);
    return;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    send(response, 405, "Method not allowed", { "Content-Type": "text/plain; charset=utf-8" });
    return;
  }

  serveStatic(request, response, url);
});

const port = Number(process.env.PORT || 8888);
server.listen(port, "127.0.0.1", () => {
  console.log(`Portfolio running at http://127.0.0.1:${port}/`);
  console.log(`Spotify login: http://127.0.0.1:${port}/login`);
});
