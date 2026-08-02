export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {},
  userId?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  // Attach user ID if provided (or default demo user if unauthenticated for testing)
  if (userId) {
    headers['x-user-id'] = userId;
  }

  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const errorData = (await res.json().catch(() => ({ message: 'API request failed' }))) as { message?: string };
    throw new Error(errorData.message || `Request failed with status ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export const apiClient = {
  // USERS
  getProfile: (userId: string) => fetchApi<Record<string, unknown>>('/users/me', { method: 'GET' }, userId),
  updateProfile: (userId: string, data: { name: string }) =>
    fetchApi<{ id: string; name: string; email: string }>('/users/profile', { method: 'PATCH', body: JSON.stringify(data) }, userId),

  // TEAMS
  createTeam: (userId: string, data: { name: string; companyName: string; discoverable?: boolean }) =>
    fetchApi('/teams', { method: 'POST', body: JSON.stringify(data) }, userId),

  getUserTeams: (userId: string) => fetchApi<Record<string, unknown>>('/teams', { method: 'GET' }, userId),

  searchTeams: (userId: string, query: string) =>
    fetchApi<Record<string, unknown>[]>(`/teams/search?q=${encodeURIComponent(query)}`, { method: 'GET' }, userId),

  getTeamDetails: (userId: string, teamId: string) =>
    fetchApi<Record<string, unknown>>(`/teams/${teamId}`, { method: 'GET' }, userId),

  updateTeam: (userId: string, teamId: string, data: Record<string, unknown>) =>
    fetchApi<Record<string, unknown>>(`/teams/${teamId}`, { method: 'PATCH', body: JSON.stringify(data) }, userId),

  deleteTeam: (userId: string, teamId: string) =>
    fetchApi<{ message: string }>(`/teams/${teamId}`, { method: 'DELETE' }, userId),

  // MEMBERSHIP
  sendJoinRequest: (userId: string, teamId: string) =>
    fetchApi(`/teams/${teamId}/join-request`, { method: 'POST' }, userId),

  joinViaInviteCode: (userId: string, inviteCode: string) =>
    fetchApi(`/teams/join/${inviteCode}`, { method: 'POST' }, userId),

  getPendingRequests: (userId: string, teamId: string) =>
    fetchApi<Record<string, unknown>[]>(`/teams/${teamId}/join-requests`, { method: 'GET' }, userId),

  respondToJoinRequest: (userId: string, teamId: string, requestId: string, status: 'ACCEPTED' | 'DECLINED') =>
    fetchApi(`/teams/${teamId}/join-requests/${requestId}`, { method: 'PATCH', body: JSON.stringify({ status }) }, userId),

  removeMember: (userId: string, teamId: string, memberUserId: string) =>
    fetchApi(`/teams/${teamId}/members/${memberUserId}`, { method: 'DELETE' }, userId),

  changeMemberRole: (userId: string, teamId: string, memberUserId: string, role: 'ADMIN' | 'MEMBER') =>
    fetchApi(`/teams/${teamId}/members/${memberUserId}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }, userId),

  // STANDUPS
  submitStandup: (userId: string, data: { teamId: string; yesterday: string; today: string; blockers?: string }) =>
    fetchApi('/standups', { method: 'POST', body: JSON.stringify(data) }, userId),

  getTeamStandups: (userId: string, teamId: string, date?: string) =>
    fetchApi<Record<string, unknown>>(`/standups?teamId=${teamId}${date ? `&date=${date}` : ''}`, { method: 'GET' }, userId),

  getMyStandups: (userId: string, teamId?: string, date?: string) => {
    const params = new URLSearchParams();
    if (teamId) params.append('teamId', teamId);
    if (date) params.append('date', date);
    const queryString = params.toString();
    return fetchApi<Record<string, unknown>[]>(`/standups/me${queryString ? `?${queryString}` : ''}`, { method: 'GET' }, userId);
  },

  // DIGESTS
  triggerDigestGeneration: (userId: string, teamId: string, date?: string) =>
    fetchApi('/digests/generate', { method: 'POST', body: JSON.stringify({ teamId, date }) }, userId),

  getTeamDigests: (userId: string, teamId: string, date?: string) =>
    fetchApi<Record<string, unknown>[]>(`/digests?teamId=${teamId}${date ? `&date=${date}` : ''}`, { method: 'GET' }, userId),

  getGroupedUserDigests: (userId: string) =>
    fetchApi<Record<string, unknown>[]>('/digests/grouped', { method: 'GET' }, userId),

  // PROJECTS
  getProjects: (userId: string, teamId?: string) =>
    fetchApi<Record<string, unknown>[]>(`/projects${teamId ? `?teamId=${teamId}` : ''}`, { method: 'GET' }, userId),
  createProject: (userId: string, data: { teamId: string; name: string; description?: string; color?: string }) =>
    fetchApi<Record<string, unknown>>('/projects', { method: 'POST', body: JSON.stringify(data) }, userId),
  getProjectDetails: (userId: string, id: string) =>
    fetchApi<Record<string, unknown>>(`/projects/${id}`, { method: 'GET' }, userId),
  updateProject: (userId: string, id: string, data: Record<string, unknown>) =>
    fetchApi<Record<string, unknown>>(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(data) }, userId),
  deleteProject: (userId: string, id: string) =>
    fetchApi<{ message: string }>(`/projects/${id}`, { method: 'DELETE' }, userId),

  // TASKS
  getTasks: (userId: string, projectId: string) =>
    fetchApi<Record<string, unknown>[]>(`/tasks?projectId=${projectId}`, { method: 'GET' }, userId),
  createTask: (userId: string, data: { projectId: string; title: string; description?: string; status?: string; priority?: string; assigneeIds?: string[]; dueDate?: string }) =>
    fetchApi<Record<string, unknown>>('/tasks', { method: 'POST', body: JSON.stringify(data) }, userId),
  getTaskDetails: (userId: string, id: string) =>
    fetchApi<Record<string, unknown>>(`/tasks/${id}`, { method: 'GET' }, userId),
  updateTask: (userId: string, id: string, data: Record<string, unknown>) =>
    fetchApi<Record<string, unknown>>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }, userId),
  deleteTask: (userId: string, id: string) =>
    fetchApi<{ message: string }>(`/tasks/${id}`, { method: 'DELETE' }, userId),
  addTaskComment: (userId: string, taskId: string, data: { content: string }) =>
    fetchApi<Record<string, unknown>>(`/tasks/${taskId}/comments`, { method: 'POST', body: JSON.stringify(data) }, userId),
  getMyAssignedTasks: (userId: string) =>
    fetchApi<Record<string, unknown>[]>('/tasks/my/assigned', { method: 'GET' }, userId),
  createSubtask: (userId: string, taskId: string, title: string) =>
    fetchApi<Record<string, unknown>>(`/tasks/${taskId}/subtasks`, { method: 'POST', body: JSON.stringify({ title }) }, userId),
  toggleSubtask: (userId: string, taskId: string, subtaskId: string, isDone: boolean) =>
    fetchApi<Record<string, unknown>>(`/tasks/${taskId}/subtasks/${subtaskId}`, { method: 'PATCH', body: JSON.stringify({ isDone }) }, userId),
  deleteSubtask: (userId: string, taskId: string, subtaskId: string) =>
    fetchApi<{ message: string }>(`/tasks/${taskId}/subtasks/${subtaskId}`, { method: 'DELETE' }, userId),
  getTeamWorkload: (userId: string, teamId: string) =>
    fetchApi<Record<string, number>>(`/tasks/team/${teamId}/workload`, { method: 'GET' }, userId),
  getLeaderPendingReviews: (userId: string) =>
    fetchApi<Record<string, unknown>[]>('/tasks/leader/pending-reviews', { method: 'GET' }, userId),

  // NOTIFICATIONS
  getNotifications: (userId: string) =>
    fetchApi<Record<string, unknown>[]>('/notifications', { method: 'GET' }, userId),

  markNotificationAsRead: (userId: string, id: string) =>
    fetchApi(`/notifications/${id}/read`, { method: 'PATCH' }, userId),

  markAllNotificationsAsRead: (userId: string) =>
    fetchApi('/notifications/read-all', { method: 'POST' }, userId),
};
