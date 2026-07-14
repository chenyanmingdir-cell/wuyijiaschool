import { useEffect, useState, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import type { AttendanceStatus, HomeworkStatus, ID, SchoolClass, Student } from '../types';
import { formatDate, isoDateOnly, uid } from '../utils';
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
  const { state, setDate, setTab, markAllAttendance, markAllHomework } = useAppContext();
  const { data, selectedDate } = state;

  const [view, setView] = useState<DashboardView>('list');
  const [activeClassId, setActiveClassId] = useState<ID>('');
  const activeClass = data.classes.find((c) => c.id === activeClassId) ?? null;

  const [actionDate, setActionDate] = useState(selectedDate);
  const [mode, setMode] = useState<'attendance' | 'homework'>('attendance');

  useEffect(() => { setActionDate(selectedDate); }, [selectedDate]);

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
          onSelectDate={(d) => setDate(d)}
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
                <Empty text="还没有班级，请先去班级页创建。" actionLabel="去创建班级" onAction={() => setTab('classes')} />
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
          <>
            {/* Card 1: Class Info */}
            <article className="panel">
              <div className="panel-head">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button className="ghost" onClick={backToList} style={{ padding: '4px 8px', fontSize: 14, minHeight: 'auto' }}>←</button>
                  <h2 style={{ fontSize: 18 }}>{activeClass.name}</h2>
                </div>
                <label className="inline-label" style={{ gap: 4 }}>
                  <span style={{ fontSize: 12 }}>日期</span>
                  <input type="date" value={actionDate} onChange={(e) => setActionDate(e.target.value)} style={{ padding: '6px 10px', fontSize: 13, minHeight: 'auto' }} />
                </label>
              </div>
              <div className="row" style={{ fontSize: 13 }}>
                <span>{activeCourse?.name ?? '未绑定课程'}</span>
                <span style={{ color: 'var(--muted)' }}>{activeStudents.length}人 · 已签到 {checkedIn}</span>
              </div>
            </article>

            {/* Card 2: Mode Toggle & Batch Actions */}
            <article className="panel">
              <div className="split-head" style={{ margin: 0 }}>
                <div className="segmented">
                  <button className={mode === 'attendance' ? 'seg active' : 'seg'} onClick={() => setMode('attendance')}>考勤</button>
                  <button className={mode === 'homework' ? 'seg active' : 'seg'} onClick={() => setMode('homework')}>作业</button>
                </div>
                <div>
                  {mode === 'attendance'
                    ? <button className="ghost" style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => markAllAttendance(activeClass.id, actionDate)}>全部出勤</button>
                    : <button className="ghost" style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => markAllHomework(activeClass.id, actionDate)}>全部提交</button>}
                </div>
              </div>
            </article>

            {/* Card 3: Student List */}
            <article className="panel">
              <div className="panel-head">
                <h2>学员列表</h2>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>{activeStudents.length} 人</span>
              </div>
              {activeStudents.length === 0 ? (
                <Empty text="当前班级还没有学员。" />
              ) : (
                <div className="cards">
                  {activeStudents.map((student) => (
                    <DailyStudentRow
                      key={student.id}
                      student={student}
                      schoolClass={activeClass}
                      date={actionDate}
                      mode={mode}
                    />
                  ))}
                </div>
              )}
            </article>
          </>
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
}

