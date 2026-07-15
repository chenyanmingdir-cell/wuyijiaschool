import { createContext, useContext, useEffect, useRef, useState, useCallback, useReducer, type ReactNode } from 'react';
import type {
  AppData, AttendanceRecord, AttendancePayload, AttendanceStatus,
  Course, CourseCard, HomeworkPayload, HomeworkStatus, HomeworkRecord,
  ID, SchoolClass, Student, BackupFile, Workspace
} from '../types';
import { createEmptyData, isoDateOnly, uid, sortCourseCardsFIFO } from '../utils';
import * as db from '../db';
import * as storage from '../storage';

// ============================================================
// UI State (reducer for non-data UI only)
// ============================================================

interface UIState {
  ready: boolean;
  flash: Flash | null;
  selectedDate: string;
  selectedClassId: ID;
  tab: TabKey;
  activeStudentCalendarId: ID | null;
}

export type TabKey = 'dashboard' | 'classes' | 'reports' | 'settings';
export type FlashKind = 'success' | 'error' | 'info';
export type Flash = { kind: FlashKind; text: string } | null;

type UIAction =
  | { type: 'INIT_DONE' }
  | { type: 'SET_FLASH'; flash: Flash }
  | { type: 'SET_TAB'; tab: TabKey }
  | { type: 'SET_DATE'; date: string }
  | { type: 'SET_CLASS_ID'; id: ID }
  | { type: 'OPEN_STUDENT_CALENDAR'; studentId: ID }
  | { type: 'CLOSE_STUDENT_CALENDAR' };

function uiReducer(state: UIState, action: UIAction): UIState {
  switch (action.type) {
    case 'INIT_DONE': return { ...state, ready: true };
    case 'SET_FLASH': return { ...state, flash: action.flash };
    case 'SET_TAB': return { ...state, tab: action.tab };
    case 'SET_DATE': return { ...state, selectedDate: action.date };
    case 'SET_CLASS_ID': return { ...state, selectedClassId: action.id };
    case 'OPEN_STUDENT_CALENDAR': return { ...state, activeStudentCalendarId: action.studentId };
    case 'CLOSE_STUDENT_CALENDAR': return { ...state, activeStudentCalendarId: null };
    default: return state;
  }
}

function initUI(): UIState {
  return {
    ready: false,
    flash: null,
    selectedDate: isoDateOnly(new Date()),
    selectedClassId: '',
    tab: 'dashboard',
    activeStudentCalendarId: null,
  };
}

// ============================================================
// Helpers
// ============================================================

function consumes(status: AttendanceStatus) { return status === '出勤'; }

function resolveFIFOCard(cards: CourseCard[], studentId: ID, courseId: ID, preferredId: ID | null) {
  // First, try cards with remaining classes
  const eligible = sortCourseCardsFIFO(
    cards.filter((c) => c.studentId === studentId && c.courseId === courseId && c.purchasedClasses > c.usedClasses)
  );
  if (preferredId) {
    const found = eligible.find((c) => c.id === preferredId);
    if (found) return { card: found, isOverspent: false };
  }
  if (eligible[0]) return { card: eligible[0], isOverspent: false };

  // No remaining classes: fall back to the last card for this student+course (allow over-use / 欠课)
  const allCards = sortCourseCardsFIFO(
    cards.filter((c) => c.studentId === studentId && c.courseId === courseId)
  );
  if (preferredId) {
    const found = allCards.find((c) => c.id === preferredId);
    if (found) return { card: found, isOverspent: true };
  }
  return allCards[0] ? { card: allCards[0], isOverspent: true } : null;
}

const WS_KEY = 'wuyijiaschool:workspaceId';

// ============================================================
// AppState (combined)
// ============================================================

interface AppState extends UIState {
  data: AppData;
  workspaceId: ID;
  workspaceName: string;
  workspaces: Workspace[];
}

// ============================================================
// Context
// ============================================================

