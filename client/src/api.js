const SERVER_URL =
  typeof window !== "undefined"
    ? import.meta.env.VITE_SERVER_URL || window.location.origin
    : "";

async function request(path, { method = "GET", body, token, retries = 2 } = {}) {
  const url = `${SERVER_URL}/api${path}`;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      const text = await res.text();
      let data = {};
      try {
        data = JSON.parse(text);
      } catch {
        data = {};
      }

      if (!res.ok) {
        throw new Error(data.error || `Server Error ${res.status}: ${text.slice(0, 80)}`);
      }
      return data;
    } catch (err) {
      const isNetworkError = err.name === "TypeError" || err.message.includes("fetch");
      if (isNetworkError && attempt < retries) {
        console.warn(`[API Network Retry] ${path} (Attempt ${attempt + 1}/${retries})...`);
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        continue;
      }
      console.error(`[API Fetch Error] ${path}:`, err);
      if (isNetworkError) {
        throw new Error("Unable to connect to the server. Please check your connection and try again.");
      }
      throw err;
    }
  }
}

export const api = {
  serverUrl: SERVER_URL,
  register: (name, email, password) => request("/auth/register", { method: "POST", body: { name, email, password } }),
  login: (email, password) => request("/auth/login", { method: "POST", body: { email, password } }),
  me: (token) => request("/auth/me", { token }),
  forgotPassword: (email) => request("/auth/forgot-password", { method: "POST", body: { email } }),
  resetPassword: (token, password) => request("/auth/reset-password", { method: "POST", body: { token, password } }),

  languages: () => request("/sessions/languages"),
  createSession: (token, title, speakerLanguage) =>
    request("/sessions", { method: "POST", body: { title, speakerLanguage }, token }),
  lookupByCode: (token, code) => request(`/sessions/by-code/${code}`, { token }),
  mySessions: (token) => request("/sessions/mine", { token }),
  sessionDetail: (token, id) => request(`/sessions/${id}`, { token }),
  summarizeSession: (token, id) => request(`/sessions/${id}/summarize`, { method: "POST", token }),
  deleteSession: (token, id) => request(`/sessions/${id}`, { method: "DELETE", token }),
  uploadSessionAudio: (token, id, audioBlob) =>
    fetch(`${SERVER_URL}/api/sessions/${id}/audio`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": audioBlob.type || "audio/webm",
      },
      body: audioBlob,
    }).then((r) => r.json()),
  speechToken: (token) => request("/speech/token", { token }),
};