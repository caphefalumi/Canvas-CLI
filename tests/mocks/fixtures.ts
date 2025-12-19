/**
 * Canvas API Mock Fixtures
 * Sample data for testing Canvas CLI commands
 */

import type {
  CanvasCourse,
  CanvasAssignment,
  CanvasSubmission,
  CanvasUser,
  CanvasAnnouncement,
  CanvasModule,
  CanvasModuleItem,
  CanvasTodoItem,
  CanvasFile,
  CanvasFolder,
  CanvasGroup,
  CanvasEnrollment,
} from "../../types/index.js";

// Sample Courses
export const mockCourses: CanvasCourse[] = [
  {
    id: 101,
    name: "Introduction to Computer Science",
    course_code: "CS101",
    workflow_state: "available",
    account_id: 1,
    start_at: "2025-01-15T00:00:00Z",
    end_at: "2025-05-15T23:59:59Z",
    enrollment_term_id: 1,
    is_favorite: true,
    term: { id: 1, name: "Spring 2025" },
  },
  {
    id: 102,
    name: "Data Structures and Algorithms",
    course_code: "CS201",
    workflow_state: "available",
    account_id: 1,
    start_at: "2025-01-15T00:00:00Z",
    end_at: "2025-05-15T23:59:59Z",
    enrollment_term_id: 1,
    is_favorite: true,
    term: { id: 1, name: "Spring 2025" },
  },
  {
    id: 103,
    name: "Web Development Fundamentals",
    course_code: "WEB101",
    workflow_state: "available",
    account_id: 1,
    start_at: "2025-01-15T00:00:00Z",
    end_at: "2025-05-15T23:59:59Z",
    enrollment_term_id: 1,
    is_favorite: false,
    term: { id: 1, name: "Spring 2025" },
  },
  {
    id: 104,
    name: "Database Systems",
    course_code: "CS301",
    workflow_state: "available",
    account_id: 1,
    start_at: "2025-01-15T00:00:00Z",
    end_at: "2025-05-15T23:59:59Z",
    enrollment_term_id: 1,
    is_favorite: false,
    term: { id: 1, name: "Spring 2025" },
  },
];

// Sample Assignments
export const mockAssignments: CanvasAssignment[] = [
  {
    id: 1001,
    name: "Homework 1: Variables and Data Types",
    description: "<p>Complete exercises on variables and data types.</p>",
    due_at: "2025-02-01T23:59:59Z",
    unlock_at: "2025-01-20T00:00:00Z",
    lock_at: null,
    points_possible: 100,
    grading_type: "points",
    submission_types: ["online_upload", "online_text_entry"],
    has_submitted_submissions: true,
    course_id: 101,
    html_url: "https://canvas.example.com/courses/101/assignments/1001",
  },
  {
    id: 1002,
    name: "Project 1: Calculator App",
    description: "<p>Build a simple calculator application.</p>",
    due_at: "2025-02-15T23:59:59Z",
    unlock_at: "2025-02-01T00:00:00Z",
    lock_at: null,
    points_possible: 200,
    grading_type: "points",
    submission_types: ["online_upload"],
    has_submitted_submissions: false,
    course_id: 101,
    html_url: "https://canvas.example.com/courses/101/assignments/1002",
  },
  {
    id: 1003,
    name: "Quiz 1: Programming Basics",
    description: "<p>Online quiz covering programming fundamentals.</p>",
    due_at: "2025-02-10T23:59:59Z",
    unlock_at: "2025-02-08T00:00:00Z",
    lock_at: "2025-02-11T00:00:00Z",
    points_possible: 50,
    grading_type: "points",
    submission_types: ["online_quiz"],
    has_submitted_submissions: true,
    course_id: 101,
    html_url: "https://canvas.example.com/courses/101/assignments/1003",
  },
  {
    id: 1004,
    name: "Final Exam",
    description: "<p>Comprehensive final examination.</p>",
    due_at: "2025-05-10T14:00:00Z",
    unlock_at: "2025-05-10T10:00:00Z",
    lock_at: "2025-05-10T14:00:00Z",
    points_possible: 300,
    grading_type: "points",
    submission_types: ["online_quiz"],
    has_submitted_submissions: false,
    course_id: 101,
    html_url: "https://canvas.example.com/courses/101/assignments/1004",
  },
];

