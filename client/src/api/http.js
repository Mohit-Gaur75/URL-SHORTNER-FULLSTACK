import axios from "axios";

export const TOKEN_KEY = "token";

const http = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL}/api`,
});

// Runs before every request: add the token if we have one
http.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Runs after every response: turn the server's error format into a plain Error.
//
// The server answers every failure with:
//   { success: false, error: { code, message, details: [...] }, requestId }
// For validation failures `message` is a generic "Invalid request", and the
// useful sentence is in details[0].message, so we prefer that when it exists.
http.interceptors.response.use(
  (res) => res,
  (err) => {
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
    return Promise.reject(error);
  }
);

export default http;
