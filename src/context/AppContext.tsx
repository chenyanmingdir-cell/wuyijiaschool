import { createContext, useContext, useReducer, useEffect, useCallback, type Dispatch, type ReactNode } from 'react';
import type {
  AppData, AttendanceRecord, AttendancePayload, AttendanceStatus,
  Course, CourseCard, HomeworkPayload, HomeworkStatus,
  ID, SchoolClass, Student
} from '../types';
import { createEmptyData, isoDateOnly, sameDay, uid, sortCourseCardsFIFO } from '../utils';
import { loadAppState, saveAppState } from '../storage';

// ------- State -------
interface AppState {
  data: AppData;
  ready: boolean;
  flash: Flash | null;
  selectedDate: string;
  selectedClassId: ID;
  tab: TabKey;
  pendingStudentCalendarId: ID | null;
}

export type TabKey = 'dashboard' | 'classes' | 'reports' | 'settings';
export type Flash = { kind: 'success' | 'error' | 'info'; text: string } | null;

type Action =
  | { type: 'INIT'; data: AppData }
  | { type: 'SET_READY' }
  | { type: 'SET_FLASH'; flash: Flash }
  | { type: 'CLEAR_FLASH' }
  | { type: 'SET_TAB'; tab: TabKey }
  | { type: 'SET_DATE'; date: string }
  | { type: 'SET_CLASS_ID'; id: ID }
  | { type: 'REPLACE_DATA'; data: AppData }
  // CRUD
  | { type: 'CREATE_COURSE'; name: string }
  | { type: 'DELETE_COURSE'; id: ID }
  | { type: 'CREATE_CLASS'; name: string; existingCourseId: string; newCourseName: string }
  | { type: 'UPDATE_CLASS'; classId: ID; name: string; courseId: ID }
  | { type: 'DELETE_CLASS'; classId: ID }
  | { type: 'CREATE_STUDENT'; classId: ID; name: string; phone: string; note: string; purchasedClasses: number }
  | { type: 'ATTACH_STUDENT'; classId: ID; studentId: ID }
  | { type: 'REMOVE_STUDENT'; classId: ID; studentId: ID }
  | { type: 'UPDATE_STUDENT'; studentId: ID; name: string; phone: string; note: string }
  | { type: 'PURCHASE_CARD'; studentId: ID; courseId: ID; purchasedAt: string; purchasedClasses: number }
  | { type: 'DELETE_CARD'; cardId: ID }
  | { type: 'SAVE_ATTENDANCE'; payload: AttendancePayload & { selectedCourseCardId?: ID | null } }
  | { type: 'DELETE_ATTENDANCE'; recordId: ID }
  | { type: 'SAVE_HOMEWORK'; payload: HomeworkPayload }
  | { type: 'DELETE_HOMEWORK'; recordId: ID }
  | { type: 'MARK_ALL_ATTENDANCE'; classId: ID; date: string }
  | { type: 'MARK_ALL_HOMEWORK'; classId: ID; date: string }
  | { type: 'OPEN_STUDENT_CALENDAR'; studentId: ID }
  | { type: 'CLEAR_PENDING_CALENDAR' };

function initState(): AppState {
  return {
    data: createEmptyData(),
    ready: false,
    flash: null,
    selectedDate: isoDateOnly(new Date()),
    selectedClassId: '',
    tab: 'dashboard',
    pendingStudentCalendarId: null,
  };
}

// ------- Helpers -------
function consumes(status: AttendanceStatus) { return status === '出勤'; }

function resolveFIFOCard(cards: CourseCard[], studentId: ID, courseId: ID, preferredId: ID | null) {
  const eligible = sortCourseCardsFIFO(
    cards.filter((c) => c.studentId === studentId && c.courseId === courseId && c.purchasedClasses > c.usedClasses)
  );
  if (preferredId) {
    const found = eligible.find((c) => c.id === preferredId);
    if (found) return found;
  }
  return eligible[0] ?? null;
}