// Sample Submissions
export const mockSubmissions: CanvasSubmission[] = [
  {
    id: 5001,
    assignment_id: 1001,
    user_id: 1,
    submission_type: "online_upload",
    submitted_at: "2025-01-30T20:30:00Z",
    score: 95,
    grade: "95",
    attempt: 1,
    workflow_state: "graded",
    late: false,
    missing: false,
  },
  {
    id: 5002,
    assignment_id: 1003,
    user_id: 1,
    submission_type: "online_quiz",
    submitted_at: "2025-02-09T15:45:00Z",
    score: 48,
    grade: "48",
    attempt: 1,
    workflow_state: "graded",
    late: false,
    missing: false,
  },
  {
    id: 5003,
    assignment_id: 1002,
    user_id: 1,
    submission_type: null,
    submitted_at: null,
    score: null,
    grade: null,
    attempt: 0,
    workflow_state: "unsubmitted",
    late: false,
    missing: true,
  },
];

// Sample User Profile
export const mockUser: CanvasUser = {
  id: 1,
  name: "John Doe",
  sortable_name: "Doe, John",
  short_name: "John",
  avatar_url: "https://canvas.example.com/images/avatars/1.png",
  email: "john.doe@example.com",
  login_id: "jdoe",
  locale: "en",
  effective_locale: "en",
  bio: "Computer Science student",
  primary_email: "john.doe@example.com",
  time_zone: "America/New_York",
};

// Sample Announcements
export const mockAnnouncements: CanvasAnnouncement[] = [
  {
    id: 2001,
    title: "Welcome to CS101!",
    message:
      "<p>Welcome to Introduction to Computer Science. Please review the syllabus.</p>",
    posted_at: "2025-01-15T09:00:00Z",
    author: {
      id: 100,
      display_name: "Professor Smith",
      avatar_url: "https://canvas.example.com/images/avatars/100.png",
    },
    context_code: "course_101",
  },
  {
    id: 2002,
    title: "Office Hours Update",
    message:
      "<p>Office hours have been moved to Tuesdays 2-4pm starting next week.</p>",
    posted_at: "2025-01-20T14:30:00Z",
    author: {
      id: 100,
      display_name: "Professor Smith",
      avatar_url: "https://canvas.example.com/images/avatars/100.png",
    },
    context_code: "course_101",
  },
  {
    id: 2003,
    title: "Assignment 1 Due Date Extended",
    message:
      "<p>Due to popular request, Assignment 1 deadline has been extended by 2 days.</p>",
    posted_at: "2025-01-28T11:00:00Z",
    author: {
      id: 100,
      display_name: "Professor Smith",
      avatar_url: "https://canvas.example.com/images/avatars/100.png",
    },
    context_code: "course_101",
  },
];

// Sample Modules
export const mockModules: CanvasModule[] = [
  {
    id: 3001,
    name: "Week 1: Introduction",
    position: 1,
    unlock_at: null,
    require_sequential_progress: false,
    publish_final_grade: false,
    prerequisite_module_ids: [],
    state: "completed",
    completed_at: "2025-01-22T10:00:00Z",
    items_count: 3,
    items_url:
      "https://canvas.example.com/api/v1/courses/101/modules/3001/items",
  },
  {
    id: 3002,
    name: "Week 2: Variables and Data Types",
    position: 2,
    unlock_at: "2025-01-22T00:00:00Z",
    require_sequential_progress: true,
    publish_final_grade: false,
    prerequisite_module_ids: [3001],
    state: "started",
    completed_at: null,
    items_count: 5,
    items_url:
      "https://canvas.example.com/api/v1/courses/101/modules/3002/items",
  },
  {
    id: 3003,
    name: "Week 3: Control Flow",
    position: 3,
    unlock_at: "2025-01-29T00:00:00Z",
    require_sequential_progress: true,
    publish_final_grade: false,
    prerequisite_module_ids: [3002],
    state: "locked",
    completed_at: null,
    items_count: 4,
    items_url:
      "https://canvas.example.com/api/v1/courses/101/modules/3003/items",
  },
];

