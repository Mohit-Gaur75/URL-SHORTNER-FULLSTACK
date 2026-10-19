import http from "./http";

export const createUrl = async ({ originalUrl, customCode }) => {
  const { data } = await http.post("/urls", { originalUrl, customCode });
  return data;
};


export const listUrls = async (params, { signal } = {}) => {
  const { data } = await http.get("/urls", { params, signal });
  return data; // { items: [...], pagination: { page, limit, total, totalPages, hasNext, hasPrev } }
};

export const updateUrl = async (id, changes) => {
  const { data } = await http.patch(`/urls/${id}`, changes);
  return data;
};

export const deleteUrl = async (id) => {
  await http.delete(`/urls/${id}`);
};
