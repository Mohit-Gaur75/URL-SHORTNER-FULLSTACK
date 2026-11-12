import http, { CSRF_HEADER, refreshSession } from "./http";

export const registerUser = async (payload) =>
  (await http.post("/auth/register", payload)).data;

export const loginUser = async (payload) =>
  (await http.post("/auth/login", payload)).data;

export const restoreSession = () => refreshSession();

export const logoutUser = async () => {
  await http.post("/auth/logout", null, { headers: CSRF_HEADER });
};

export const logoutEverywhere = async () => {
  await http.post("/auth/logout-all", null, { headers: CSRF_HEADER });
};

export const fetchMe = async () => (await http.get("/auth/me")).data.user;

export const updateProfile = async (payload) =>
  (await http.patch("/auth/profile", payload)).data;

export const changePassword = async (payload) =>
  (await http.post("/auth/change-password", payload, { headers: CSRF_HEADER })).data;