// Sample Module Items
export const mockModuleItems: CanvasModuleItem[] = [
  {
    id: 4001,
    module_id: 3001,
    position: 1,
    title: "Course Syllabus",
    indent: 0,
    type: "Page",
    page_url: "course-syllabus",
    html_url: "https://canvas.example.com/courses/101/pages/course-syllabus",
    completion_requirement: { type: "must_view", completed: true },
  },
  {
    id: 4002,
    module_id: 3001,
    position: 2,
    title: "Introduction Video",
    indent: 0,
    type: "ExternalUrl",
    external_url: "https://youtube.com/watch?v=example",
    html_url: "https://canvas.example.com/courses/101/modules/items/4002",
    completion_requirement: { type: "must_view", completed: true },
  },
  {
    id: 4003,
    module_id: 3001,
    position: 3,
    title: "Week 1 Discussion",
    indent: 0,
    type: "Discussion",
    content_id: 6001,
    html_url: "https://canvas.example.com/courses/101/discussion_topics/6001",
    completion_requirement: { type: "must_contribute", completed: true },
  },
  {
    id: 4004,
    module_id: 3002,
    position: 1,
    title: "Variables Lecture Notes",
    indent: 0,
    type: "File",
    content_id: 7001,
    html_url: "https://canvas.example.com/courses/101/files/7001",
    completion_requirement: { type: "must_view", completed: true },
  },
  {
    id: 4005,
    module_id: 3002,
    position: 2,
    title: "Homework 1: Variables and Data Types",
    indent: 0,
    type: "Assignment",
    content_id: 1001,
    html_url: "https://canvas.example.com/courses/101/assignments/1001",
    completion_requirement: { type: "must_submit", completed: true },
  },
];

// Sample Todo Items
export const mockTodoItems: CanvasTodoItem[] = [
  {
    type: "submitting",
    assignment: mockAssignments[1],
    ignore:
      "https://canvas.example.com/api/v1/users/self/todo/assignment_1002/submitting?permanent=0",
    ignore_permanently:
      "https://canvas.example.com/api/v1/users/self/todo/assignment_1002/submitting?permanent=1",
    html_url: "https://canvas.example.com/courses/101/assignments/1002",
    context_type: "Course",
    course_id: 101,
  },
  {
    type: "submitting",
    assignment: mockAssignments[3],
    ignore:
      "https://canvas.example.com/api/v1/users/self/todo/assignment_1004/submitting?permanent=0",
    ignore_permanently:
      "https://canvas.example.com/api/v1/users/self/todo/assignment_1004/submitting?permanent=1",
    html_url: "https://canvas.example.com/courses/101/assignments/1004",
    context_type: "Course",
    course_id: 101,
  },
];

// Sample Files
export const mockFiles: CanvasFile[] = [
  {
    id: 7001,
    uuid: "abc123-def456",
    folder_id: 8001,
    display_name: "Week2_Lecture_Notes.pdf",
    filename: "Week2_Lecture_Notes.pdf",
    content_type: "application/pdf",
    url: "https://canvas.example.com/files/7001/download",
    size: 1024000,
    created_at: "2025-01-22T08:00:00Z",
    updated_at: "2025-01-22T08:00:00Z",
    locked: false,
    hidden: false,
  },
  {
    id: 7002,
    uuid: "ghi789-jkl012",
    folder_id: 8001,
    display_name: "Syllabus.pdf",
    filename: "Syllabus.pdf",
    content_type: "application/pdf",
    url: "https://canvas.example.com/files/7002/download",
    size: 512000,
    created_at: "2025-01-15T09:00:00Z",
    updated_at: "2025-01-15T09:00:00Z",
    locked: false,
    hidden: false,
  },
  {
    id: 7003,
    uuid: "mno345-pqr678",
    folder_id: 8002,
    display_name: "Assignment1_Instructions.docx",
    filename: "Assignment1_Instructions.docx",
    content_type:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    url: "https://canvas.example.com/files/7003/download",
    size: 256000,
    created_at: "2025-01-20T10:00:00Z",
    updated_at: "2025-01-20T10:00:00Z",
    locked: false,
    hidden: false,
  },
];

// Sample Folders
export const mockFolders: CanvasFolder[] = [
  {
    id: 8001,
    name: "course files",
    full_name: "course files",
    context_id: 101,
    context_type: "Course",
    parent_folder_id: null,
    created_at: "2025-01-15T00:00:00Z",
    updated_at: "2025-01-20T00:00:00Z",
    lock_at: null,
    unlock_at: null,
    position: 1,
    locked: false,
    folders_url: "https://canvas.example.com/api/v1/folders/8001/folders",
    files_url: "https://canvas.example.com/api/v1/folders/8001/files",
    files_count: 2,
    folders_count: 1,
    hidden: false,
    locked_for_user: false,
    hidden_for_user: false,
    for_submissions: false,
    can_upload: true,
  },
  {
    id: 8002,
    name: "Assignments",
    full_name: "course files/Assignments",
    context_id: 101,
    context_type: "Course",
    parent_folder_id: 8001,
    created_at: "2025-01-15T00:00:00Z",
    updated_at: "2025-01-20T00:00:00Z",
    lock_at: null,
    unlock_at: null,
    position: 1,
    locked: false,
    folders_url: "https://canvas.example.com/api/v1/folders/8002/folders",
    files_url: "https://canvas.example.com/api/v1/folders/8002/files",
    files_count: 1,
    folders_count: 0,
    hidden: false,
    locked_for_user: false,
    hidden_for_user: false,
    for_submissions: false,
    can_upload: true,
  },
];