interface AppContextValue {
  state: AppState;
  flash: (kind: FlashKind, text: string) => void;
  setTab: (tab: TabKey) => void;
  setDate: (date: string) => void;
  setClassId: (id: ID) => void;
  openStudentCalendar: (studentId: ID) => void;
  closeStudentCalendar: () => void;

  // Workspace
  createWorkspace: (name: string) => Promise<void>;
  renameWorkspace: (id: ID, name: string) => Promise<void>;
  switchWorkspace: (id: ID) => Promise<void>;
  deleteWorkspace: (id: ID) => Promise<void>;

  // CRUD - all sync (auto-save handles persistence)
  createCourse: (name: string) => void;
  updateCourse: (id: ID, name: string) => void;
  deleteCourse: (id: ID) => void;
  createClass: (name: string, existingCourseId: string, newCourseName: string) => void;
  updateClass: (classId: ID, name: string, courseId: ID) => void;
  deleteClass: (classId: ID) => void;
  createStudent: (classId: ID, name: string, phone: string, note: string, purchasedClasses: number) => void;
  attachStudent: (classId: ID, studentId: ID) => void;
  removeStudent: (classId: ID, studentId: ID) => void;
  updateStudent: (studentId: ID, name: string, phone: string, note: string) => void;
  purchaseCard: (studentId: ID, courseId: ID, purchasedAt: string, purchasedClasses: number) => void;
  deleteCard: (cardId: ID) => void;
  saveAttendance: (payload: AttendancePayload & { selectedCourseCardId?: ID | null }) => void;
  deleteAttendance: (recordId: ID) => void;
  saveHomework: (payload: HomeworkPayload) => void;
  deleteHomework: (recordId: ID) => void;
  markAllAttendance: (classId: ID, date: string) => void;
  markAllHomework: (classId: ID, date: string) => void;

  // Backup / Import
  exportBackup: () => string;
  importBackup: (file: File) => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
}

// ============================================================
// Provider
// ============================================================

