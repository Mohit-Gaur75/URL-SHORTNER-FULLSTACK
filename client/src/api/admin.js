import http from "./http";

export const getAdminOverview = async () => {
  const { data } = await http.get("/admin/overview");
  return data;
};
