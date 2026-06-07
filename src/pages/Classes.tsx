import { useEffect, useMemo, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import type { AttendanceStatus, AttendanceRecord, ID, SchoolClass, Student } from '../types';
import { formatDate, formatMonth, isoDateOnly, sortCourseCardsFIFO, startOfMonth, addMonths, totalRemainingForCourse, uid, weekdayLabel } from '../utils';
import Empty from '../components/Empty';

// ============================================================
// Stack-based navigation state
// ============================================================

type Screen =
  | { name: 'classList' }
  | { name: 'createClass' }
  | { name: 'classDetail'; classId: ID }
  | { name: 'addStudent'; classId: ID }
  | { name: 'studentDetail'; classId?: ID; studentId: ID }
  | { name: 'purchaseCard'; classId?: ID; studentId: ID; courseId?: ID }
  | { name: 'studentCalendar'; studentId: ID };

export default function Classes() {
  const { state, clearPendingCalendar } = useAppContext();
  const [stack, setStack] = useState<Screen[]>([{ name: 'classList' }]);
  const current = stack[stack.length - 1];

  // Handle cross-tab navigation: Dashboard → student calendar
  useEffect(() => {
    if (state.pendingStudentCalendarId) {
      push({ name: 'studentCalendar', studentId: state.pendingStudentCalendarId });
      clearPendingCalendar();
    }
  }, [state.pendingStudentCalendarId]);

  const push = (s: Screen) => setStack((prev) => [...prev, s]);
  const pop = () => setStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  const topTitle = (s: Screen) => {
    switch (s.name) {
      case 'classList': return '班级';
      case 'createClass': return '新增班级';
      case 'classDetail': return '班级管理';
      case 'addStudent': return '新增学员';
      case 'studentDetail': return '学员详情';
      case 'purchaseCard': return '购买课时';
      case 'studentCalendar': return '学员日历';
      default: return '';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Header with back arrow */}
      {stack.length > 1 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="ghost" onClick={pop} style={{ padding: '8px 12px', fontSize: 14 }}>← 返回</button>
          <h2 style={{ margin: 0, fontSize: 18 }}>{topTitle(current)}</h2>
        </div>
      ) : null}

      {current.name === 'classList' && <ClassListScreen push={push} />}
      {current.name === 'createClass' && <CreateClassScreen pop={pop} />}
      {current.name === 'classDetail' && <ClassDetailScreen classId={(current as any).classId} push={push} />}
      {current.name === 'addStudent' && <AddStudentScreen classId={(current as any).classId} pop={pop} />}
      {current.name === 'studentDetail' && <StudentDetailScreen classId={(current as any).classId} studentId={(current as any).studentId} push={push} />}
      {current.name === 'purchaseCard' && <PurchaseCardScreen classId={(current as any).classId} studentId={(current as any).studentId} courseId={(current as any).courseId} pop={pop} />}
      {current.name === 'studentCalendar' && <StudentCalendarScreen studentId={(current as any).studentId} />}
    </div>
  );
}

// ============================================================
// Screen 1: CLASS LIST
// ============================================================