export function AppProvider({ children }: { children: ReactNode }) {
  const [ui, uiDispatch] = useReducer(uiReducer, null, initUI);
  const [data, setData] = useState<AppData>(createEmptyData());
  const [workspaceId, setWorkspaceId] = useState<ID>('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveVersion = useRef(0);
  const initDone = useRef(false);

  const state: AppState = { ...ui, data, workspaceId, workspaceName, workspaces };

  // ---- Flash ----
  const flash = useCallback((kind: FlashKind, text: string) => {
    uiDispatch({ type: 'SET_FLASH', flash: { kind, text } });
  }, []);

  useEffect(() => {
    if (!state.flash) return;
    const t = setTimeout(() => uiDispatch({ type: 'SET_FLASH', flash: null }), 3000);
    return () => clearTimeout(t);
  }, [state.flash]);

  // ---- Init ----
  useEffect(() => {
    if (initDone.current) return;
    initDone.current = true;

    (async () => {
      try {
        const list = await db.listWorkspaces();
        const savedId = localStorage.getItem(WS_KEY);

        let targetWs: Workspace | undefined;
        if (savedId) targetWs = list.find(w => w.id === savedId);
        if (!targetWs) targetWs = list[0];

        if (targetWs && targetWs.data && targetWs.data.version === 1 && Array.isArray(targetWs.data.classes)) {
          setWorkspaces(list);
          setWorkspaceId(targetWs.id);
          setWorkspaceName(targetWs.name);
          setData(targetWs.data);
          if (savedId !== targetWs.id) localStorage.setItem(WS_KEY, targetWs.id);
          // Save local backup
          storage.saveAppState(targetWs.data).catch(() => {});
        } else if (targetWs) {
          // Workspace exists but data is corrupted — skip it and fall back to empty
          console.warn('[AppContext] 当前工作区数据异常，已回退到空数据');
          setWorkspaces(list);
          setWorkspaceId('');
          setWorkspaceName('');
          setData(createEmptyData());
          localStorage.removeItem(WS_KEY);
        } else {
          // No Supabase workspaces: try local backup
          const localData = await storage.loadAppState<AppData>().catch(() => null);
          if (localData && localData.version === 1 && Array.isArray(localData.classes)) {
            console.warn('[AppContext] Supabase 无数据，已从本地备份恢复');
            setWorkspaces([]);
            setWorkspaceId('');
            setWorkspaceName('');
            setData(localData);
          } else {
            // No workspaces at all: let user create one via onboarding
            setWorkspaces([]);
            setWorkspaceId('');
            setWorkspaceName('');
            setData(createEmptyData());
          }
        }
      } catch {
        // Supabase offline: try local backup
        const localData = await storage.loadAppState<AppData>().catch(() => null);
        if (localData && localData.version === 1 && Array.isArray(localData.classes)) {
          console.warn('[AppContext] Supabase 不可用，已从本地备份恢复');
          setWorkspaces([]);
          setWorkspaceId('');
          setWorkspaceName('');
          setData(localData);
        }
        // else keep empty data
      } finally {
        uiDispatch({ type: 'INIT_DONE' });
      }
    })();
  }, []);

  // ---- Auto-save (debounced) ----
  useEffect(() => {
    if (!workspaceId) return;

    // Refresh workspaces list periodically
    const refreshList = async () => {
      try {
        const list = await db.listWorkspaces();
        setWorkspaces(list);
        // Keep name in sync
        const current = list.find(w => w.id === workspaceId);
        if (current && current.name !== workspaceName) {
          setWorkspaceName(current.name);
        }
      } catch { /* ignore */ }
    };

    const listTimer = setInterval(refreshList, 15000);
    return () => clearInterval(listTimer);
  }, [workspaceId, workspaceName]);

  // Debounced save
  useEffect(() => {
    if (!workspaceId) return;
    saveVersion.current += 1;
    const v = saveVersion.current;

    // Always save to local backup immediately (fast, no network)
    storage.saveAppState(data).catch(() => {});

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      if (v !== saveVersion.current) return; // newer save is pending
      try {
        await db.saveWorkspace(workspaceId, workspaceName, data);
      } catch { /* ignore */ }
    }, 2000);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [data, workspaceId, workspaceName]);

  // ---- Utility ----
  const updateData = useCallback((updater: (prev: AppData) => AppData) => {
    setData(prev => ({ ...updater(prev), updatedAt: new Date().toISOString() }));
  }, []);

  // ---- Workspace Management ----
  const createWorkspace = useCallback(async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) { flash('error', '名称不能为空'); return; }
    try {
      const ws = await db.createWorkspace(trimmed, createEmptyData());
      setWorkspaces(prev => [...prev, ws]);
      setWorkspaceId(ws.id);
      setWorkspaceName(ws.name);
      setData(ws.data);
      localStorage.setItem(WS_KEY, ws.id);
      flash('success', `已创建「${trimmed}」`);
    } catch {
      flash('error', '创建失败，请重试');
    }
  }, [flash]);

  const switchWorkspace = useCallback(async (id: ID) => {
    // Save current workspace first
    if (workspaceId && workspaceId !== id) {
      try { await db.saveWorkspace(workspaceId, workspaceName, data); } catch { /* ok */ }
    }
    const target = workspaces.find(w => w.id === id);
    if (!target) return;
    setWorkspaceId(id);
    setWorkspaceName(target.name);
    setData(target.data);
    localStorage.setItem(WS_KEY, id);
    flash('info', `已切换到「${target.name}」`);
  }, [workspaceId, workspaceName, data, workspaces, flash]);

  const deleteWorkspace = useCallback(async (id: ID) => {
    if (workspaces.length <= 1) { flash('error', '至少保留一个工作区'); return; }
    try {
      await db.deleteWorkspace(id);
      const rest = workspaces.filter(w => w.id !== id);
      setWorkspaces(rest);
      if (id === workspaceId) {
        const next = rest[0];
        setWorkspaceId(next.id);
        setWorkspaceName(next.name);
        setData(next.data);
        localStorage.setItem(WS_KEY, next.id);
      }
      flash('success', '已删除工作区');
    } catch {
      flash('error', '删除失败，请重试');
    }
  }, [workspaces, workspaceId, flash]);

  const renameWorkspace = useCallback(async (id: ID, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) { flash('error', '名称不能为空'); return; }
    try {
      if (id === workspaceId) {
        await db.saveWorkspace(id, trimmed, data);
        setWorkspaceName(trimmed);
      } else {
        const ws = workspaces.find(w => w.id === id);
        if (!ws) return;
        await db.saveWorkspace(id, trimmed, ws.data);
      }
      setWorkspaces(prev => prev.map(w => w.id === id ? { ...w, name: trimmed } : w));
      flash('success', `已重命名为「${trimmed}」`);
    } catch {
      flash('error', '重命名失败，请重试');
    }
  }, [workspaces, workspaceId, workspaceName, data, flash]);

  // ---- CRUD: Course (sync) ----
  const createCourse = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) { flash('error', '课程名称不能为空'); return; }
    const course: Course = { id: uid(), name: trimmed, createdAt: new Date().toISOString() };
    updateData(prev => ({ ...prev, courses: [...prev.courses, course] }));
    flash('success', '已新增课程');
  }, [flash, updateData]);

  const deleteCourse = useCallback((id: ID) => {
    setData(prev => {
      const hasRefs = prev.classes.some(c => c.courseId === id)
        || prev.courseCards.some(c => c.courseId === id)
        || prev.attendanceRecords.some(r => r.courseId === id)
        || prev.homeworkRecords.some(r => r.courseId === id);
      if (hasRefs) { flash('error', '课程已被使用，不能直接删除'); return prev; }
      flash('success', '已删除课程');
      return { ...prev, courses: prev.courses.filter(c => c.id !== id), updatedAt: new Date().toISOString() };
    });
  }, [flash]);

  const updateCourse = useCallback((id: ID, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) { flash('error', '课程名称不能为空'); return; }
    setData(prev => ({
      ...prev,
      courses: prev.courses.map(c => c.id === id ? { ...c, name: trimmed } : c),
      updatedAt: new Date().toISOString(),
    }));
    flash('success', '课程名称已更新');
  }, [flash]);

  // ---- CRUD: Class (sync) ----
  const createClass = useCallback((name: string, existingCourseId: string, newCourseName: string) => {
    const trimmed = name.trim();
    if (!trimmed) { flash('error', '班级名称不能为空'); return; }

    let courseId = existingCourseId;
    updateData(prev => {
      if (!courseId) {
        const cn = newCourseName.trim() || trimmed;
        courseId = uid();
        const newCourse: Course = { id: courseId, name: cn, createdAt: new Date().toISOString() };
        const classId = uid();
        const cls: SchoolClass = { id: classId, name: trimmed, courseId, createdAt: new Date().toISOString(), studentIds: [] };
        uiDispatch({ type: 'SET_CLASS_ID', id: classId });
        return {
          ...prev,
          courses: [...prev.courses, newCourse],
          classes: [...prev.classes, cls],
        };
      }
      const classId = uid();
      const cls: SchoolClass = { id: classId, name: trimmed, courseId, createdAt: new Date().toISOString(), studentIds: [] };
      uiDispatch({ type: 'SET_CLASS_ID', id: classId });
      return { ...prev, classes: [...prev.classes, cls] };
    });
    flash('success', '已新建班级');
  }, [flash, updateData]);

  const updateClass = useCallback((classId: ID, name: string, courseId: ID) => {
    const trimmed = name.trim();
    if (!trimmed || !courseId) { flash('error', '班级名称和课程不能为空'); return; }
    updateData(prev => ({
      ...prev,
      classes: prev.classes.map(c => c.id === classId ? { ...c, name: trimmed, courseId } : c),
    }));
    flash('success', '已更新班级');
  }, [flash, updateData]);

  const deleteClass = useCallback((classId: ID) => {
    updateData(prev => {
      const target = prev.classes.find(c => c.id === classId);
      if (!target) return prev;
      const rest = prev.classes.filter(c => c.id !== classId);
      const updatedStudents = prev.students.map(s => ({
        ...s, classIds: s.classIds.filter(id => id !== classId),
      }));
      const orphanIds = updatedStudents.filter(s => s.classIds.length === 0).map(s => s.id);

      // For non-orphan students, find course cards for courses they no longer have any class in
      const staleCardIds = new Set<string>();
      for (const s of updatedStudents) {
        if (s.classIds.length === 0) continue; // orphan, already handled
        // Remaining course IDs for this student
        const remainingCourseIds = new Set(
          s.classIds.map(cid => rest.find(c => c.id === cid)?.courseId).filter(Boolean)
        );
        // Mark cards for removal if the course is no longer associated with any of the student's classes
        for (const cc of prev.courseCards) {
          if (cc.studentId === s.id && !remainingCourseIds.has(cc.courseId)) {
            staleCardIds.add(cc.id);
          }
        }
      }

      uiDispatch({ type: 'SET_CLASS_ID', id: '' });
      return {
        ...prev,
        classes: rest,
        students: updatedStudents.filter(s => s.classIds.length > 0),
        courseCards: prev.courseCards.filter(cc =>
          !orphanIds.includes(cc.studentId) && !staleCardIds.has(cc.id)
        ),
        attendanceRecords: prev.attendanceRecords.filter(r => r.classId !== classId && !orphanIds.includes(r.studentId)),
        homeworkRecords: prev.homeworkRecords.filter(r => r.classId !== classId && !orphanIds.includes(r.studentId)),
      };
    });
    flash('success', '已删除班级');
  }, [flash, updateData]);

  // ---- CRUD: Student (sync) ----
  const createStudent = useCallback((classId: ID, name: string, phone: string, note: string, purchasedClasses: number) => {
    const trimmed = name.trim();
    if (!trimmed) { flash('error', '学员姓名不能为空'); return; }

    updateData(prev => {
      const classItem = prev.classes.find(c => c.id === classId);
      const classCourseId = classItem?.courseId ?? '';

      // Same-name merge
      const existing = prev.students.find(s => s.name === trimmed);
      if (existing) {
        if (existing.classIds.includes(classId)) {
          flash('info', '该学员已在此班级中');
          return prev;
        }
        const newCards = prev.courseCards;
        let newCard: CourseCard | null = null;
        if (!newCards.some(cc => cc.studentId === existing.id && cc.courseId === classCourseId) && classCourseId && purchasedClasses > 0) {
          newCard = { id: uid(), studentId: existing.id, courseId: classCourseId, purchasedAt: isoDateOnly(new Date()), purchasedClasses, usedClasses: 0, createdAt: new Date().toISOString() };
        }
        flash('success', `已将 ${trimmed} 加入班级（合并已有学员）`);
        return {
          ...prev,
          classes: prev.classes.map(c => c.id === classId ? { ...c, studentIds: [...c.studentIds, existing.id] } : c),
          students: prev.students.map(s => s.id === existing.id ? { ...s, classIds: [...s.classIds, classId] } : s),
          courseCards: newCard ? [...prev.courseCards, newCard] : prev.courseCards,
        };
      }

      // New student
      const studentId = uid();
      const student: Student = { id: studentId, name: trimmed, phone: phone.trim(), note: note.trim(), createdAt: new Date().toISOString(), classIds: [classId] };
      const cards: CourseCard[] = (classCourseId && purchasedClasses > 0)
        ? [{ id: uid(), studentId, courseId: classCourseId, purchasedAt: isoDateOnly(new Date()), purchasedClasses, usedClasses: 0, createdAt: new Date().toISOString() }]
        : [];
      flash('success', '已新增学员');
      return {
        ...prev,
        students: [...prev.students, student],
        classes: prev.classes.map(c => c.id === classId ? { ...c, studentIds: [...c.studentIds, studentId] } : c),
        courseCards: [...prev.courseCards, ...cards],
      };
    });
  }, [flash, updateData]);

  const attachStudent = useCallback((classId: ID, studentId: ID) => {
    updateData(prev => {
      if (prev.classes.find(c => c.id === classId)?.studentIds.includes(studentId)) {
        flash('info', '该学员已在此班级中');
        return prev;
      }
      flash('success', '已加入班级');
      return {
        ...prev,
        classes: prev.classes.map(c => c.id === classId ? { ...c, studentIds: [...c.studentIds, studentId] } : c),
        students: prev.students.map(s => s.id === studentId ? { ...s, classIds: [...s.classIds, classId] } : s),
      };
    });
  }, [flash, updateData]);

  const removeStudent = useCallback((classId: ID, studentId: ID) => {
    updateData(prev => {
      const updatedStudents = prev.students.map(s =>
        s.id === studentId ? { ...s, classIds: s.classIds.filter(id => id !== classId) } : s
      );
      const isOrphan = updatedStudents.find(s => s.id === studentId)?.classIds.length === 0;
      flash('success', '已移出班级');
      return {
        ...prev,
        classes: prev.classes.map(c => c.id === classId ? { ...c, studentIds: c.studentIds.filter(id => id !== studentId) } : c),
        students: isOrphan ? updatedStudents.filter(s => s.id !== studentId) : updatedStudents,
        courseCards: isOrphan ? prev.courseCards.filter(cc => cc.studentId !== studentId) : prev.courseCards,
        attendanceRecords: isOrphan ? prev.attendanceRecords.filter(r => r.studentId !== studentId) : prev.attendanceRecords,
        homeworkRecords: isOrphan ? prev.homeworkRecords.filter(r => r.studentId !== studentId) : prev.homeworkRecords,
      };
    });
  }, [flash, updateData]);

  const updateStudent = useCallback((studentId: ID, name: string, phone: string, note: string) => {
    const trimmed = name.trim();
    if (!trimmed) { flash('error', '学员姓名不能为空'); return; }

    updateData(prev => {
      const other = prev.students.find(s => s.id !== studentId && s.name === trimmed);
      if (other) {
        // Merge
        const merged = prev.students.find(s => s.id === studentId);
        if (!merged) return prev;
        const mergedClassIds = [...new Set([...other.classIds, ...merged.classIds])];
        const survivingId = other.id;
        const mergedId = studentId;
        flash('success', `已与 ${trimmed} 合并`);
        return {
          ...prev,
          students: prev.students
            .filter(s => s.id !== mergedId)
            .map(s => s.id === survivingId ? { ...s, name: trimmed, phone: phone.trim(), note: note.trim(), classIds: mergedClassIds } : s),
          classes: prev.classes.map(c => ({
            ...c,
            studentIds: c.studentIds.includes(mergedId)
              ? [...new Set(c.studentIds.filter(sid => sid !== mergedId).concat(survivingId))]
              : c.studentIds,
          })),
          courseCards: prev.courseCards.map(cc => cc.studentId === mergedId ? { ...cc, studentId: survivingId } : cc),
          attendanceRecords: prev.attendanceRecords.map(r => r.studentId === mergedId ? { ...r, studentId: survivingId } : r),
          homeworkRecords: prev.homeworkRecords.map(r => r.studentId === mergedId ? { ...r, studentId: survivingId } : r),
        };
      }
      flash('success', '已更新学员');
      return {
        ...prev,
        students: prev.students.map(s => s.id === studentId ? { ...s, name: trimmed, phone: phone.trim(), note: note.trim() } : s),
      };
    });
  }, [flash, updateData]);

  // ---- CRUD: Course Card (sync) ----
  const purchaseCard = useCallback((studentId: ID, courseId: ID, purchasedAt: string, purchasedClasses: number) => {
    if (!courseId || purchasedClasses <= 0) { flash('error', '请选择课程并填写购买课时'); return; }
    const card: CourseCard = { id: uid(), studentId, courseId, purchasedAt, purchasedClasses, usedClasses: 0, createdAt: new Date().toISOString() };
    updateData(prev => ({ ...prev, courseCards: [...prev.courseCards, card] }));
    flash('success', '已新增购课记录');
  }, [flash, updateData]);

  const deleteCard = useCallback((cardId: ID) => {
    updateData(prev => {
      const card = prev.courseCards.find(c => c.id === cardId);
      if (!card) return prev;
      if (card.usedClasses > 0) { flash('error', '已消课的记录不能直接删除'); return prev; }
      flash('success', '已删除购课记录');
      return { ...prev, courseCards: prev.courseCards.filter(c => c.id !== cardId) };
    });
  }, [flash, updateData]);

  // ---- CRUD: Attendance (sync) ----
  const saveAttendance = useCallback((payload: AttendancePayload & { selectedCourseCardId?: ID | null }) => {
    updateData(prev => {
      const { id, studentId, classId, courseId, date, status, note, selectedCourseCardId } = payload;
      const existing = prev.attendanceRecords.find(r => r.id === id);

      let courseCards = prev.courseCards.map(c => ({ ...c }));
      if (existing?.courseCardId && consumes(existing.status)) {
        const old = courseCards.find(c => c.id === existing.courseCardId);
        if (old && old.usedClasses > 0) old.usedClasses -= 1;
      }

      let resolvedId: ID | null = selectedCourseCardId ?? (payload as any).courseCardId ?? null;
      if (consumes(status)) {
        const result = resolveFIFOCard(courseCards, studentId, courseId, resolvedId);
        if (!result) { flash('error', '该学员没有购课记录，请先购买课时卡'); return prev; }
        result.card.usedClasses += 1;
        resolvedId = result.card.id;
        if (result.isOverspent) {
          flash('info', '课时已用完，记入欠课');
        }
      }

      const record: AttendanceRecord = {
        id, studentId, classId, courseId, date, status,
        courseCardId: resolvedId, note: note.trim(),
        createdAt: existing?.createdAt ?? new Date().toISOString(),
      };

      flash('success', '已保存考勤');
      return {
        ...prev,
        courseCards,
        attendanceRecords: existing
          ? prev.attendanceRecords.map(r => r.id === id ? record : r)
          : [...prev.attendanceRecords, record],
      };
    });
  }, [flash, updateData]);

  const deleteAttendance = useCallback((recordId: ID) => {
    updateData(prev => {
      const record = prev.attendanceRecords.find(r => r.id === recordId);
      if (!record) return prev;
      let cards = prev.courseCards.map(c => ({ ...c }));
      if (record.courseCardId && consumes(record.status)) {
        const card = cards.find(c => c.id === record.courseCardId);
        if (card && card.usedClasses > 0) card.usedClasses -= 1;
      }
      flash('success', '已删除考勤');
      return { ...prev, courseCards: cards, attendanceRecords: prev.attendanceRecords.filter(r => r.id !== recordId) };
    });
  }, [flash, updateData]);

  // ---- CRUD: Homework (sync) ----
  const saveHomework = useCallback((payload: HomeworkPayload) => {
    updateData(prev => {
      const { id, studentId, classId, courseId, date, status, content } = payload;
      const existing = prev.homeworkRecords.find(r => r.id === id) ?? null;
      const record = { id, studentId, classId, courseId, date, status, content: content.trim(), createdAt: existing?.createdAt ?? new Date().toISOString() };
      flash('success', '已保存作业');
      return {
        ...prev,
        homeworkRecords: existing
          ? prev.homeworkRecords.map(r => r.id === id ? record : r)
          : [...prev.homeworkRecords, record],
      };
    });
  }, [flash, updateData]);

  const deleteHomework = useCallback((recordId: ID) => {
    updateData(prev => {
      flash('success', '已删除作业');
      return { ...prev, homeworkRecords: prev.homeworkRecords.filter(r => r.id !== recordId) };
    });
  }, [flash, updateData]);

  // ---- Batch (sync) ----
  const markAllAttendance = useCallback((classId: ID, date: string) => {
    updateData(prev => {
      const cls = prev.classes.find(c => c.id === classId);
      if (!cls) { flash('error', '班级不存在'); return prev; }
      let cards = prev.courseCards.map(c => ({ ...c }));
      let newRecords: AttendanceRecord[] = [];
      let hasError = false;

      let overspentCount = 0;
      for (const sid of cls.studentIds) {
        if (prev.attendanceRecords.some(r => r.studentId === sid && r.classId === classId && r.date === date)) continue;
        const result = resolveFIFOCard(cards, sid, cls.courseId, null);
        if (!result) { hasError = true; continue; }
        result.card.usedClasses += 1;
        if (result.isOverspent) overspentCount++;
        newRecords.push({ id: uid(), studentId: sid, classId, courseId: cls.courseId, date, status: '出勤', courseCardId: result.card.id, note: '', createdAt: new Date().toISOString() });
      }

      if (newRecords.length === 0) {
        if (hasError) flash('error', '部分学员没有购课记录，请先购买课时卡');
        else flash('info', '所有学员已有考勤记录');
        return prev;
      }

      const msg = overspentCount > 0
        ? `已标记 ${newRecords.length} 名学员出勤（${overspentCount}人已欠课）`
        : `已标记 ${newRecords.length} 名学员出勤`;
      flash('success', msg);
      return { ...prev, courseCards: cards, attendanceRecords: [...prev.attendanceRecords, ...newRecords] };
    });
  }, [flash, updateData]);

  const markAllHomework = useCallback((classId: ID, date: string) => {
    updateData(prev => {
      const cls = prev.classes.find(c => c.id === classId);
      if (!cls) { flash('error', '班级不存在'); return prev; }
      let newRecords: HomeworkRecord[] = [];
      for (const sid of cls.studentIds) {
        if (prev.homeworkRecords.some(r => r.studentId === sid && r.classId === classId && r.date === date)) continue;
        newRecords.push({ id: uid(), studentId: sid, classId, courseId: cls.courseId, date, status: '已提交', content: '', createdAt: new Date().toISOString() });
      }
      if (newRecords.length === 0) { flash('info', '所有学员已有作业记录'); return prev; }
      flash('success', `已标记 ${newRecords.length} 名学员作业已提交`);
      return { ...prev, homeworkRecords: [...prev.homeworkRecords, ...newRecords] };
    });
  }, [flash, updateData]);

  // ---- Backup / Import ----
  const exportBackup = useCallback((): string => {
    const payload: BackupFile = { app: 'wuyijiaschool-pwa', exportedAt: new Date().toISOString(), data };
    return JSON.stringify(payload, null, 2);
  }, [data]);

  const importBackup = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as BackupFile;
      if (parsed.app !== 'wuyijiaschool-pwa') throw new Error('备份文件不是舞艺嘉 PWA 数据');
      if (!parsed.data || parsed.data.version !== 1) throw new Error('备份文件版本不正确');
      setData(parsed.data);
      flash('success', '已导入备份');
    } catch (e) {
      flash('error', e instanceof Error ? e.message : '导入失败');
    }
  }, [flash]);

  // ---- UI actions ----
  const setTab = useCallback((tab: TabKey) => uiDispatch({ type: 'SET_TAB', tab }), []);
  const setDate = useCallback((date: string) => uiDispatch({ type: 'SET_DATE', date }), []);
  const setClassId = useCallback((id: ID) => uiDispatch({ type: 'SET_CLASS_ID', id }), []);
  const openStudentCalendar = useCallback((studentId: ID) => {
    uiDispatch({ type: 'OPEN_STUDENT_CALENDAR', studentId });
  }, []);
  const closeStudentCalendar = useCallback(() => uiDispatch({ type: 'CLOSE_STUDENT_CALENDAR' }), []);

  // ---- Context value ----
  const value: AppContextValue = {
    state,
    flash, setTab, setDate, setClassId, openStudentCalendar, closeStudentCalendar,
    createWorkspace, switchWorkspace, renameWorkspace, deleteWorkspace,
    createCourse, updateCourse, deleteCourse,
    createClass, updateClass, deleteClass,
    createStudent, attachStudent, removeStudent, updateStudent,
    purchaseCard, deleteCard,
    saveAttendance, deleteAttendance,
    saveHomework, deleteHomework,
    markAllAttendance, markAllHomework,
    exportBackup, importBackup,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