// ------- Reducer -------
function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'INIT':
      return { ...state, data: action.data, ready: true };
    case 'SET_READY':
      return { ...state, ready: true };
    case 'SET_FLASH':
      return { ...state, flash: action.flash };
    case 'CLEAR_FLASH':
      return { ...state, flash: null };
    case 'SET_TAB':
      return { ...state, tab: action.tab };
    case 'SET_DATE':
      return { ...state, selectedDate: action.date };
    case 'SET_CLASS_ID':
      return { ...state, selectedClassId: action.id };
    case 'REPLACE_DATA':
      return { ...state, data: action.data, flash: { kind: 'success', text: '已导入备份' } };

    case 'CREATE_COURSE': {
      const trimmed = action.name.trim();
      if (!trimmed) return { ...state, flash: { kind: 'error', text: '课程名称不能为空' } };
      const course: Course = { id: uid(), name: trimmed, createdAt: new Date().toISOString() };
      return { ...state, data: { ...state.data, courses: [...state.data.courses, course], updatedAt: new Date().toISOString() }, flash: { kind: 'success', text: '已新增课程' } };
    }

    case 'DELETE_COURSE': {
      const d = state.data;
      const hasRefs = d.classes.some((c) => c.courseId === action.id)
        || d.courseCards.some((c) => c.courseId === action.id)
        || d.attendanceRecords.some((r) => r.courseId === action.id)
        || d.homeworkRecords.some((r) => r.courseId === action.id);
      if (hasRefs) return { ...state, flash: { kind: 'error', text: '课程已被使用，不能直接删除' } };
      return {
        ...state,
        data: {
          ...d,
          courses: d.courses.filter((c) => c.id !== action.id),
          updatedAt: new Date().toISOString(),
        },
        flash: { kind: 'success', text: '已删除课程' },
      };
    }

    case 'CREATE_CLASS': {
      const trimmed = action.name.trim();
      if (!trimmed) return { ...state, flash: { kind: 'error', text: '班级名称不能为空' } };

      let courseId = action.existingCourseId;
      let newCourses = state.data.courses;
      if (!courseId) {
        const courseName = (action.newCourseName.trim() || trimmed);
        courseId = uid();
        newCourses = [...newCourses, { id: courseId, name: courseName, createdAt: new Date().toISOString() }];
      }

      const classId = uid();
      const schoolClass: SchoolClass = { id: classId, name: trimmed, courseId, createdAt: new Date().toISOString(), studentIds: [] };

      return {
        ...state,
        data: {
          ...state.data,
          courses: newCourses,
          classes: [...state.data.classes, schoolClass],
          updatedAt: new Date().toISOString(),
        },
        selectedClassId: classId,
        flash: { kind: 'success', text: '已新建班级' },
      };
    }

    case 'UPDATE_CLASS': {
      const trimmed = action.name.trim();
      if (!trimmed || !action.courseId) return { ...state, flash: { kind: 'error', text: '班级名称和课程不能为空' } };
      return {
        ...state,
        data: {
          ...state.data,
          classes: state.data.classes.map((c) => c.id === action.classId ? { ...c, name: trimmed, courseId: action.courseId } : c),
          updatedAt: new Date().toISOString(),
        },
        flash: { kind: 'success', text: '已更新班级' },
      };
    }

    case 'DELETE_CLASS': {
      const target = state.data.classes.find((c) => c.id === action.classId);
      if (!target) return state;
      const restClasses = state.data.classes.filter((c) => c.id !== action.classId);
      const updatedStudents = state.data.students.map((s) => ({
        ...s, classIds: s.classIds.filter((id) => id !== action.classId),
      }));
      const orphanIds = updatedStudents.filter((s) => s.classIds.length === 0).map((s) => s.id);
      return {
        ...state,
        data: {
          ...state.data,
          classes: restClasses,
          students: updatedStudents.filter((s) => s.classIds.length > 0),
          courseCards: state.data.courseCards.filter((cc) => !orphanIds.includes(cc.studentId)),
          attendanceRecords: state.data.attendanceRecords.filter((r) => r.classId !== action.classId && !orphanIds.includes(r.studentId)),
          homeworkRecords: state.data.homeworkRecords.filter((r) => r.classId !== action.classId && !orphanIds.includes(r.studentId)),
          updatedAt: new Date().toISOString(),
        },
        selectedClassId: '',
        flash: { kind: 'success', text: '已删除班级' },
      };
    }

    case 'CREATE_STUDENT': {
      const trimmed = action.name.trim();
      if (!trimmed) return { ...state, flash: { kind: 'error', text: '学员姓名不能为空' } };
      const classItem = state.data.classes.find((c) => c.id === action.classId);
      const classCourseId = classItem?.courseId ?? '';

      // Same-name merge: if a student with the exact same name already exists,
      // just add this class to the existing student — no duplicates.
      const existingStudent = state.data.students.find((s) => s.name === trimmed);

      if (existingStudent) {
        // Already in this class?
        if (existingStudent.classIds.includes(action.classId)) {
          return { ...state, flash: { kind: 'info', text: '该学员已在此班级中' } };
        }
        // Create course card for this class's course if the student doesn't have one yet
        const hasCard = state.data.courseCards.some((cc) => cc.studentId === existingStudent.id && cc.courseId === classCourseId);
        const newCards = (!hasCard && classCourseId && action.purchasedClasses > 0)
          ? [...state.data.courseCards, {
              id: uid(), studentId: existingStudent.id, courseId: classCourseId, purchasedAt: isoDateOnly(new Date()),
              purchasedClasses: action.purchasedClasses, usedClasses: 0, createdAt: new Date().toISOString(),
            }]
          : state.data.courseCards;
        return {
          ...state,
          data: {
            ...state.data,
            classes: state.data.classes.map((c) => c.id === action.classId ? { ...c, studentIds: [...c.studentIds, existingStudent.id] } : c),
            students: state.data.students.map((s) => s.id === existingStudent.id ? { ...s, classIds: [...s.classIds, action.classId] } : s),
            courseCards: newCards,
            updatedAt: new Date().toISOString(),
          },
          flash: { kind: 'success', text: `已将 ${trimmed} 加入班级（合并已有学员）` },
        };
      }

      // New student
      const studentId = uid();
      const student: Student = {
        id: studentId, name: trimmed, phone: action.phone.trim(), note: action.note.trim(),
        createdAt: new Date().toISOString(), classIds: [action.classId],
      };
      const newCards: CourseCard[] = (classCourseId && action.purchasedClasses > 0)
        ? [...state.data.courseCards, {
            id: uid(), studentId, courseId: classCourseId, purchasedAt: isoDateOnly(new Date()),
            purchasedClasses: action.purchasedClasses, usedClasses: 0, createdAt: new Date().toISOString(),
          }]
        : state.data.courseCards;
      return {
        ...state,
        data: {
          ...state.data,
          students: [...state.data.students, student],
          classes: state.data.classes.map((c) => c.id === action.classId ? { ...c, studentIds: [...c.studentIds, studentId] } : c),
          courseCards: newCards,
          updatedAt: new Date().toISOString(),
        },
        flash: { kind: 'success', text: '已新增学员' },
      };
    }

    case 'ATTACH_STUDENT': {
      const { classId, studentId } = action;
      const classExists = state.data.classes.find((c) => c.id === classId)?.studentIds.includes(studentId);
      const studentExists = state.data.students.find((s) => s.id === studentId)?.classIds.includes(classId);
      if (classExists || studentExists) return { ...state, flash: { kind: 'info', text: '该学员已在此班级中' } };
      return {
        ...state,
        data: {
          ...state.data,
          classes: state.data.classes.map((c) => c.id === classId ? { ...c, studentIds: [...c.studentIds, studentId] } : c),
          students: state.data.students.map((s) => s.id === studentId ? { ...s, classIds: [...s.classIds, classId] } : s),
          updatedAt: new Date().toISOString(),
        },
        flash: { kind: 'success', text: '已加入班级' },
      };
    }

    case 'REMOVE_STUDENT': {
      const { classId, studentId } = action;
      const updatedStudents = state.data.students.map((s) =>
        s.id === studentId ? { ...s, classIds: s.classIds.filter((id) => id !== classId) } : s
      );
      const target = updatedStudents.find((s) => s.id === studentId);
      const isOrphan = target?.classIds.length === 0;
      return {
        ...state,
        data: {
          ...state.data,
          classes: state.data.classes.map((c) => c.id === classId ? { ...c, studentIds: c.studentIds.filter((id) => id !== studentId) } : c),
          students: isOrphan ? updatedStudents.filter((s) => s.id !== studentId) : updatedStudents,
          courseCards: isOrphan ? state.data.courseCards.filter((cc) => cc.studentId !== studentId) : state.data.courseCards,
          attendanceRecords: isOrphan ? state.data.attendanceRecords.filter((r) => r.studentId !== studentId) : state.data.attendanceRecords,
          homeworkRecords: isOrphan ? state.data.homeworkRecords.filter((r) => r.studentId !== studentId) : state.data.homeworkRecords,
          updatedAt: new Date().toISOString(),
        },
        flash: { kind: 'success', text: '已移出班级' },
      };
    }

    case 'UPDATE_STUDENT': {
      const trimmed = action.name.trim();
      if (!trimmed) return { ...state, flash: { kind: 'error', text: '学员姓名不能为空' } };

      // If renaming to match another existing student → merge them
      const other = state.data.students.find((s) => s.id !== action.studentId && s.name === trimmed);
      if (other) {
        // Merge: move all classIds, rewrite attendance/homework records, delete old student
        const mergedClassIds = [...new Set([...other.classIds, ...state.data.students.find((s) => s.id === action.studentId)?.classIds ?? []])];
        const updatedStudents = state.data.students
          .filter((s) => s.id !== action.studentId)
          .map((s) => s.id === other.id ? { ...s, name: trimmed, phone: action.phone.trim(), note: action.note.trim(), classIds: mergedClassIds } : s);
        // Update all related records to point to the surviving student
        const survivingId = other.id;
        const mergedId = action.studentId;
        return {
          ...state,
          data: {
            ...state.data,
            students: updatedStudents,
            classes: state.data.classes.map((c) => ({
              ...c,
              studentIds: c.studentIds.includes(mergedId)
                ? [...new Set(c.studentIds.filter((sid) => sid !== mergedId).concat(survivingId))]
                : c.studentIds,
            })),
            courseCards: state.data.courseCards.map((cc) => cc.studentId === mergedId ? { ...cc, studentId: survivingId } : cc),
            attendanceRecords: state.data.attendanceRecords.map((r) => r.studentId === mergedId ? { ...r, studentId: survivingId } : r),
            homeworkRecords: state.data.homeworkRecords.map((r) => r.studentId === mergedId ? { ...r, studentId: survivingId } : r),
            updatedAt: new Date().toISOString(),
          },
          flash: { kind: 'success', text: `已与 ${trimmed} 合并` },
        };
      }

      return {
        ...state,
        data: {
          ...state.data,
          students: state.data.students.map((s) => s.id === action.studentId ? {
            ...s, name: trimmed, phone: action.phone.trim(), note: action.note.trim(),
          } : s),
          updatedAt: new Date().toISOString(),
        },
        flash: { kind: 'success', text: '已更新学员' },
      };
    }

    case 'PURCHASE_CARD': {
      if (!action.courseId || action.purchasedClasses <= 0) {
        return { ...state, flash: { kind: 'error', text: '请选择课程并填写购买课时' } };
      }
      const card: CourseCard = {
        id: uid(), studentId: action.studentId, courseId: action.courseId,
        purchasedAt: action.purchasedAt, purchasedClasses: action.purchasedClasses,
        usedClasses: 0, createdAt: new Date().toISOString(),
      };
      return {
        ...state,
        data: { ...state.data, courseCards: [...state.data.courseCards, card], updatedAt: new Date().toISOString() },
        flash: { kind: 'success', text: '已新增购课记录' },
      };
    }

    case 'DELETE_CARD': {
      const card = state.data.courseCards.find((c) => c.id === action.cardId);
      if (!card) return state;
      if (card.usedClasses > 0) return { ...state, flash: { kind: 'error', text: '已消课的记录不能直接删除' } };
      return {
        ...state,
        data: { ...state.data, courseCards: state.data.courseCards.filter((c) => c.id !== action.cardId), updatedAt: new Date().toISOString() },
        flash: { kind: 'success', text: '已删除购课记录' },
      };
    }

    case 'SAVE_ATTENDANCE': {
      const { id, studentId, classId, courseId, date, status, courseCardId, note, selectedCourseCardId } = action.payload;
      const existing = state.data.attendanceRecords.find((r) => r.id === id) ?? null;
      const useCardId = selectedCourseCardId ?? courseCardId ?? null;

      // Deep clone course cards for mutation
      let courseCards = state.data.courseCards.map((c) => ({ ...c }));

      // Refund old card if changing from consuming status
      if (existing?.courseCardId && consumes(existing.status)) {
        const oldCard = courseCards.find((c) => c.id === existing.courseCardId);
        if (oldCard && oldCard.usedClasses > 0) oldCard.usedClasses -= 1;
      }

      let resolvedCardId: ID | null = useCardId;
      if (consumes(status)) {
        const chosen = resolveFIFOCard(courseCards, studentId, courseId, useCardId);
        if (!chosen) {
          return { ...state, flash: { kind: 'error', text: '课程卡剩余课时不足' } };
        }
        chosen.usedClasses += 1;
        resolvedCardId = chosen.id;
      }

      const record: AttendanceRecord = {
        id, studentId, classId, courseId, date, status,
        courseCardId: resolvedCardId, note: note.trim(),
        createdAt: existing?.createdAt ?? new Date().toISOString(),
      };

      const attendanceRecords = existing
        ? state.data.attendanceRecords.map((r) => (r.id === id ? record : r))
        : [...state.data.attendanceRecords, record];

      return {
        ...state,
        data: { ...state.data, courseCards, attendanceRecords, updatedAt: new Date().toISOString() },
        flash: { kind: 'success', text: '已保存考勤' },
      };
    }

    case 'DELETE_ATTENDANCE': {
      const record = state.data.attendanceRecords.find((r) => r.id === action.recordId);
      if (!record) return state;
      let courseCards = state.data.courseCards.map((c) => ({ ...c }));
      if (record.courseCardId && consumes(record.status)) {
        const card = courseCards.find((c) => c.id === record.courseCardId);
        if (card && card.usedClasses > 0) card.usedClasses -= 1;
      }
      return {
        ...state,
        data: {
          ...state.data,
          courseCards,
          attendanceRecords: state.data.attendanceRecords.filter((r) => r.id !== action.recordId),
          updatedAt: new Date().toISOString(),
        },
        flash: { kind: 'success', text: '已删除考勤' },
      };
    }

    case 'SAVE_HOMEWORK': {
      const { id, studentId, classId, courseId, date, status, content } = action.payload;
      const existing = state.data.homeworkRecords.find((r) => r.id === id) ?? null;
      const record = { id, studentId, classId, courseId, date, status, content: content.trim(), createdAt: existing?.createdAt ?? new Date().toISOString() };
      const records = existing
        ? state.data.homeworkRecords.map((r) => (r.id === id ? record : r))
        : [...state.data.homeworkRecords, record];
      return {
        ...state,
        data: { ...state.data, homeworkRecords: records, updatedAt: new Date().toISOString() },
        flash: { kind: 'success', text: '已保存作业' },
      };
    }

    case 'DELETE_HOMEWORK': {
      return {
        ...state,
        data: {
          ...state.data,
          homeworkRecords: state.data.homeworkRecords.filter((r) => r.id !== action.recordId),
          updatedAt: new Date().toISOString(),
        },
        flash: { kind: 'success', text: '已删除作业' },
      };
    }

    case 'MARK_ALL_ATTENDANCE': {
      const { classId, date } = action;
      const cls = state.data.classes.find((c) => c.id === classId);
      if (!cls) return { ...state, flash: { kind: 'error', text: '班级不存在' } };
      let data = { ...state.data, courseCards: state.data.courseCards.map((c) => ({ ...c })) };
      let hasError = false;

      for (const studentId of cls.studentIds) {
        const student = data.students.find((s) => s.id === studentId);
        if (!student) continue;
        const existing = data.attendanceRecords.find((r) => r.studentId === studentId && r.classId === classId && sameDay(r.date, date));
        const eligCards = sortCourseCardsFIFO(
          data.courseCards.filter((cc) => cc.studentId === studentId && cc.courseId === cls.courseId && cc.purchasedClasses > cc.usedClasses)
        );
        const chosen = eligCards[0] ?? null;
        if (existing) {
          if (existing.courseCardId && consumes(existing.status)) {
            const oc = data.courseCards.find((cc) => cc.id === existing.courseCardId);
            if (oc && oc.usedClasses > 0) oc.usedClasses -= 1;
          }
          if (chosen) chosen.usedClasses += 1;
          existing.status = '出勤';
          existing.courseCardId = chosen?.id ?? null;
        } else {
          if (!chosen) continue; // skip students with no cards when creating new records
          chosen.usedClasses += 1;
          const record: AttendanceRecord = {
            id: uid(), studentId, classId, courseId: cls.courseId, date, status: '出勤',
            courseCardId: chosen.id, note: '', createdAt: new Date().toISOString(),
          };
          data.attendanceRecords = [...data.attendanceRecords, record];
        }
      }

      if (hasError) return { ...state, data, flash: { kind: 'error', text: '部分学员课时不足，已跳过' } };
      return { ...state, data: { ...data, updatedAt: new Date().toISOString() }, flash: { kind: 'success', text: '已批量出勤' } };
    }

    case 'MARK_ALL_HOMEWORK': {
      const { classId, date } = action;
      const cls = state.data.classes.find((c) => c.id === classId);
      if (!cls) return { ...state, flash: { kind: 'error', text: '班级不存在' } };
      let records = [...state.data.homeworkRecords];
      for (const studentId of cls.studentIds) {
        const existing = records.find((r) => r.studentId === studentId && r.classId === classId && sameDay(r.date, date));
        if (existing) {
          existing.status = '已提交';
        } else {
          records.push({ id: uid(), studentId, classId, courseId: cls.courseId, date, status: '已提交', content: '', createdAt: new Date().toISOString() });
        }
      }
      return {
        ...state,
        data: { ...state.data, homeworkRecords: records, updatedAt: new Date().toISOString() },
        flash: { kind: 'success', text: '已批量提交作业' },
      };
    }

    case 'OPEN_STUDENT_CALENDAR':
      return { ...state, pendingStudentCalendarId: action.studentId, tab: 'classes' };

    case 'CLEAR_PENDING_CALENDAR':
      return { ...state, pendingStudentCalendarId: null };

    default:
      return state;
  }
}

