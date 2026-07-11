const BASE_URL = 'https://taskai-backend-6h3x.onrender.com';

export interface Step {
  step_number: number;
  phase: string;
  title: string;
  description: string;
  pro_tip?: string;
  duration_minutes: number;
  safety_note?: string | null;
}

export interface Material {
  name: string;
  quantity: number;
  unit: string;
  estimated_cost_aud: number;
  purpose?: string;
  links?: { store: string; url: string }[];
}

export interface RepairState {
  before: {
    material: string;
    colour: string;
    finish: string;
    damage_types: string[];
    damage_location: string;
    damage_dimensions: string;
    surrounding_condition: string;
    moisture_visible: boolean;
  };
  after: {
    material: string;
    colour: string;
    finish: string;
    condition: string;
    resolutions: Record<string, string>;
    texture_profile: string;
    light_profile: string;
  };
  inpaint_prompt: string;
  prompt_confidence: number;
  engine: string;
}

export interface AnalyseResult {
  problem: string;
  severity: 'low' | 'medium' | 'high';
  surface_material: string;
  surface_colour?: string;
  damage_types?: string[];
  root_cause: string;
  is_structural: boolean;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimated_time_hours: number;
  estimated_cost_aud_min: number;
  estimated_cost_aud_max: number;
  confidence: number;
  confidence_level: string;
  safety_notes: string[];
  steps: Step[];
  materials: Material[];
  tools_required: string[];
  safety_equipment: string[];
  repair_state?: RepairState;
  when_to_call_professional: string;
  inpaint_prompt: string;
  image_url?: string;
  pipeline: string;
}

export interface ChatResponse {
  reply: string;
  chat_id: string;
  cached: boolean;
  materials: Material[];
}

export interface Job {
  id: string;
  image_url?: string;
  result: AnalyseResult;
  created_at: string;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).detail || `Request failed: ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export async function analyseImage(imageUri: string, filename: string): Promise<AnalyseResult> {
  const body = new FormData();
  body.append('file', { uri: imageUri, name: filename, type: 'image/jpeg' } as any);
  return request<AnalyseResult>('/analyse', { method: 'POST', body });
}

export async function sendChat(
  message: string,
  chatId?: string,
  userId?: string,
  token?: string,
): Promise<ChatResponse> {
  return request<ChatResponse>(
    '/chat',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, chat_id: chatId, user_id: userId }),
    },
    token,
  );
}

export async function getChats(userId: string, token: string) {
  return request<any[]>(`/chats/${userId}`, {}, token);
}

export async function getChatMessages(chatId: string, token: string) {
  return request<any[]>(`/chats/${chatId}/messages`, {}, token);
}

export async function deleteChat(chatId: string, token: string) {
  return request<{ ok: boolean }>(`/chats/${chatId}`, { method: 'DELETE' }, token);
}

export async function inpaintImage(prompt: string): Promise<{ repaired_image_url: string }> {
  return request<{ repaired_image_url: string }>('/inpaint', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ inpaint_prompt: prompt }),
  });
}

export async function saveJob(
  userId: string,
  imageUrl: string | null,
  result: AnalyseResult,
  token: string,
): Promise<{ job_id: string }> {
  return request<{ job_id: string }>(
    '/jobs',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, image_url: imageUrl, result }),
    },
    token,
  );
}

export async function getJobs(userId: string, token: string): Promise<Job[]> {
  return request<Job[]>(`/jobs/${userId}`, {}, token);
}
