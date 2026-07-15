import type { AppData, AttendanceRecord, CourseCard, DashboardDayFlags, HomeworkRecord, ID } from './types';
import { APP_NAME } from './types';

export function uid(): ID {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for browsers without crypto.randomUUID (older Safari, WeChat WebView, etc.)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function isoDateOnly(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatDate(value: string | Date, locale = 'zh-CN'): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date);
}

export function formatMonth(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long' }).format(date);
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

export function sameDay(a: string | Date, b: string | Date): boolean {
  return isoDateOnly(a) === isoDateOnly(b);
}

export function weekdayLabel(index: number): string {
  return ['日', '一', '二', '三', '四', '五', '六'][index] ?? '';
}

export function csvEscape(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

export function toCSV(rows: string[][]): string {
  return rows.map((row) => row.map(csvEscape).join(',')).join('\n');
}

export function toExcelHTML(rows: string[][]): string {
  const colorMap: Record<string, string> = {
    '出勤': '#16a34a',
    '请假': '#dc2626',
  };
  const cells = rows.map((row) =>
    '<tr>' + row.map((cell) => {
      const color = colorMap[cell];
      const style = color ? ` style="color:${color};font-weight:600"` : '';
      return `<td${style}>${cell.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</td>`;
    }).join('') + '</tr>'
  ).join('\n');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body><table>${cells}</table></body></html>`;
}

export function createEmptyData(): AppData {
  return {
    version: 1,
    app_name: APP_NAME,
    updatedAt: new Date().toISOString(),
    courses: [],
    classes: [],
    students: [],
    courseCards: [],
    attendanceRecords: [],
    homeworkRecords: []
  };
}

export function classFlagsForDay(data: AppData, date: string): DashboardDayFlags {
  const day = isoDateOnly(date);
  const hasAttendance = data.attendanceRecords.some((record) => isoDateOnly(record.date) === day);
  const hasHomework = data.homeworkRecords.some(
    (record) => isoDateOnly(record.date) === day && record.status === '已提交'
  );
  const hasClass = data.classes.some((schoolClass) =>
    data.attendanceRecords.some(
      (record) => record.classId === schoolClass.id && isoDateOnly(record.date) === day
    ) || data.homeworkRecords.some(
      (record) => record.classId === schoolClass.id && isoDateOnly(record.date) === day
    )
  );

  return { hasAttendance, hasHomework, hasClass };
}

export function classFlagsForClassDay(data: AppData, classId: ID, date: string): DashboardDayFlags {
  const day = isoDateOnly(date);
  const hasAttendance = data.attendanceRecords.some(
    (record) => record.classId === classId && isoDateOnly(record.date) === day
  );
  const hasHomework = data.homeworkRecords.some(
    (record) => record.classId === classId && isoDateOnly(record.date) === day && record.status === '已提交'
  );

  return {
    hasAttendance,
    hasHomework,
    hasClass: hasAttendance || hasHomework
  };
}

export function totalRemainingForCourse(data: AppData, studentId: ID, courseId: ID): number {
  return data.courseCards
    .filter((card) => card.studentId === studentId && card.courseId === courseId)
    .reduce((sum, card) => sum + card.purchasedClasses - card.usedClasses, 0);
}

export function sortCourseCardsFIFO(cards: CourseCard[]): CourseCard[] {
  return [...cards].sort((a, b) => {
    if (a.purchasedAt !== b.purchasedAt) return a.purchasedAt.localeCompare(b.purchasedAt);
    return a.createdAt.localeCompare(b.createdAt);
  });
}

export function groupedAttendance(data: AppData, studentId: ID, classId: ID, date: string): AttendanceRecord[] {
  return data.attendanceRecords
    .filter((record) => record.studentId === studentId && record.classId === classId && sameDay(record.date, date))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function groupedHomework(data: AppData, studentId: ID, classId: ID, date: string): HomeworkRecord[] {
  return data.homeworkRecords
    .filter((record) => record.studentId === studentId && record.classId === classId && sameDay(record.date, date))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
