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

// Runs after every response: normalize errors
http.interceptors.response.use(
  (res) => res,
  (err) => {
    const message =
      err.response?.data?.message ||
      (err.request ? "Cannot reach the server" : "Something went wrong");
    const error = new Error(message);
    error.status = err.response?.status;
    return Promise.reject(error);
  }
);

export default http;
