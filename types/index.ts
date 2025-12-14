/**
 * Type definitions for Canvas CLI
 */

// Configuration types
export interface CanvasConfig {
  domain: string;
  token: string;
  createdAt?: string;
  lastUpdated?: string;
}

export interface InstanceConfig {
  domain: string;
  token: string;
}

// Canvas API Response types
export interface CanvasCourse {
  id: number;
  name: string;
  course_code: string;
  workflow_state: string;
  account_id: number;
  start_at: string | null;
  end_at: string | null;
  enrollment_term_id: number;
  is_favorite?: boolean;
  [key: string]: any;
}

export interface CanvasAssignment {
  id: number;
  name: string;
  description: string;
  due_at: string | null;
  unlock_at: string | null;
  lock_at: string | null;
  points_possible: number;
  grading_type: string;
  submission_types: string[];
  has_submitted_submissions: boolean;
  course_id: number;
  [key: string]: any;
}

export interface CanvasSubmission {
  id: number;
  assignment_id: number;
  user_id: number;
  submission_type: string | null;
  submitted_at: string | null;
  score: number | null;
  grade: string | null;
  attempt: number;
  workflow_state: string;
  late: boolean;
  missing: boolean;
  [key: string]: any;
}

export interface CanvasGrade {
  current_score: number | null;
  final_score: number | null;
  current_grade: string | null;
  final_grade: string | null;
}

export interface CanvasEnrollment {
  id: number;
  course_id: number;
  user_id: number;
  type: string;
  enrollment_state: string;
  grades?: CanvasGrade;
  [key: string]: any;
}

export interface CanvasAnnouncement {
  id: number;
  title: string;
  message: string;
  posted_at: string;
  author: {
    id: number;
    display_name: string;
    [key: string]: any;
  };
  [key: string]: any;
}

export interface CanvasUser {
  id: number;
  name: string;
  sortable_name: string;
  short_name: string;
  avatar_url: string;
  email?: string;
  login_id?: string;
  [key: string]: any;
}

export interface CanvasFile {
  id: number;
  uuid: string;
  folder_id: number;
  display_name: string;
  filename: string;
  content_type: string;
  url: string;
  size: number;
  created_at: string;
  updated_at: string;
  [key: string]: any;
}

// File Upload types
export interface FileUploadParams {
  name: string;
  size: number;
  content_type: string;
  parent_folder_path?: string;
}

export interface FileUploadResponse {
  upload_url: string;
  upload_params: Record<string, any>;
  file_param?: string;
}

export interface SubmitAssignmentParams {
  courseId: number;
  assignmentId: number;
  submissionType: "online_upload" | "online_text_entry" | "online_url";
  fileIds?: number[];
  body?: string;
  url?: string;
}

// Command options types
export interface ListCoursesOptions {
  all?: boolean;
  verbose?: boolean;
}

export interface ListAssignmentsOptions {
  verbose?: boolean;
  submitted?: boolean;
  pending?: boolean;
}

export interface ShowGradesOptions {
  verbose?: boolean;
  all?: boolean;
}

export interface ShowAnnouncementsOptions {
  limit?: string;
}

export interface ApiQueryOptions {
  method?: string;
  query?: string[];
  body?: string;
  output?: string;
  raw?: boolean;
}

// Readline interface types
export interface ReadlineInterface {
  question(query: string, callback: (answer: string) => void): void;
  close(): void;
}
