import http from "./http";

export const listWebhooks = async () =>
  (await http.get("/webhooks")).data.webhooks;

export const createWebhook = async (payload) =>
  (await http.post("/webhooks", payload)).data;

export const updateWebhook = async (id, changes) =>
  (await http.patch(`/webhooks/${id}`, changes)).data;

export const deleteWebhook = async (id) => {
  await http.delete(`/webhooks/${id}`);
};

export const testWebhook = async (id) =>
  (await http.post(`/webhooks/${id}/test`)).data;