function DailyStudentRow({ student, schoolClass, date, mode }: DailyStudentRowProps) {
  const { state, saveAttendance, deleteAttendance, saveHomework, deleteHomework, openStudentCalendar } = useAppContext();
  const { data } = state;

  const course = data.courses.find((c) => c.id === schoolClass.courseId);
  const remaining = data.courseCards
    .filter((cc) => cc.studentId === student.id && cc.courseId === schoolClass.courseId)
    .reduce((a, b) => a + b.purchasedClasses - b.usedClasses, 0);

  const existingAtt = data.attendanceRecords.find(
    (a) => a.studentId === student.id && a.classId === schoolClass.id && a.date === date
  ) ?? null;
  const existingHw = data.homeworkRecords.find(
    (h) => h.studentId === student.id && h.classId === schoolClass.id && h.date === date
  ) ?? null;

  const currentAtt = existingAtt?.status ?? null;
  const currentHw = existingHw?.status ?? null;
  const hasRecord = mode === 'attendance' ? Boolean(existingAtt) : Boolean(existingHw);

  // Toggle attendance: click same = cancel, click different = save/switch
  const handleAttToggle = (status: AttendanceStatus) => {
    if (currentAtt === status) {
      // Cancel: delete the record
      if (existingAtt) deleteAttendance(existingAtt.id);
    } else {
      saveAttendance({
        id: existingAtt?.id ?? uid(),
        studentId: student.id,
        classId: schoolClass.id,
        courseId: schoolClass.courseId,
        date,
        status,
        courseCardId: existingAtt?.courseCardId ?? null,
        note: existingAtt?.note ?? '',
        selectedCourseCardId: existingAtt?.courseCardId ?? null,
      });
    }
  };

  // Toggle homework: click same = cancel, click different = save/switch
  const handleHwToggle = (status: HomeworkStatus) => {
    if (currentHw === status) {
      // Cancel: delete the record
      if (existingHw) deleteHomework(existingHw.id);
    } else {
      saveHomework({
        id: existingHw?.id ?? uid(),
        studentId: student.id,
        classId: schoolClass.id,
        courseId: schoolClass.courseId,
        date,
        status,
        content: existingHw?.content ?? '',
      });
    }
  };

  const attOptions: AttendanceStatus[] = ['出勤', '请假'];
  const hwOptions: HomeworkStatus[] = ['已提交', '未提交'];

  return (
    <div className="student-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
      {/* Left: name + info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {hasRecord ? <i className={`dot ${currentAtt === '出勤' ? 'purple' : 'red'}`} /> : null}
          <strong style={{ fontSize: 15 }}>{student.name}</strong>
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
          {course?.name ?? '未分课'}{remaining !== 0 ? (remaining > 0 ? ` · 剩${remaining}节` : ` · 欠${Math.abs(remaining)}节`) : ''}
        </div>
      </div>

      {/* Right: toggle buttons + calendar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {mode === 'attendance' ? (
          <div style={{ display: 'flex', gap: 0, background: 'var(--bg)', boxShadow: 'var(--neu-sm-inset)', borderRadius: 10, padding: 2 }}>
            {attOptions.map((opt) => (
              <button
                key={opt}
                onClick={() => handleAttToggle(opt)}
                style={{
                  border: 'none',
                  background: currentAtt === opt ? (opt === '请假' ? 'var(--danger)' : 'var(--primary)') : 'transparent',
                  color: currentAtt === opt ? '#fff' : 'var(--muted)',
                  borderRadius: 8,
                  padding: '5px 10px',
                  fontSize: 12,
                  fontWeight: currentAtt === opt ? 600 : 400,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  minHeight: 'auto',
                }}
              >
                {opt}
              </button>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 0, background: 'var(--bg)', boxShadow: 'var(--neu-sm-inset)', borderRadius: 10, padding: 2 }}>
            {hwOptions.map((opt) => (
              <button
                key={opt}
                onClick={() => handleHwToggle(opt)}
                style={{
                  border: 'none',
                  background: currentHw === opt ? (opt === '已提交' ? 'var(--primary)' : 'var(--danger)') : 'transparent',
                  color: currentHw === opt ? '#fff' : 'var(--muted)',
                  borderRadius: 8,
                  padding: '5px 10px',
                  fontSize: 12,
                  fontWeight: currentHw === opt ? 600 : 400,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  minHeight: 'auto',
                }}
              >
                {opt}
              </button>
            ))}
          </div>
        )}
        <button
          className="ghost"
          onClick={() => openStudentCalendar(student.id)}
          style={{ padding: '5px 8px', fontSize: 14, minHeight: 'auto', lineHeight: 1 }}
          title="个人日历"
        >
          📅
        </button>
      </div>
    </div>
  );
}
