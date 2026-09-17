import axios from "axios";

const api = axios.create({
  baseURL: "https://legalease-pdqa.onrender.com/api"
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("le_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;