function ClassListScreen({ push }: { push(s: Screen): void }) {
  const { state, setClassId } = useAppContext();
  const { data } = state;
  const courses = data.courses;
  const [viewTab, setViewTab] = useState<'classes' | 'students'>('classes');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Tab toggle */}
      <div style={{ textAlign: 'center' }}>
        <button
          onClick={() => setViewTab('classes')}
          style={{
            border: 'none', background: 'transparent', fontSize: 16,
            fontWeight: viewTab === 'classes' ? 700 : 400,
            color: viewTab === 'classes' ? 'var(--text)' : 'var(--muted)',
            padding: '8px 20px', cursor: 'pointer',
            borderBottom: viewTab === 'classes' ? '2px solid var(--primary)' : '2px solid transparent',
          }}
        >班级</button>
        <button
          onClick={() => setViewTab('students')}
          style={{
            border: 'none', background: 'transparent', fontSize: 16,
            fontWeight: viewTab === 'students' ? 700 : 400,
            color: viewTab === 'students' ? 'var(--text)' : 'var(--muted)',
            padding: '8px 20px', cursor: 'pointer',
            borderBottom: viewTab === 'students' ? '2px solid var(--primary)' : '2px solid transparent',
          }}
        >学员</button>
      </div>

      {viewTab === 'classes' ? (
        <article className="panel">
          <div className="panel-head">
            <h2>班级</h2>
            <button className="primary" onClick={() => push({ name: 'createClass' })}>新增班级</button>
          </div>

          <div className="cards">
            {data.classes.length === 0 ? (
              <Empty text="还没有班级。" actionLabel="新增班级" onAction={() => push({ name: 'createClass' })} />
            ) : null}
            {data.classes.map((c) => {
              const co = courses.find((cc) => cc.id === c.courseId);
              return (
                <button
                  key={c.id}
                  className="mini-card"
                  onClick={() => { setClassId(c.id); push({ name: 'classDetail', classId: c.id }); }}
                >
                  <div className="mini-card-title">
                    <strong>{c.name}</strong>
                    <span>{co?.name ?? '未绑定课程'}</span>
                  </div>
                  <div className="row">
                    <span>学员人数 {c.studentIds.length}</span>
                    <span>{formatDate(c.createdAt)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </article>
      ) : (
        <StudentListScreen push={push} />
      )}
    </div>
  );
}

// ============================================================
// Screen 1b: STUDENT LIST (all students)
// ============================================================

function StudentListScreen({ push }: { push(s: Screen): void }) {
  const { state } = useAppContext();
  const { data } = state;

  return (
    <article className="panel">
      <div className="panel-head">
        <h2>全部学员</h2>
        <span className="muted">{data.students.length} 人</span>
      </div>

      <div className="cards">
        {data.students.length === 0 ? (
          <Empty text="还没有学员。请先在班级中新增学员。" />
        ) : null}
        {data.students.map((student) => {
          const classNames = student.classIds
            .map((cid) => data.classes.find((c) => c.id === cid)?.name ?? '')
            .filter(Boolean)
            .join('、');
          // Total remaining across all course cards
          const totalPending = data.courseCards
            .filter((cc) => cc.studentId === student.id)
            .reduce((a, b) => a + b.purchasedClasses - b.usedClasses, 0);
          return (
            <button
              key={student.id}
              className="mini-card"
              onClick={() => push({ name: 'studentDetail', studentId: student.id })}
            >
              <div className="mini-card-title">
                <strong>{student.name}</strong>
                <span>剩余 {totalPending} 节</span>
              </div>
              <div className="row">
                <span className="muted" style={{ fontSize: 12 }}>
                  {classNames || '暂无班级'}
                </span>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                  {student.classIds.length} 个班级
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </article>
  );
}

// ============================================================
// Screen 2: CREATE CLASS
// ============================================================

function CreateClassScreen({ pop }: { pop(): void }) {
  const { state, createClass } = useAppContext();
  const { data } = state;
  const courses = data.courses;

  const [name, setName] = useState('');
  const [courseId, setCourseId] = useState('');
  const [newCourseName, setNewCourseName] = useState('');

  const handleSave = () => {
    createClass(name, courseId, newCourseName);
    pop();
  };

  return (
    <article className="panel">
      <div className="form-grid">
        <label>
          <span>班级名称</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如 幼小衔接暑假班" />
        </label>

        <label>
          <span>绑定已有课程</span>
          <select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
            <option value="">选择已有课程</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>

        <label>
          <span>或者新建课程</span>
          <input value={newCourseName} onChange={(e) => setNewCourseName(e.target.value)} placeholder="例如 舞蹈、衔接" />
          <div className="field-hint">不填则自动用班级名称创建课程</div>
        </label>
      </div>

      <div className="actions-row">
        <button className="primary" onClick={handleSave} disabled={!name.trim()}>保存</button>
        <button className="ghost" onClick={pop}>取消</button>
      </div>
    </article>
  );
}

// ============================================================
// Screen 3: CLASS DETAIL (management)
// ============================================================

function ClassDetailScreen({ classId, push }: { classId: ID; push(s: Screen): void }) {
  const { state, updateClass, deleteClass } = useAppContext();
  const { data } = state;
  const cls = data.classes.find((c) => c.id === classId);
  const courses = data.courses;
  if (!cls) return <Empty text="班级不存在。" />;

  const course = courses.find((c) => c.id === cls.courseId);

  const [editName, setEditName] = useState(cls.name);
  const [editCourseId, setEditCourseId] = useState(cls.courseId || courses[0]?.id || '');
  const [editingClass, setEditingClass] = useState(false);

  const classStudents = cls.studentIds
    .map((sid) => data.students.find((s) => s.id === sid))
    .filter((s): s is Student => Boolean(s));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Class info: compact read-only by default */}
      <article className="panel">
        <div className="panel-head">
          <div>
            <h2>{cls.name}</h2>
          </div>
          {!editingClass ? (
            <button className="ghost" style={{ fontSize: 13, padding: '6px 12px' }}
              onClick={() => { setEditName(cls.name); setEditCourseId(cls.courseId || courses[0]?.id || ''); setEditingClass(true); }}
            >编辑</button>
          ) : (
            <button className="ghost" style={{ fontSize: 12 }} onClick={() => setEditingClass(false)}>收起</button>
          )}
        </div>
        <p className="row" style={{ marginBottom: 4 }}>
          <span>{course?.name ?? '未绑定课程'}</span>
          <span className="muted">学员人数 {cls.studentIds.length} 人</span>
        </p>
        <p className="muted" style={{ fontSize: 12, marginBottom: editingClass ? 12 : 0 }}>{formatDate(cls.createdAt)}</p>

        {editingClass ? (
          <>
            <div className="form-grid">
              <label>
                <span>班级名称</span>
                <input value={editName} onChange={(e) => setEditName(e.target.value)} />
              </label>
              <label>
                <span>绑定课程</span>
                <select value={editCourseId || courses[0]?.id || ''} onChange={(e) => setEditCourseId(e.target.value)}>
                  {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
            </div>
            <div className="actions-row">
              <button className="primary" onClick={() => { updateClass(cls.id, editName, editCourseId); setEditingClass(false); }}>保存</button>
              <button className="ghost danger" onClick={() => deleteClass(cls.id)}>删除班级</button>
            </div>
          </>
        ) : null}
      </article>

      {/* Add Student button */}
      <div className="actions-row" style={{ justifyContent: 'flex-end' }}>
        <button className="ghost" onClick={() => push({ name: 'addStudent', classId: cls.id })}>+ 新增学员</button>
      </div>

      {/* Student roster */}
      <article className="panel">
        <div className="panel-head"><h2>学员列表</h2></div>
        <div className="cards">
          {classStudents.length === 0 ? <Empty text="当前班级还没有学员。" /> : null}
          {classStudents.map((student) => {
            const remaining = totalRemainingForCourse(data, student.id, cls.courseId);
            return (
              <button
                key={student.id}
                className="mini-card"
                onClick={() => push({ name: 'studentDetail', classId: cls.id, studentId: student.id })}
              >
                <div className="mini-card-title">
                  <strong>{student.name}</strong>
                  <span>剩余 {remaining} 节</span>
                </div>
                <div className="row">
                  <span>{student.phone || '无电话'}</span>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>点击查看详情 ▶</span>
                </div>
              </button>
            );
          })}
        </div>
      </article>
    </div>
  );
}

// ============================================================
// Screen 3b: ADD STUDENT
// ============================================================

function AddStudentScreen({ classId, pop }: { classId: ID; pop(): void }) {
  const { state, createStudent, attachStudent } = useAppContext();
  const { data } = state;
  const cls = data.classes.find((c) => c.id === classId);
  if (!cls) return <Empty text="班级不存在。" />;

  const [newStuName, setNewStuName] = useState('');
  const [newStuPhone, setNewStuPhone] = useState('');
  const [newStuNote, setNewStuNote] = useState('');
  const [purchaseCnt, setPurchaseCnt] = useState('24');
  const [existStuId, setExistStuId] = useState('');

  const otherStudents = data.students.filter((s) => !cls.studentIds.includes(s.id));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <article className="panel">
        <div className="panel-head"><h2>新增学员</h2></div>
        <div className="form-grid">
          <label><span>姓名</span><input value={newStuName} onChange={(e) => setNewStuName(e.target.value)} placeholder="学员姓名" /></label>
          <label><span>电话</span><input value={newStuPhone} onChange={(e) => setNewStuPhone(e.target.value)} placeholder="手机号" /></label>
          <label><span>备注</span><input value={newStuNote} onChange={(e) => setNewStuNote(e.target.value)} placeholder="备注" /></label>
          <label><span>购买课时</span><input value={purchaseCnt} onChange={(e) => setPurchaseCnt(e.target.value)} inputMode="numeric" /></label>
        </div>
        <button className="primary" onClick={() => {
          createStudent(cls.id, newStuName, newStuPhone, newStuNote, Number(purchaseCnt || 0));
          pop();
        }} disabled={!newStuName.trim()}>新增学员</button>
      </article>

      {otherStudents.length > 0 ? (
        <article className="panel">
          <div className="panel-head"><h2>加入已有学员</h2></div>
          <label>
            <select value={existStuId} onChange={(e) => setExistStuId(e.target.value)}>
              <option value="">选择学员</option>
              {otherStudents.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
          <div className="actions-row" style={{ marginTop: 10 }}>
            <button className="ghost" disabled={!existStuId} onClick={() => { attachStudent(cls.id, existStuId); pop(); }}>加入当前班级</button>
          </div>
        </article>
      ) : null}
    </div>
  );
}

// ============================================================
// Screen 4: STUDENT DETAIL
// ============================================================

function StudentDetailScreen({ classId: _classId, studentId, push }: { classId?: ID; studentId: ID; push(s: Screen): void }) {
  const { state, deleteCard, updateStudent } = useAppContext();
  const { data } = state;
  const student = data.students.find((s) => s.id === studentId);
  if (!student) return <Empty text="学员不存在。" />;

  // All course cards for this student, grouped by course
  const allCards = data.courseCards.filter((cc) => cc.studentId === studentId);
  const totalPurchased = allCards.reduce((a, b) => a + b.purchasedClasses, 0);
  const totalUsed = allCards.reduce((a, b) => a + b.usedClasses, 0);
  const totalRemaining = Math.max(totalPurchased - totalUsed, 0);

  // Per-course grouping
  const courseGroups: { courseId: ID; courseName: string; classIds: ID[]; cards: typeof allCards }[] = [];
  const seen = new Set<ID>();
  for (const cc of allCards) {
    if (seen.has(cc.courseId)) continue;
    seen.add(cc.courseId);
    const course = data.courses.find((c) => c.id === cc.courseId);
    const cardsForCourse = allCards.filter((c) => c.courseId === cc.courseId);
    const classIdsForCourse = student.classIds.filter((cid) => {
      const cls = data.classes.find((c) => c.id === cid);
      return cls?.courseId === cc.courseId;
    });
    courseGroups.push({ courseId: cc.courseId, courseName: course?.name ?? '未知课程', classIds: classIdsForCourse, cards: cardsForCourse });
  }
  // Also include classes without cards
  for (const cid of student.classIds) {
    const cls = data.classes.find((c) => c.id === cid);
    if (!cls) continue;
    if (!seen.has(cls.courseId)) {
      seen.add(cls.courseId);
      const course = data.courses.find((c) => c.id === cls.courseId);
      courseGroups.push({ courseId: cls.courseId, courseName: course?.name ?? '未知课程', classIds: [cid], cards: [] });
    }
  }

  // Attendance summary per course
  const attByCourse: Record<ID, { attend: number; leave: number; absent: number }> = {};
  for (const r of data.attendanceRecords) {
    if (r.studentId !== studentId) continue;
    if (!attByCourse[r.courseId]) attByCourse[r.courseId] = { attend: 0, leave: 0, absent: 0 };
    if (r.status === '出勤') attByCourse[r.courseId].attend++;
    else if (r.status === '请假') attByCourse[r.courseId].leave++;
    else if (r.status === '旷课') attByCourse[r.courseId].absent++;
  }

  const hwByCourse: Record<ID, { done: number; undone: number }> = {};
  for (const r of data.homeworkRecords) {
    if (r.studentId !== studentId) continue;
    if (!hwByCourse[r.courseId]) hwByCourse[r.courseId] = { done: 0, undone: 0 };
    if (r.status === '已提交') hwByCourse[r.courseId].done++;
    else hwByCourse[r.courseId].undone++;
  }

  // All classes this student is in
  const studentClasses = student.classIds
    .map((cid) => data.classes.find((c) => c.id === cid))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));

  const [showEdit, setShowEdit] = useState(false);
  const [edName, setEdName] = useState(student.name);
  const [edPhone, setEdPhone] = useState(student.phone);
  const [edNote, setEdNote] = useState(student.note);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Student info */}
      <article className="panel">
        <div className="panel-head">
          <div>
            <h2>{student.name}</h2>
            <p className="muted">{studentClasses.map((c) => c.name).join('、') || '暂无班级'}</p>
          </div>
          <button className="ghost" style={{ fontSize: 13 }} onClick={() => { setEdName(student.name); setEdPhone(student.phone); setEdNote(student.note); setShowEdit(true); }}>编辑资料</button>
        </div>

        <div className="stats">
          <Stat label="累计购买" value={totalPurchased} />
          <Stat label="已用课时" value={totalUsed} />
          <Stat label="剩余课时" value={totalRemaining} />
        </div>

        <div className="row" style={{ fontSize: 13 }}>
          <span>电话：{student.phone || '未填写'}</span>
        </div>
        <div className="row" style={{ fontSize: 13, marginTop: 4 }}>
          <span>备注：{student.note || '无'}</span>
        </div>
      </article>

      {/* Per-course sections */}
      {courseGroups.map((group) => {
        const att = attByCourse[group.courseId] ?? { attend: 0, leave: 0, absent: 0 };
        const hw = hwByCourse[group.courseId] ?? { done: 0, undone: 0 };
        const groupPurch = group.cards.reduce((a, b) => a + b.purchasedClasses, 0);
        const groupUsed = group.cards.reduce((a, b) => a + b.usedClasses, 0);
        const groupRemaining = Math.max(groupPurch - groupUsed, 0);

        return (
          <article className="panel" key={group.courseId}>
            <div className="panel-head">
              <h2>{group.courseName}</h2>
              <span className="muted">{group.classIds.map((cid) => data.classes.find((c) => c.id === cid)?.name ?? '').join('、')}</span>
            </div>

            <div className="stats" style={{ marginBottom: 10 }}>
              <Stat label="购买" value={groupPurch} />
              <Stat label="已用" value={groupUsed} />
              <Stat label="剩余" value={groupRemaining} />
            </div>

            <div className="row" style={{ fontSize: 12, marginBottom: 8 }}>
              <span>考勤：出 {att.attend} · 假 {att.leave} · 旷 {att.absent}</span>
              <span>作业：交 {hw.done} · 未交 {hw.undone}</span>
            </div>

            {group.cards.length > 0 ? (
              <div className="cards">
                {group.cards.map((cc) => (
                  <div key={cc.id} className="sub-card" style={{ padding: '10px 14px' }}>
                    <div className="row">
                      <span>{formatDate(cc.purchasedAt)}</span>
                      <span>购 {cc.purchasedClasses} 节</span>
                    </div>
                    <div className="row" style={{ marginTop: 2 }}>
                      <span className="muted">已用 {cc.usedClasses} 节</span>
                      <span>剩余 {cc.purchasedClasses - cc.usedClasses} 节</span>
                    </div>
                    {cc.usedClasses === 0 ? (
                      <button className="ghost danger" style={{ marginTop: 6, fontSize: 11, padding: '4px 10px' }}
                        onClick={() => deleteCard(cc.id)}>删除</button>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted" style={{ fontSize: 12 }}>暂无购课记录</p>
            )}

            <div className="actions-row" style={{ marginTop: 10 }}>
              <button className="ghost" style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => push({
                name: 'purchaseCard',
                studentId,
                classId: group.classIds[0] ?? undefined,
                courseId: group.courseId,
              })}>购买课时</button>
            </div>
          </article>
        );
      })}

      {/* Actions */}
      <article className="panel">
        <div className="panel-head"><h2>快捷操作</h2></div>
        <div className="actions-row">
          <button className="ghost" onClick={() => push({ name: 'studentCalendar', studentId })}>考勤日历</button>
        </div>
      </article>

      {/* Edit modal */}
      {showEdit ? (
        <div className="sheet-backdrop" onClick={() => setShowEdit(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head">
              <button className="ghost" onClick={() => setShowEdit(false)}>取消</button>
              <strong>编辑学员</strong>
              <button className="primary" onClick={() => { updateStudent(studentId, edName, edPhone, edNote); setShowEdit(false); }}>保存</button>
            </div>
            <div className="form-grid">
              <label><span>姓名</span><input value={edName} onChange={(e) => setEdName(e.target.value)} /></label>
              <label><span>电话</span><input value={edPhone} onChange={(e) => setEdPhone(e.target.value)} placeholder="手机号" /></label>
              <label><span>备注</span><input value={edNote} onChange={(e) => setEdNote(e.target.value)} placeholder="备注" /></label>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ============================================================
// Screen 5: PURCHASE CARD
// ============================================================

function PurchaseCardScreen({ classId: _classId, studentId, courseId, pop }: {
  classId?: ID; studentId: ID; courseId?: ID; pop(): void;
}) {
  const { state, purchaseCard } = useAppContext();
  const { data } = state;
  const student = data.students.find((s) => s.id === studentId);
  const [amount, setAmount] = useState('24');
  const [purchasedAt, setPurchasedAt] = useState(isoDateOnly(new Date()));
  const [selCourseId, setSelectedCourseId] = useState(courseId ?? data.courses[0]?.id ?? '');

  const course = data.courses.find((c) => c.id === selCourseId);

  return (
    <article className="panel">
      <div className="panel-head">
        <div>
          <h2>{student?.name ?? '学员'}</h2>
          <p className="muted">{course?.name ?? ''}</p>
        </div>
      </div>

      <div className="form-grid">
        <label>
          <span>购买课程</span>
          <select value={selCourseId} onChange={(e) => setSelectedCourseId(e.target.value)}>
            {data.courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label>
          <span>购买日期</span>
          <input type="date" value={purchasedAt} onChange={(e) => setPurchasedAt(e.target.value)} />
        </label>
        <label>
          <span>购买课时数</span>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" placeholder="例如 24" />
        </label>
      </div>

      <div className="actions-row">
        <button className="primary" onClick={() => {
          purchaseCard(studentId, selCourseId, purchasedAt, Number(amount || 0));
          pop();
        }} disabled={!amount || Number(amount) <= 0 || !selCourseId}>确认购买</button>
        <button className="ghost" onClick={pop}>取消</button>
      </div>
    </article>
  );
}

// ============================================================
// Screen 6: STUDENT CALENDAR
// ============================================================

function StudentCalendarScreen({ studentId }: { studentId: ID }) {
  const { state } = useAppContext();
  const { data } = state;
  const student = data.students.find((s) => s.id === studentId);
  if (!student) return <Empty text="学员不存在。" />;

  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(isoDateOnly(new Date()));

  // Build a map: dateStr → set of statuses for that day (for colored dots)
  const dayStatusMap = useMemo(() => {
    const map: Record<string, { att: Set<AttendanceStatus>; hasHw: boolean }> = {};
    for (const r of data.attendanceRecords) {
      if (r.studentId !== studentId) continue;
      const d = isoDateOnly(r.date);
      if (!map[d]) map[d] = { att: new Set(), hasHw: false };
      map[d].att.add(r.status);
    }
    for (const r of data.homeworkRecords) {
      if (r.studentId !== studentId) continue;
      const d = isoDateOnly(r.date);
      if (!map[d]) map[d] = { att: new Set(), hasHw: false };
      map[d].hasHw = true;
    }
    return map;
  }, [data.attendanceRecords, data.homeworkRecords, studentId]);

  const buildMonthDays = (monthStart: Date): Date[] => {
    const firstWeekday = monthStart.getDay();
    const start = new Date(monthStart);
    start.setDate(start.getDate() - firstWeekday);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  };

  const monthDays = buildMonthDays(monthCursor);

  // Attendance records for selected date
  const dayRecords = data.attendanceRecords.filter(
    (r) => r.studentId === studentId && isoDateOnly(r.date) === selectedDate
  );

  // Homework records for selected date
  const dayHwRecords = data.homeworkRecords.filter(
    (r) => r.studentId === studentId && isoDateOnly(r.date) === selectedDate
  );

  // Classes this student belongs to
  const studentClasses = student.classIds
    .map((cid) => data.classes.find((c) => c.id === cid))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Upper: Calendar */}
      <article className="panel">
        <div className="panel-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button className="ghost" onClick={() => setMonthCursor(addMonths(monthCursor, -1))}>上月</button>
          <div>
            <h2 style={{ margin: 0, fontSize: 16 }}>{student.name}</h2>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>{formatMonth(monthCursor)}</p>
          </div>
          <button className="ghost" onClick={() => setMonthCursor(addMonths(monthCursor, 1))}>下月</button>
        </div>

        <div className="calendar">
          {Array.from({ length: 7 }, (_, i) => weekdayLabel(i)).map((w) => (
            <div key={w} className="weekday">{w}</div>
          ))}
          {monthDays.map((day) => {
            const dayStr = isoDateOnly(day);
            const isToday = dayStr === isoDateOnly(new Date());
            const entry = dayStatusMap[dayStr];
            const isSelected = dayStr === selectedDate;
            const hasPurple = entry?.att.has('出勤');
            const hasRed = entry && !entry.att.has('出勤') && entry.att.size > 0;
            const hasHw = entry?.hasHw;
            return (
              <button
                key={day.toISOString()}
                className={['day', isSelected && 'selected', isToday && 'today'].filter(Boolean).join(' ')}
                onClick={() => setSelectedDate(dayStr)}
              >
                <span>{day.getDate()}</span>
                <div className="dots">
                  {hasPurple ? <i className="dot purple" /> : null}
                  {hasRed ? <i className="dot red" /> : null}
                  {hasHw ? <i className="dot blue" /> : null}
                </div>
              </button>
            );
          })}
        </div>
      </article>

      {/* Lower: Detail & Edit for selected date */}
      <article className="panel">
        <div className="panel-head">
          <h2>{formatDate(selectedDate)}</h2>
        </div>

        {dayRecords.length === 0 ? (
          <p className="muted" style={{ marginBottom: 12 }}>当日无考勤记录</p>
        ) : (
          dayRecords.map((r) => (
            <StudentCalendarAttendanceEdit key={r.id} record={r} studentId={studentId} date={selectedDate} />
          ))
        )}

        <hr style={{ margin: '16px 0', border: 'none', borderTop: '1px solid var(--border)' }} />

        {/* New attendance entry */}
        <div style={{ marginBottom: 16 }}>
          <div className="panel-head" style={{ marginBottom: 8 }}><h3 style={{ fontSize: 15 }}>新增考勤</h3></div>
          <StudentCalendarQuickAdd studentId={studentId} date={selectedDate} studentClasses={studentClasses} />
        </div>

        {/* Homework for selected date */}
        {dayHwRecords.length > 0 && (
          <>
            <div className="panel-head" style={{ marginBottom: 8 }}><h3 style={{ fontSize: 15 }}>作业记录</h3></div>
            {dayHwRecords.map((r) => {
              const hwCls = data.classes.find((c) => c.id === r.classId);
              return (
                <div key={r.id} className="sub-card" style={{ padding: '10px 14px', marginBottom: 8 }}>
                  <div className="row"><span>{hwCls?.name ?? ''}</span><span style={{ color: r.status === '已提交' ? 'var(--primary)' : 'var(--danger)', fontWeight: 500 }}>{r.status}</span></div>
                  {r.content ? <p className="muted" style={{ margin: '4px 0 0', fontSize: 12 }}>内容：{r.content}</p> : null}
                </div>
              );
            })}
          </>
        )}
      </article>
    </div>
  );
}

// ---- Sub-component: display + edit existing attendance ----
function StudentCalendarAttendanceEdit({ record, studentId, date }: { record: AttendanceRecord; studentId: ID; date: string }) {
  const { state, deleteAttendance, saveAttendance } = useAppContext();
  const { data } = state;
  const cls = data.classes.find((c) => c.id === record.classId);
  const course = data.courses.find((c) => c.id === record.courseId);

  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<AttendanceStatus>(record.status);
  const [cardId, setCardId] = useState(record.courseCardId ?? '');
  const [note, setNote] = useState(record.note);

  const eligibleCards = sortCourseCardsFIFO(
    data.courseCards.filter((cc) => cc.studentId === studentId && cc.courseId === record.courseId && cc.purchasedClasses > cc.usedClasses)
  );

  useEffect(() => {
    setStatus(record.status);
    setCardId(record.courseCardId ?? '');
    setNote(record.note);
  }, [record.id]);

  const statusColor = record.status === '出勤' ? '#7c3aed' : record.status === '请假' ? '#f59e0b' : '#dc2626';

  if (!editing) {
    return (
      <div className="sub-card" style={{ padding: '12px 14px', marginBottom: 10 }}>
        <div className="row" style={{ marginBottom: 4 }}>
          <span><strong>{cls?.name ?? '未知班级'}</strong></span>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>{course?.name ?? ''}</span>
        </div>
        <div className="row" style={{ marginBottom: 4 }}>
          <span style={{ color: statusColor, fontWeight: 500, fontSize: 14 }}>状态：{record.status}</span>
          {record.courseCardId ? (
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>
              课程卡：{eligibleCards.find((cc) => cc.id === record.courseCardId)?.purchasedClasses ?? '?'}节
            </span>
          ) : null}
        </div>
        {record.note ? <p style={{ fontSize: 12, color: 'var(--muted)', margin: '4px 0' }}>备注：{record.note}</p> : null}
        <div className="actions-row" style={{ marginTop: 6 }}>
          <button className="ghost" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => setEditing(true)}>编辑考勤</button>
          <button className="ghost danger" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => deleteAttendance(record.id)}>删除</button>
        </div>
      </div>
    );
  }

  return (
    <div className="sub-card" style={{ padding: '12px 14px', marginBottom: 10 }}>
      <div className="row" style={{ marginBottom: 8 }}>
        <span>{cls?.name ?? '未知班级'}</span>
        <span className="muted">{course?.name ?? ''}</span>
      </div>
      <div className="form-grid">
        <label>
          <span>考勤状态</span>
          <select value={status} onChange={(e) => setStatus(e.target.value as AttendanceStatus)}>
            <option value="出勤">出勤</option>
            <option value="请假">请假</option>
            <option value="旷课">旷课</option>
          </select>
        </label>
        <label>
          <span>课程卡</span>
          <select value={cardId || eligibleCards[0]?.id || ''} onChange={(e) => setCardId(e.target.value)}>
            <option value="">不关联</option>
            {eligibleCards.map((cc) => <option key={cc.id} value={cc.id}>{formatDate(cc.purchasedAt)} 购{cc.purchasedClasses}节</option>)}
          </select>
        </label>
        <label>
          <span>备注</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="备注" />
        </label>
      </div>
      <div className="actions-row">
        <button className="primary" onClick={() => {
          saveAttendance({ id: record.id, studentId, classId: record.classId, courseId: record.courseId, date, status, courseCardId: cardId || null, note, selectedCourseCardId: cardId || null });
          setEditing(false);
        }}>保存</button>
        <button className="ghost" onClick={() => setEditing(false)}>取消</button>
      </div>
    </div>
  );
}

// ---- Sub-component: quick add attendance on student calendar ----
function StudentCalendarQuickAdd({ studentId, date, studentClasses }: { studentId: ID; date: string; studentClasses: SchoolClass[] }) {
  const { state, saveAttendance } = useAppContext();
  const { data } = state;

  const [selClassId, setSelClassId] = useState(studentClasses[0]?.id ?? '');
  const [status, setStatus] = useState<AttendanceStatus>('出勤');
  const [cardId, setCardId] = useState('');
  const [note, setNote] = useState('');

  if (studentClasses.length === 0) {
    return <p className="muted">该学员尚未加入任何班级。</p>;
  }

  const selCourseId = studentClasses.find((c) => c.id === selClassId)?.courseId ?? '';
  const eligibleCards = sortCourseCardsFIFO(
    data.courseCards.filter((cc) => cc.studentId === studentId && cc.courseId === selCourseId && cc.purchasedClasses > cc.usedClasses)
  );

  return (
    <div className="form-grid">
      <label>
        <span>班级</span>
        <select value={selClassId || studentClasses[0]?.id || ''} onChange={(e) => { setSelClassId(e.target.value); setCardId(''); }}>
          {studentClasses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      <label>
        <span>考勤状态</span>
        <select value={status} onChange={(e) => setStatus(e.target.value as AttendanceStatus)}>
          <option value="出勤">出勤</option>
          <option value="请假">请假</option>
          <option value="旷课">旷课</option>
        </select>
      </label>
      <label>
        <span>课程卡</span>
        <select value={cardId || eligibleCards[0]?.id || ''} onChange={(e) => setCardId(e.target.value)}>
          <option value="">不关联</option>
          {eligibleCards.map((cc) => <option key={cc.id} value={cc.id}>{formatDate(cc.purchasedAt)} 购{cc.purchasedClasses}节</option>)}
        </select>
      </label>
      <label>
        <span>备注</span>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="备注" />
      </label>
      <button className="primary" onClick={() => saveAttendance({
        id: uid(), studentId, classId: selClassId, courseId: selCourseId, date, status, courseCardId: cardId || null, note, selectedCourseCardId: cardId || null,
      })}>新增考勤</button>
    </div>
  );
}

// ============================================================
// Small stat component
// ============================================================

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