// ------- Context -------
interface AppContextValue {
  state: AppState;
  dispatch: Dispatch<Action>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initState);

  // Wrap dispatch to catch reducer errors (prevents white-screen on older WebKit)
  const safeDispatch: Dispatch<Action> = useCallback((action: Action) => {
    try {
      dispatch(action);
    } catch (err) {
      console.error('[AppContext] Reducer error:', err);
    }
  }, [dispatch]);

  // Load saved data on mount
  useEffect(() => {
    (async () => {
      const stored = await loadAppState<AppData>();
      if (stored) {
        dispatch({ type: 'INIT', data: stored });
      } else {
        dispatch({ type: 'SET_READY' });
      }
    })();
  }, []);

  // Persist on data change
  useEffect(() => {
    if (!state.ready) return;
    void saveAppState(state.data);
  }, [state.data, state.ready]);

  // Auto-clear flash
  useEffect(() => {
    if (!state.flash) return;
    const timer = setTimeout(() => dispatch({ type: 'CLEAR_FLASH' }), 2500);
    return () => clearTimeout(timer);
  }, [state.flash]);

  // Auto-select first class
  useEffect(() => {
    if (state.data.classes.length > 0 && !state.selectedClassId) {
      dispatch({ type: 'SET_CLASS_ID', id: state.data.classes[0].id });
    }
  }, [state.data.classes, state.selectedClassId]);

  return (
    <AppContext.Provider value={{ state, dispatch: safeDispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
}
