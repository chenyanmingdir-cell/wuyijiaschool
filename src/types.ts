export type ID = string;

export interface Course {
  id: ID;
  name: string;
  createdAt: string;
}

export interface SchoolClass {
  id: ID;
  name: string;
  courseId: ID;
  createdAt: string;
  studentIds: ID[];
}

export interface Student {
  id: ID;
  name: string;
  phone: string;
  note: string;
  createdAt: string;
  classIds: ID[];
}

export interface CourseCard {
  id: ID;
  studentId: ID;
  courseId: ID;
  purchasedAt: string;
  purchasedClasses: number;
  usedClasses: number;
  createdAt: string;
}

export type AttendanceStatus = '出勤' | '请假';

export interface AttendanceRecord {
  id: ID;
  studentId: ID;
  classId: ID;
  courseId: ID;
  date: string;
  status: AttendanceStatus;
  courseCardId: ID | null;
  note: string;
  createdAt: string;
}

export type HomeworkStatus = '已提交' | '未提交';

export interface HomeworkRecord {
  id: ID;
  studentId: ID;
  classId: ID;
  courseId: ID;
  date: string;
  status: HomeworkStatus;
  content: string;
  createdAt: string;
}

export const APP_NAME = 'wuyijiaschool';

export interface AppData {
  version: 1;
  app_name: string;
  updatedAt: string;
  courses: Course[];
  classes: SchoolClass[];
  students: Student[];
  courseCards: CourseCard[];
  attendanceRecords: AttendanceRecord[];
  homeworkRecords: HomeworkRecord[];
}

export interface BackupFile {
  app: 'wuyijiaschool-pwa';
  exportedAt: string;
  data: AppData;
}

export interface DashboardDayFlags {
  hasAttendance: boolean;
  hasLeave: boolean;
  hasHomework: boolean;
  hasClass: boolean;
}

export interface AttendancePayload {
  id: ID;
  studentId: ID;
  classId: ID;
  courseId: ID;
  date: string;
  status: AttendanceStatus;
  courseCardId: ID | null;
  note: string;
  selectedCourseCardId?: ID | null;
}

export interface HomeworkPayload {
  id: ID;
  studentId: ID;
  classId: ID;
  courseId: ID;
  date: string;
  status: HomeworkStatus;
  content: string;
}

export interface FlashMessage {
  kind: 'success' | 'error' | 'info';
  text: string;
}

export const ATTENDANCE_STATUSES: AttendanceStatus[] = ['出勤', '请假'];
export const HOMEWORK_STATUSES: HomeworkStatus[] = ['已提交', '未提交'];

export interface Workspace {
  id: ID;
  name: string;
  data: AppData;
  createdAt: string;
}
