import http, { CSRF_HEADER } from "./http";

export const listApiKeys = async () =>
  (await http.get("/auth/api-keys")).data.items;

export const createApiKey = async (payload) =>
  (await http.post("/auth/api-keys", payload, { headers: CSRF_HEADER })).data;

export const revokeApiKey = async (id) => {
  await http.delete(`/auth/api-keys/${id}`, { headers: CSRF_HEADER });
};
