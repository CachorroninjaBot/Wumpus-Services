let sessionToken: string | null = null;
let activityFetchInstalled = false;

export function setActivitySessionToken(token: string): void {
  sessionToken = token;
  if (activityFetchInstalled || typeof window === "undefined") return;

  const originalFetch = window.fetch.bind(window);
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const tokenAtRequest = sessionToken;
    if (!tokenAtRequest) return originalFetch(input, init);

    const inputUrl = input instanceof Request ? input.url : input.toString();
    if (new URL(inputUrl, window.location.href).origin !== window.location.origin) {
      return originalFetch(input, init);
    }

    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    new Headers(init?.headers).forEach((value, name) => headers.set(name, value));
    headers.set("Authorization", `Bearer ${tokenAtRequest}`);
    return originalFetch(input, { ...init, headers });
  }) as typeof window.fetch;
  activityFetchInstalled = true;
}

export function clearActivitySessionToken(): void {
  sessionToken = null;
}

export function rememberDiscordActivityContext(): void {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.has("frame_id")) {
      window.sessionStorage.setItem("wumpus:discord-activity", "1");
      for (const key of ["frame_id", "instance_id", "platform"]) {
        const value = params.get(key);
        if (value) window.sessionStorage.setItem(`wumpus:discord-${key}`, value);
      }
      return;
    }

    const frameId = window.sessionStorage.getItem("wumpus:discord-frame_id");
    if (frameId) {
      params.set("frame_id", frameId);
      for (const key of ["instance_id", "platform"]) {
        const value = window.sessionStorage.getItem(`wumpus:discord-${key}`);
        if (value) params.set(key, value);
      }
      const query = params.toString();
      window.history.replaceState(
        window.history.state,
        "",
        `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`,
      );
    }
  } catch (error) {
    console.error("Não foi possível lembrar que a dashboard foi aberta como Activity.", error);
  }
}

export function isDiscordActivityContext(): boolean {
  if (typeof window === "undefined") return false;
  if (new URLSearchParams(window.location.search).has("frame_id")) return true;
  try {
    return window.sessionStorage.getItem("wumpus:discord-activity") === "1";
  } catch {
    return false;
  }
}
