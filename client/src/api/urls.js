import http from "./http";

export const createUrl = async ({ originalUrl, customCode }) => {
  const { data } = await http.post("/urls", { originalUrl, customCode });
  return data;
};

export const fetchUrls = async () => {
  const { data } = await http.get("/urls");
  return data.urls;
};
