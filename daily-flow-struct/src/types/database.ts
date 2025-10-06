export interface Project {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface Deliverable {
  id: string;
  project_id: string;
  date: string;
  title?: string | null; // optional short title for display
  structured_text: string;
  raw_text: string;
  notes?: string | null;
  tag: string | null;
  color_override: string | null;
  is_done: boolean;
  created_at: string;
  updated_at: string;
  project?: Project;
}

export interface Report {
  id: string;
  deliverable_id: string;
  structured_text: string;
  raw_text: string;
  created_at: string;
}

export interface Profile {
  id: string;
  llm_api_key: string | null;
  created_at: string;
  updated_at: string;
}
