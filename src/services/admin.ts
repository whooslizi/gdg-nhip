import { api, API_URL, ApiError } from '@/lib/api-client';

export interface AdminEvent {
  eventid: number;
  eventname: string;
  directors: string[];
  actors: string[];
  types: string[];
  languages: string[];
  poster: string | null;
  duration: number;
  startat: string;
  endat: string;
}

export interface AdminShowtime {
  showtimeid: number;
  eventid: number;
  roomid: number;
  startat: string;
  endat: string;
  status: string;
}

export interface AdminArea {
  areaid: number;
  areaname: string;
}

export interface AdminCinema {
  cinemaid: number;
  cinemaname: string;
  areaid: number;
  locate: string;
}

export interface AdminRoom {
  roomid: number;
  roomname: string;
  cinemaid: number;
}

export interface AdminAreaTree extends AdminArea {
  cinemas: (AdminCinema & { rooms: AdminRoom[] })[];
}

const ensureBackend = () => {
  if (!API_URL) throw new ApiError(503, 'ADMIN_API_UNAVAILABLE', 'Admin requires a backend API.');
};

export async function adminLogin(username: string, password: string) {
  ensureBackend();
  return api<{ token: string; expiresAt: number; username: string }>('/admin/login', {
    method: 'POST',
    body: { username, password },
  });
}

export const getAdminSession = (token: string) =>
  api<{ username: string; expiresAt: number }>('/admin/session', { authToken: token });

export const listAdminEvents = (token: string) => api<AdminEvent[]>('/events', { authToken: token });
export const listAdminAreas = (token: string) => api<AdminArea[]>('/areas', { authToken: token });

export const listAdminShowtimes = (eventId: number, token: string) =>
  api<{ eventId: number; showtimes: AdminShowtime[] }>(`/events/${eventId}/showtimes`, {
    authToken: token,
  }).then((result) => result.showtimes);

export const listAreaCinemas = (areaId: number, token: string) =>
  api<{ areaId: number; cinemas: AdminCinema[] }>(`/areas/${areaId}/cinemas`, {
    authToken: token,
  }).then((result) => result.cinemas);

export const listCinemaRooms = (cinemaId: number, token: string) =>
  api<{ cinemaId: number; rooms: AdminRoom[] }>(`/cinemas/${cinemaId}/rooms`, {
    authToken: token,
  }).then((result) => result.rooms);

export async function getAdminFacilityTree(token: string): Promise<AdminAreaTree[]> {
  const areas = await listAdminAreas(token);
  return Promise.all(
    areas.map(async (area) => {
      const cinemas = await listAreaCinemas(area.areaid, token);
      return {
        ...area,
        cinemas: await Promise.all(
          cinemas.map(async (cinema) => ({
            ...cinema,
            rooms: await listCinemaRooms(cinema.cinemaid, token),
          })),
        ),
      };
    }),
  );
}

export const createAdminArea = (token: string, areaName: string) =>
  api<AdminArea>('/admin/areas', { method: 'POST', body: { areaName }, authToken: token });

export const createAdminCinema = (
  token: string,
  body: { cinemaName: string; areaId: number; locate: string },
) => api<AdminCinema>('/admin/cinemas', { method: 'POST', body, authToken: token });

export const createAdminRoom = (
  token: string,
  body: { roomName: string; cinemaId: number },
) => api<AdminRoom>('/admin/rooms', { method: 'POST', body, authToken: token });

export const deleteAdminArea = (areaId: number, token: string) =>
  api<{ areaid: number }>(`/admin/areas/${areaId}`, { method: 'DELETE', authToken: token });

export const deleteAdminCinema = (cinemaId: number, token: string) =>
  api<{ cinemaid: number }>(`/admin/cinemas/${cinemaId}`, { method: 'DELETE', authToken: token });

export const deleteAdminRoom = (roomId: number, token: string) =>
  api<{ roomid: number }>(`/admin/rooms/${roomId}`, { method: 'DELETE', authToken: token });

export const createAdminEvent = (token: string, body: Record<string, unknown>) =>
  api<AdminEvent>('/admin/events', { method: 'POST', body, authToken: token });

export const updateAdminEvent = (
  eventId: number,
  token: string,
  body: Record<string, unknown>,
) => api<AdminEvent>(`/admin/events/${eventId}`, { method: 'PATCH', body, authToken: token });

export const createAdminShowtime = (token: string, body: Record<string, unknown>) =>
  api<AdminShowtime>('/admin/showtimes', { method: 'POST', body, authToken: token });

export const updateAdminShowtime = (
  showtimeId: number,
  token: string,
  body: Record<string, unknown>,
) =>
  api<AdminShowtime>(`/admin/showtimes/${showtimeId}`, { method: 'PATCH', body, authToken: token });