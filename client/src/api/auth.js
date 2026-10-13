import http, { CSRF_HEADER, refreshSession } from "./http";


export const registerUser = async (payload) =>
  (await http.post("/auth/register", payload)).data;

export const loginUser = async (payload) =>
  (await http.post("/auth/login", payload)).data;

export const restoreSession = () => refreshSession();

export const logoutUser = async () => {
  await http.post("/auth/logout", null, { headers: CSRF_HEADER });
};

export const fetchMe = async () => (await http.get("/auth/me")).data.user;
