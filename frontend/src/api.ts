const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

async function req(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${BASE}/api${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}

export const api = {
  // priorities
  listPriorities: (date: string) => req(`/priorities?date=${date}`),
  createPriority: (date: string, text: string, order = 0) =>
    req(`/priorities`, { method: "POST", body: JSON.stringify({ date, text, order }) }),
  updatePriority: (id: string, body: any) =>
    req(`/priorities/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deletePriority: (id: string) => req(`/priorities/${id}`, { method: "DELETE" }),

  // watch goals
  getWatchGoal: (date: string) => req(`/watch-goals?date=${date}`),
  updateWatchGoal: (date: string, body: any) =>
    req(`/watch-goals?date=${date}`, { method: "PATCH", body: JSON.stringify(body) }),

  // planner
  listEvents: (month?: string) => req(`/planner${month ? `?month=${month}` : ""}`),
  createEvent: (body: any) => req(`/planner`, { method: "POST", body: JSON.stringify(body) }),
  deleteEvent: (id: string) => req(`/planner/${id}`, { method: "DELETE" }),

  // fitness
  getProgram: () => req(`/fitness/program`),
  listFitnessLogs: (day_key?: string) => req(`/fitness/logs${day_key ? `?day_key=${day_key}` : ""}`),
  addFitnessLog: (body: any) => req(`/fitness/logs`, { method: "POST", body: JSON.stringify(body) }),

  // firm
  listProjects: () => req(`/firm/projects`),
  createProject: (body: any) => req(`/firm/projects`, { method: "POST", body: JSON.stringify(body) }),
  updateProject: (id: string, body: any) =>
    req(`/firm/projects/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteProject: (id: string) => req(`/firm/projects/${id}`, { method: "DELETE" }),

  // cycle
  getCycle: () => req(`/cycle`),
  setCycle: (body: any) => req(`/cycle`, { method: "PUT", body: JSON.stringify(body) }),
  listCycleLogs: () => req(`/cycle/logs`),
  addCycleLog: (body: any) => req(`/cycle/logs`, { method: "POST", body: JSON.stringify(body) }),

  // measurements
  listMeasurements: () => req(`/measurements`),
  addMeasurement: (body: any) => req(`/measurements`, { method: "POST", body: JSON.stringify(body) }),

  // mind
  listMind: () => req(`/mind`),
  addMind: (text: string) => req(`/mind`, { method: "POST", body: JSON.stringify({ text }) }),
  deleteMind: (id: string) => req(`/mind/${id}`, { method: "DELETE" }),

  // meera
  meeraChat: (message: string) =>
    req(`/meera/chat`, { method: "POST", body: JSON.stringify({ message, session_id: "meera-default" }) }),
  meeraMessages: () => req(`/meera/messages`),

  // inspiration
  inspiration: () => req(`/inspiration`),
};

export const todayStr = () => new Date().toISOString().slice(0, 10);
