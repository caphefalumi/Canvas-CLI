/**
 * Type definitions for Canvas CLI
 */

// Configuration types
export interface CanvasConfig {
  domain: string;
  token: string;
  createdAt?: string;
  lastUpdated?: string;
  tableTruncate?: boolean;
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
  context_code?: string; // Added for all-courses view
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

export interface CanvasModule {
  id: number;
  name: string;
  position: number;
  unlock_at: string | null;
  require_sequential_progress: boolean;
  publish_final_grade: boolean;
  prerequisite_module_ids: number[];
  state: "locked" | "unlocked" | "started" | "completed";
  completed_at: string | null;
  items_count: number;
  items_url: string;
  [key: string]: any;
}

export interface CanvasModuleItem {
  id: number;
  module_id: number;
  position: number;
  title: string;
  indent: number;
  type:
    | "File"
    | "Page"
    | "Discussion"
    | "Assignment"
    | "Quiz"
    | "SubHeader"
    | "ExternalUrl"
    | "ExternalTool";
  content_id?: number;
  html_url?: string;
  url?: string;
  page_url?: string;
  external_url?: string;
  completion_requirement?: {
    type: "must_view" | "must_submit" | "must_contribute" | "min_score";
    completed: boolean;
    min_score?: number;
  };
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
  allCourses?: boolean;
  missing?: boolean;
  dueThisWeek?: boolean;
}

export interface ShowGradesOptions {
  verbose?: boolean;
  all?: boolean;
}

export interface ShowAnnouncementsOptions {
  limit?: string;
  verbose?: boolean;
  all?: boolean; // Show announcements from all courses
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

// Canvas Todo Item types
export interface CanvasTodoItem {
  type: string;
  assignment?: CanvasAssignment;
  quiz?: {
    id: number;
    title: string;
    due_at: string | null;
    points_possible: number;
    [key: string]: any;
  };
  ignore: string;
  ignore_permanently: string;
  html_url: string;
  needs_grading_count?: number;
  context_type: string;
  course_id?: number;
  group_id?: number;
  [key: string]: any;
}

// Canvas Folder types
export interface CanvasFolder {
  id: number;
  name: string;
  full_name: string;
  context_id: number;
  context_type: string;
  parent_folder_id: number | null;
  created_at: string;
  updated_at: string;
  lock_at: string | null;
  unlock_at: string | null;
  position: number;
  locked: boolean;
  folders_url: string;
  files_url: string;
  files_count: number;
  folders_count: number;
  hidden: boolean;
  locked_for_user: boolean;
  hidden_for_user: boolean;
  for_submissions: boolean;
  can_upload: boolean;
  [key: string]: any;
}

// Canvas Group types
export interface CanvasGroup {
  id: number;
  name: string;
  description: string | null;
  is_public: boolean;
  followed_by_user: boolean;
  join_level: string;
  members_count: number;
  avatar_url: string | null;
  context_type: string;
  course_id?: number;
  account_id?: number;
  role: string | null;
  group_category_id: number;
  sis_group_id: string | null;
  sis_import_id: number | null;
  storage_quota_mb: number;
  permissions?: {
    create_discussion_topic: boolean;
    create_announcement: boolean;
  };
  users?: CanvasUser[];
  [key: string]: any;
}

export interface CanvasGroupMembership {
  id: number;
  group_id: number;
  user_id: number;
  workflow_state: string;
  moderator: boolean;
  [key: string]: any;
}

// Command options for new features
export interface ShowTodoOptions {
  all?: boolean;
  limit?: string;
  verbose?: boolean;
}

export interface ShowFilesOptions {
  all?: boolean;
  download?: string;
  verbose?: boolean;
}

export interface ShowGroupsOptions {
  verbose?: boolean;
  members?: boolean;
}

export interface ModulesOptions {
  all?: boolean;
  verbose?: boolean;
}

export interface CalendarOptions {
  days?: string;
  all?: boolean;
  past?: boolean;
  verbose?: boolean;
}
