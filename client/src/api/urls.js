import http from "./http";

export const createUrl = async ({ originalUrl, customCode }) => {
  const { data } = await http.post("/urls", { originalUrl, customCode });
  return data;
};