// Sample Groups
export const mockGroups: CanvasGroup[] = [
  {
    id: 9001,
    name: "Project Team Alpha",
    description: "Team for CS101 group project",
    is_public: false,
    followed_by_user: false,
    join_level: "invitation_only",
    members_count: 4,
    avatar_url: null,
    context_type: "Course",
    course_id: 101,
    role: null,
    group_category_id: 1001,
    sis_group_id: null,
    sis_import_id: null,
    storage_quota_mb: 50,
  },
  {
    id: 9002,
    name: "Study Group",
    description: "Informal study group for exam prep",
    is_public: true,
    followed_by_user: true,
    join_level: "parent_context_auto_join",
    members_count: 8,
    avatar_url: null,
    context_type: "Course",
    course_id: 101,
    role: null,
    group_category_id: 1002,
    sis_group_id: null,
    sis_import_id: null,
    storage_quota_mb: 50,
  },
];

// Sample Enrollments with grades
export const mockEnrollments: CanvasEnrollment[] = [
  {
    id: 10001,
    course_id: 101,
    user_id: 1,
    type: "StudentEnrollment",
    enrollment_state: "active",
    grades: {
      current_score: 92.5,
      final_score: 88.0,
      current_grade: "A-",
      final_grade: "B+",
    },
  },
  {
    id: 10002,
    course_id: 102,
    user_id: 1,
    type: "StudentEnrollment",
    enrollment_state: "active",
    grades: {
      current_score: 85.0,
      final_score: 85.0,
      current_grade: "B",
      final_grade: "B",
    },
  },
];

// Calendar Events
export interface CanvasCalendarEvent {
  id: number;
  title: string;
  start_at: string;
  end_at: string;
  description: string;
  context_code: string;
  workflow_state: string;
  all_day: boolean;
  all_day_date: string | null;
  type: string;
  html_url: string;
  assignment?: CanvasAssignment;
}

export const mockCalendarEvents: CanvasCalendarEvent[] = [
  {
    id: 11001,
    title: "Homework 1 Due",
    start_at: "2025-02-01T23:59:59Z",
    end_at: "2025-02-01T23:59:59Z",
    description: "Submit Homework 1: Variables and Data Types",
    context_code: "course_101",
    workflow_state: "active",
    all_day: false,
    all_day_date: null,
    type: "assignment",
    html_url: "https://canvas.example.com/courses/101/assignments/1001",
    assignment: mockAssignments[0],
  },
  {
    id: 11002,
    title: "Project 1 Due",
    start_at: "2025-02-15T23:59:59Z",
    end_at: "2025-02-15T23:59:59Z",
    description: "Submit Calculator App Project",
    context_code: "course_101",
    workflow_state: "active",
    all_day: false,
    all_day_date: null,
    type: "assignment",
    html_url: "https://canvas.example.com/courses/101/assignments/1002",
    assignment: mockAssignments[1],
  },
  {
    id: 11003,
    title: "Midterm Review Session",
    start_at: "2025-03-01T14:00:00Z",
    end_at: "2025-03-01T16:00:00Z",
    description: "Optional midterm review session in Room 101",
    context_code: "course_101",
    workflow_state: "active",
    all_day: false,
    all_day_date: null,
    type: "event",
    html_url: "https://canvas.example.com/calendar?event_id=11003",
  },
];

// Assignments with submissions (combined data for grades view)
export const mockAssignmentsWithSubmissions = mockAssignments.map(
  (assignment) => {
    const submission = mockSubmissions.find(
      (s) => s.assignment_id === assignment.id,
    );
    return {
      ...assignment,
      submission: submission || null,
    };
  },
);

// Export all fixtures as a single object for convenience
export const fixtures = {
  courses: mockCourses,
  assignments: mockAssignments,
  submissions: mockSubmissions,
  user: mockUser,
  announcements: mockAnnouncements,
  modules: mockModules,
  moduleItems: mockModuleItems,
  todoItems: mockTodoItems,
  files: mockFiles,
  folders: mockFolders,
  groups: mockGroups,
  enrollments: mockEnrollments,
  calendarEvents: mockCalendarEvents,
  assignmentsWithSubmissions: mockAssignmentsWithSubmissions,
};
