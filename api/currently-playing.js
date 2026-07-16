function sendJson(response, status, payload) {
  response.status(status).json(payload);
}

function spotifyAuthHeader() {
  return `Basic ${Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString("base64")}`;
}

function hasSpotifyConfig() {
  return Boolean(
    process.env.SPOTIFY_CLIENT_ID
      && process.env.SPOTIFY_CLIENT_SECRET
      && process.env.SPOTIFY_REFRESH_TOKEN
  );
}

async function requestAccessToken() {
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: spotifyAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: process.env.SPOTIFY_REFRESH_TOKEN,
    }),
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(data.error_description || data.error || `Spotify token request failed: ${response.status}`);
  }

  return data.access_token;
}

async function getCurrentlyPlaying() {
  const accessToken = await requestAccessToken();
  const response = await fetch("https://api.spotify.com/v1/me/player/currently-playing", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
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

module.exports = async function handler(request, response) {
  if (request.method !== "GET") {
    sendJson(response, 405, { error: "Method not allowed" });
    return;
  }

  response.setHeader("Cache-Control", "no-store");

  if (!hasSpotifyConfig()) {
    sendJson(response, 500, {
      error: "Missing Spotify environment variables.",
      text: "Spotify not connected",
    });
    return;
  }

  try {
    const current = await getCurrentlyPlaying();
    sendJson(response, 200, current);
  } catch (error) {
    sendJson(response, 500, {
      error: error.message,
      text: "Spotify not connected",
    });
  }
};
