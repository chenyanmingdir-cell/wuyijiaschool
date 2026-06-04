import { useEffect, useState, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import type { AttendanceStatus, HomeworkStatus, ID, SchoolClass, Student } from '../types';
import { formatDate, groupedAttendance, groupedHomework, isoDateOnly, sortCourseCardsFIFO, totalRemainingForCourse, uid } from '../utils';
import Calendar from '../components/Calendar';
import Empty from '../components/Empty';

function classFlagsForClassDay(data: { attendanceRecords: { classId: ID; date: string }[]; homeworkRecords: { classId: ID; date: string; status: string }[] }, classId: string, date: string) {
  const day = isoDateOnly(date);
  return {
    hasAttendance: data.attendanceRecords.some((r) => r.classId === classId && isoDateOnly(r.date) === day),
    hasHomework: data.homeworkRecords.some((r) => r.classId === classId && isoDateOnly(r.date) === day && r.status === '已提交'),
  };
}

type DashboardView = 'list' | 'daily';

export default function Dashboard() {
  const { state, dispatch } = useAppContext();
  const { data, selectedDate } = state;

  const [view, setView] = useState<DashboardView>('list');
  const [activeClassId, setActiveClassId] = useState<ID>('');
  const activeClass = data.classes.find((c) => c.id === activeClassId) ?? null;

  const [actionDate, setActionDate] = useState(selectedDate);
  const [mode, setMode] = useState<'attendance' | 'homework'>('attendance');
  const [attDrafts, setAttDrafts] = useState<Record<ID, AttendanceStatus>>({});
  const [hwDrafts, setHwDrafts] = useState<Record<ID, { status: HomeworkStatus; content: string }>>({});

  useEffect(() => { setActionDate(selectedDate); }, [selectedDate]);

  useEffect(() => {
    if (!activeClass) return;
    const next: Record<ID, AttendanceStatus> = {};
    activeClass.studentIds.forEach((sid) => {
      const r = data.attendanceRecords.find((a) => a.studentId === sid && a.classId === activeClass.id && a.date === actionDate);
      next[sid] = r?.status ?? '出勤';
    });
    setAttDrafts(next);
  }, [activeClass?.id, actionDate, data.attendanceRecords]);

  useEffect(() => {
    if (!activeClass) return;
    const next: Record<ID, { status: HomeworkStatus; content: string }> = {};
    activeClass.studentIds.forEach((sid) => {
      const r = data.homeworkRecords.find((h) => h.studentId === sid && h.classId === activeClass.id && h.date === actionDate);
      next[sid] = r ? { status: r.status, content: r.content } : { status: '已提交', content: '' };
    });
    setHwDrafts(next);
  }, [activeClass?.id, actionDate, data.homeworkRecords]);

  const calendarMarkers = useMemo(() => {
    const m: Record<string, { hasAttendance: boolean; hasHomework: boolean }> = {};
    for (const r of data.attendanceRecords) {
      const d = isoDateOnly(r.date);
      if (!m[d]) m[d] = { hasAttendance: false, hasHomework: false };
      m[d].hasAttendance = true;
    }
    for (const r of data.homeworkRecords) {
      const d = isoDateOnly(r.date);
      if (!m[d]) m[d] = { hasAttendance: false, hasHomework: false };
      if (r.status === '已提交') m[d].hasHomework = true;
    }
    return m;
  }, [data.attendanceRecords, data.homeworkRecords]);

  const classCards = useMemo(() =>
    data.classes.map((c) => {
      const course = data.courses.find((co) => co.id === c.courseId);
      return { schoolClass: c, course, flags: classFlagsForClassDay(data, c.id, selectedDate) };
    }),
  [data.classes, data.courses, selectedDate, data.attendanceRecords, data.homeworkRecords]);

  const activeCourse = data.courses.find((co) => co.id === activeClass?.courseId);
  const activeStudents = (activeClass?.studentIds ?? [])
    .map((sid) => data.students.find((s) => s.id === sid))
    .filter((s): s is Student => Boolean(s));
  const checkedIn = activeStudents.filter((s) => {
    const r = data.attendanceRecords.find((a) => a.studentId === s.id && a.classId === activeClass?.id && a.date === actionDate);
    return r?.status === '出勤';
  }).length;

  const openDaily = (classId: ID) => {
    setActiveClassId(classId);
    setView('daily');
  };

  const backToList = () => {
    setView('list');
    setActiveClassId('');
  };

  return (
    <section className="grid-2">
      {/* LEFT: Calendar */}
      <article className="panel hero">
        <Calendar
          selectedDate={selectedDate}
          onSelectDate={(d) => dispatch({ type: 'SET_DATE', date: d })}
          markers={calendarMarkers}
        />
      </article>

      {/* RIGHT: Class List or Daily Processing */}
      <aside className="stack">
        {view === 'list' ? (
          /* ────── Class List ────── */
          <article className="panel">
            <div className="panel-head">
              <div>
                <h2>当日班级</h2>
                <p>{formatDate(selectedDate)}</p>
              </div>
            </div>
            <div className="cards">
              {classCards.length === 0 ? (
                <Empty text="还没有班级，请先去班级页创建。" actionLabel="去创建班级" onAction={() => dispatch({ type: 'SET_TAB', tab: 'classes' })} />
              ) : null}
              {classCards.map(({ schoolClass, course, flags }) => (
                <button
                  key={schoolClass.id}
                  className="mini-card"
                  onClick={() => openDaily(schoolClass.id)}
                >
                  <div className="mini-card-title">
                    <strong>{schoolClass.name}</strong>
                    <span>{course?.name ?? '未绑定课程'}</span>
                  </div>
                  <div className="row">
                    <span>学员人数 {schoolClass.studentIds.length}</span>
                    <span className="status-dots">
                      {flags.hasAttendance ? <i className="dot purple" /> : null}
                      {flags.hasHomework ? <i className="dot blue" /> : null}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </article>
        ) : activeClass ? (
          /* ────── Daily Processing ────── */
          <article className="panel">
            <div className="panel-head">
              <div>
                <button className="ghost" onClick={backToList} style={{ padding: '2px 4px', marginRight: 8 }}>← 返回</button>
                <h2>班级当日处理</h2>
              </div>
              <label className="inline-label">
                <span>日期</span>
                <input type="date" value={actionDate} onChange={(e) => setActionDate(e.target.value)} />
              </label>
            </div>
            <p style={{ padding: '0 16px 8px', fontSize: 13, color: 'var(--muted)' }}>
              {activeClass.name} · {activeCourse?.name ?? '未绑定课程'} · 学员人数 {activeStudents.length} · 已签到 {checkedIn}
            </p>

            <div className="split-head">
              <div className="segmented">
                <button className={mode === 'attendance' ? 'seg active' : 'seg'} onClick={() => setMode('attendance')}>批量考勤</button>
                <button className={mode === 'homework' ? 'seg active' : 'seg'} onClick={() => setMode('homework')}>批量作业</button>
              </div>
              <div>
                {mode === 'attendance'
                  ? <button className="ghost" onClick={() => dispatch({ type: 'MARK_ALL_ATTENDANCE', classId: activeClass.id, date: actionDate })}>全部出勤</button>
                  : <button className="ghost" onClick={() => dispatch({ type: 'MARK_ALL_HOMEWORK', classId: activeClass.id, date: actionDate })}>全部提交</button>}
              </div>
            </div>

            <div className="cards" style={{ marginTop: 10 }}>
              {activeStudents.length === 0 ? <Empty text="当前班级还没有学员。" /> : null}
              {activeStudents.map((student) => (
                <DailyStudentRow
                  key={student.id}
                  student={student}
                  schoolClass={activeClass}
                  date={actionDate}
                  mode={mode}
                  attValue={attDrafts[student.id] ?? '出勤'}
                  hwValue={hwDrafts[student.id] ?? { status: '已提交', content: '' }}
                  onAttChange={(s) => setAttDrafts((p) => ({ ...p, [student.id]: s }))}
                  onHwChange={(h) => setHwDrafts((p) => ({ ...p, [student.id]: h }))}
                />
              ))}
            </div>
          </article>
        ) : null}
      </aside>
    </section>
  );
}

// =========== DailyStudentRow ===========

interface DailyStudentRowProps {
  student: Student;
  schoolClass: SchoolClass;
  date: string;
  mode: 'attendance' | 'homework';
  attValue: AttendanceStatus;
  hwValue: { status: HomeworkStatus; content: string };
  onAttChange(status: AttendanceStatus): void;
  onHwChange(next: { status: HomeworkStatus; content: string }): void;
}

function DailyStudentRow({
  student, schoolClass, date, mode, attValue, hwValue, onAttChange, onHwChange,
}: DailyStudentRowProps) {
  const { state, dispatch } = useAppContext();
  const { data } = state;

  const course = data.courses.find((c) => c.id === schoolClass.courseId);
  const existingAtt = groupedAttendance(data, student.id, schoolClass.id, date)[0] ?? null;
  const existingHw = groupedHomework(data, student.id, schoolClass.id, date)[0] ?? null;
  const eligibleCards = sortCourseCardsFIFO(
    data.courseCards.filter((cc) => cc.studentId === student.id && cc.courseId === schoolClass.courseId && cc.purchasedClasses > cc.usedClasses)
  );
  const remaining = totalRemainingForCourse(data, student.id, schoolClass.courseId);
  const [cardId, setCardId] = useState(existingAtt?.courseCardId ?? eligibleCards[0]?.id ?? '');
  const [attNote, setAttNote] = useState(existingAtt?.note ?? '');

  useEffect(() => { setCardId(existingAtt?.courseCardId ?? eligibleCards[0]?.id ?? ''); }, [existingAtt?.courseCardId, eligibleCards.length]);
  useEffect(() => { setAttNote(existingAtt?.note ?? ''); }, [existingAtt?.note]);

  const saveAtt = () => dispatch({
    type: 'SAVE_ATTENDANCE',
    payload: { id: existingAtt?.id ?? uid(), studentId: student.id, classId: schoolClass.id, courseId: schoolClass.courseId, date, status: attValue, courseCardId: cardId || null, note: attNote, selectedCourseCardId: cardId || null },
  });

  const saveHw = () => dispatch({
    type: 'SAVE_HOMEWORK',
    payload: { id: existingHw?.id ?? uid(), studentId: student.id, classId: schoolClass.id, courseId: schoolClass.courseId, date, status: hwValue.status, content: hwValue.content },
  });

  const hasRecord = mode === 'attendance' ? Boolean(existingAtt) : Boolean(existingHw);

  return (
    <div className="mini-card">
      <div className="mini-card-title">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {hasRecord ? <i className="dot purple" /> : null}
          <strong>{student.name}</strong>
        </div>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{course?.name ?? '未分课'} · 剩余 {remaining} 节</span>
      </div>

      {mode === 'attendance' ? (
        <div className="row-stack">
          <div className="row">
            <span>当前：{existingAtt ? existingAtt.status : '未记录'}</span>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>
              {existingAtt?.courseCardId ? `课程卡: ${eligibleCards.find((cc) => cc.id === existingAtt.courseCardId)?.purchasedClasses ?? 0} 节` : '未关联'}
            </span>
          </div>
          <select value={attValue} onChange={(e) => onAttChange(e.target.value as AttendanceStatus)}>
            <option value="出勤">出勤</option><option value="请假">请假</option><option value="旷课">旷课</option>
          </select>
          <div style={{ display: 'flex', gap: 8 }}>
            <select value={cardId} onChange={(e) => setCardId(e.target.value)} style={{ flex: 1 }}>
              <option value="">不关联课程卡</option>
              {eligibleCards.map((cc) => <option key={cc.id} value={cc.id}>{formatDate(cc.purchasedAt)} 购{cc.purchasedClasses}节</option>)}
            </select>
            <input value={attNote} onChange={(e) => setAttNote(e.target.value)} placeholder="备注" style={{ flex: 1 }} />
          </div>
          <div className="actions-row">
            <button className="primary" onClick={saveAtt}>保存</button>
            {existingAtt ? <button className="ghost danger" onClick={() => dispatch({ type: 'DELETE_ATTENDANCE', recordId: existingAtt.id })}>删除</button> : null}
            <button className="ghost" style={{ fontSize: 12, padding: '8px 12px' }} onClick={() => dispatch({ type: 'OPEN_STUDENT_CALENDAR', studentId: student.id })}>个人日历</button>
          </div>
        </div>
      ) : (
        <div className="row-stack">
          <div className="row"><span>当前：{existingHw ? existingHw.status : '无记录'}</span></div>
          <select value={hwValue.status} onChange={(e) => onHwChange({ ...hwValue, status: e.target.value as HomeworkStatus })}>
            <option value="已提交">已提交</option><option value="未提交">未提交</option>
          </select>
          <textarea value={hwValue.content} onChange={(e) => onHwChange({ ...hwValue, content: e.target.value })} placeholder="作业内容或备注" rows={2} />
          <div className="actions-row">
            <button className="primary" onClick={saveHw}>保存</button>
            {existingHw ? <button className="ghost danger" onClick={() => dispatch({ type: 'DELETE_HOMEWORK', recordId: existingHw.id })}>删除</button> : null}
          </div>
        </div>
      )}
    </div>
  );
}
