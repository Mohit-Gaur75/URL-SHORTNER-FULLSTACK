import axios from "axios";

const API = `${import.meta.env.VITE_API_URL}/api`;

export const CSRF_HEADER = { "X-Requested-With": "XMLHttpRequest" };

let accessToken = null;
export const setAccessToken = (token) => {
  accessToken = token;
};

let onSessionEnded = () => {};
export const setSessionEndedHandler = (handler) => {
  onSessionEnded = handler;
};

const http = axios.create({ baseURL: API, withCredentials: true });

const bare = axios.create({ baseURL: API, withCredentials: true });


let refreshInFlight = null;
export function refreshSession() {
  refreshInFlight ??= bare
    .post("/auth/refresh", null, { headers: CSRF_HEADER })
    .then((res) => {
      accessToken = res.data.accessToken;
      return res.data; // { accessToken, user }
    })
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

// ---- errors ----------------------------------------------------------------

function toError(err) {
  const apiError = err.response?.data?.error;
  const message =
    apiError?.details?.[0]?.message ||
    apiError?.message ||
    (err.request ? "Cannot reach the server" : "Something went wrong");

  const error = new Error(message);
  error.status = err.response?.status;
  error.code = apiError?.code; //            e.g. "EMAIL_TAKEN", "TOKEN_EXPIRED"
  error.details = apiError?.details ?? [];
  error.requestId = err.response?.data?.requestId; // quote this in bug reports
  return error;
}

// ---- interceptors ----------------------------------------------------------
// Before every request: attach the access token if we have one
http.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  config._sentWith = accessToken; // remember which token this request carried
  return config;
});

// After every response
http.interceptors.response.use(
  (res) => res,
  async (err) => {
    const code = err.response?.data?.error?.code;
    const original = err.config;

    // The access token expired (this happens every 15 minutes): get a new one
    // and repeat the request. The user never notices. `_retried` makes sure we
    // only ever try once.
    if (err.response?.status === 401 && code === "TOKEN_EXPIRED" && original && !original._retried) {
      original._retried = true;

    
      const alreadyRefreshed = accessToken && accessToken !== original._sentWith;
      if (!alreadyRefreshed) {
        try {
          await refreshSession();
        } catch {
          // The refresh token is gone, expired, or was revoked: the session is over.
          accessToken = null;
          onSessionEnded();
          return Promise.reject(toError(err));
        }
      }
      original.headers.Authorization = `Bearer ${accessToken}`;
      return http(original);
    }

    
    if (err.response?.status === 401 && (code === "TOKEN_REVOKED" || code === "INVALID_TOKEN")) {
      accessToken = null;
      onSessionEnded();
    }

    return Promise.reject(toError(err));
  }
);

export default http;
