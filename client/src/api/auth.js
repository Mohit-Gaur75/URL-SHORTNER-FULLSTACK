import http from "./http";

export const registerUser = async (payload) =>
  (await http.post("/auth/register", payload)).data;

export const loginUser = async (payload) =>
  (await http.post("/auth/login", payload)).data;

export const fetchMe = async () => (await http.get("/auth/me")).data.user;
