import { supabase } from './supabase';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL;

if (!BASE_URL) throw new Error('EXPO_PUBLIC_API_URL is required');

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
  image_url_expires_at?: string;
  photo_path?: string;
  job_id?: string;
  pipeline: string;
  diy_assessment?: {
    jurisdiction: string | null;
    safety_level: 1 | 2 | 3 | 4 | null;
    assessment_status: 'complete' | 'assessment_pending' | 'more_information_required' | 'jurisdiction_required' | 'policy_unverified';
    reason: string;
    legal_status?: string;
    safety_status?: string;
    warning_signs?: string[];
    questions_required?: string[];
    allowed_actions?: string[];
    prohibited_actions?: string[];
    professional_type?: string | null;
    validation_version?: string;
    assessed_at?: string;
    policy_source?: { regulator?: string; url?: string; last_reviewed_at?: string; policy_version?: string };
  };
  requires_reassessment?: boolean;
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
  image_url_expires_at?: string;
  photo_path?: string;
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
    if (res.status === 401 && token) {
      await supabase.auth.signOut({ scope: 'local' });
      throw new Error('Your session has expired. Sign in again.');
    }
    throw new Error((err as any).detail || `Request failed: ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export async function analyseImage(imageUri: string, filename: string, jurisdiction: string | null, token: string): Promise<AnalyseResult> {
  const body = new FormData();
  body.append('file', { uri: imageUri, name: filename, type: 'image/jpeg' } as any);
  if (jurisdiction) body.append('jurisdiction', jurisdiction);
  return request<AnalyseResult>('/analyse', { method: 'POST', body }, token);
}

export async function sendChat(
  message: string,
  chatId?: string,
  token?: string,
  jurisdiction?: string | null,
): Promise<ChatResponse> {
  return request<ChatResponse>(
    '/chat',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, chat_id: chatId, jurisdiction: jurisdiction || undefined }),
    },
    token,
  );
}

export async function getChats(token: string) {
  return request<any[]>('/chats', {}, token);
}

export async function getChatMessages(chatId: string, token: string) {
  return request<any[]>(`/chats/${chatId}/messages`, {}, token);
}

export async function deleteChat(chatId: string, token: string) {
  return request<{ ok: boolean }>(`/chats/${chatId}`, { method: 'DELETE' }, token);
}

export async function inpaintImage(
  prompt: string,
  token: string,
  resource: { job_id?: string; photo_path?: string } = {},
): Promise<{ repaired_image_url: string }> {
  if (!token) throw new Error('Sign in to generate a repaired preview');
  return request<{ repaired_image_url: string }>('/inpaint', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ inpaint_prompt: prompt, ...resource }),
  }, token);
}

export async function saveJob(
  result: AnalyseResult,
  token: string,
): Promise<{ job_id: string }> {
  return request<{ job_id: string }>(
    '/jobs',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_id: result.job_id, photo_path: result.photo_path, result }),
    },
    token,
  );
}

export async function getJobs(token: string): Promise<Job[]> {
  const rows = await request<any[]>('/jobs', {}, token);
  return rows.map((row) => ({ ...row, result: row.result_json || row.result }));
}

export async function refreshJobPhoto(jobId: string, token: string): Promise<{ image_url: string; image_url_expires_at?: string; legacy: boolean }> {
  if (!jobId || !token) throw new Error('Photo refresh requires an authenticated saved job');
  return request(`/jobs/${encodeURIComponent(jobId)}/photo-url`, {}, token);
}

export async function verifyAssessment(result: AnalyseResult, token: string, changedConditions: Record<string, boolean> = {}): Promise<AnalyseResult> {
  return request<AnalyseResult>('/assessments/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ result, changed_conditions: changedConditions }) }, token);
}
