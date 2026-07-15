import { useMemo, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import type { ID, AttendanceRecord, HomeworkRecord } from '../types';
import { formatDate, isoDateOnly, sortCourseCardsFIFO, toCSV, toExcelHTML } from '../utils';
import Empty from '../components/Empty';

// ============================================================
// Stack navigation
// ============================================================

type Screen =
  | { name: 'home' }
  | { name: 'classSummary' }
  | { name: 'studentDetail' };

function downloadText(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

export default function Reports() {
  const [stack, setStack] = useState<Screen[]>([{ name: 'home' }]);
  const current = stack[stack.length - 1];
  const push = (s: Screen) => setStack((prev) => [...prev, s]);
  const pop = () => setStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));

  const title = (s: Screen) => {
    switch (s.name) {
      case 'home': return '报表';
      case 'classSummary': return '班级汇总';
      case 'studentDetail': return '学员明细';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {stack.length > 1 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="ghost" onClick={pop} style={{ padding: '8px 12px', fontSize: 14 }}>← 返回</button>
          <h2 style={{ margin: 0, fontSize: 18 }}>{title(current)}</h2>
        </div>
      ) : null}

      {current.name === 'home' && <ReportsHome push={push} />}
      {current.name === 'classSummary' && <ClassSummaryReport />}
      {current.name === 'studentDetail' && <StudentDetailReport />}
    </div>
  );
}

// ============================================================
// Screen 1: REPORTS HOME (数据仪表盘)
// ============================================================

function ReportsHome({ push }: { push(s: Screen): void }) {
  const { state } = useAppContext();
  const { data } = state;

  // Low remaining hours warning
  const lowRemaining = useMemo(() => {
    const groups = new Map<string, {
      studentName: string; courseName: string; classNames: string;
      totalPurchased: number; totalUsed: number; totalRemaining: number;
      details: { id: string; purchasedAt: string; purchasedClasses: number; usedClasses: number; remainingClasses: number }[];
    }>();

    data.courseCards.forEach((card) => {
      const student = data.students.find((s) => s.id === card.studentId);
      const course = data.courses.find((c) => c.id === card.courseId);
      if (!student || !course) return;
      const key = `${student.id}-${course.id}`;
      let entry = groups.get(key);
      if (!entry) {
        entry = {
          studentName: student.name,
          courseName: course.name,
          classNames: student.classIds
            .map((cid) => data.classes.find((c) => c.id === cid))
            .filter((c): c is NonNullable<typeof c> => Boolean(c))
            .filter((c) => c.courseId === course.id)
            .map((c) => c.name)
            .join('、'),
          totalPurchased: 0, totalUsed: 0, totalRemaining: 0, details: [],
        };
        groups.set(key, entry);
      }
      entry.totalPurchased += card.purchasedClasses;
      entry.totalUsed += card.usedClasses;
      entry.totalRemaining += card.purchasedClasses - card.usedClasses;
      entry.details.push({
        id: card.id, purchasedAt: card.purchasedAt, purchasedClasses: card.purchasedClasses,
        usedClasses: card.usedClasses, remainingClasses: card.purchasedClasses - card.usedClasses,
      });
    });

    return Array.from(groups.values())
      .filter((e) => e.totalRemaining <= 5)
      .sort((a, b) => a.totalRemaining - b.totalRemaining || a.studentName.localeCompare(b.studentName));
  }, [data]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Nav cards */}
      <article className="panel">
        <div className="panel-head"><h2>统计报表</h2></div>
        <div className="cards">
          <button className="mini-card" onClick={() => push({ name: 'classSummary' })}>
            <div className="mini-card-title">
              <strong>班级汇总报表</strong>
              <span>按班级筛选 ▶</span>
            </div>
            <p className="muted" style={{ fontSize: 13, margin: '4px 0 0' }}>查看各班级学员的课时消耗与剩余统计</p>
          </button>
          <button className="mini-card" onClick={() => push({ name: 'studentDetail' })}>
            <div className="mini-card-title">
              <strong>学员明细报表</strong>
              <span>按学员筛选 ▶</span>
            </div>
            <p className="muted" style={{ fontSize: 13, margin: '4px 0 0' }}>查看学员个人考勤与作业轨迹</p>
          </button>
        </div>
      </article>

      {/* Stats overview */}
      <article className="panel">
        <div className="panel-head"><h2>数据概览</h2></div>
        <div className="stats">
          <div className="stat"><span>班级数</span><strong>{data.classes.length}</strong></div>
          <div className="stat"><span>学员数</span><strong>{data.students.length}</strong></div>
          <div className="stat"><span>课时预警</span><strong style={{ color: lowRemaining.length > 0 ? 'var(--danger)' : undefined }}>{lowRemaining.length}</strong></div>
        </div>
      </article>

      {/* Low remaining warning */}
      <article className="panel">
        <div className="panel-head">
          <div>
            <h2>剩余课时预警</h2>
            <p className="muted">剩余 ≤ 5 节或已欠课的学员</p>
          </div>
        </div>
        {lowRemaining.length === 0 ? (
          <p className="muted">当前没有需要提醒的学员。</p>
        ) : (
          <div className="cards">
            {lowRemaining.map((item) => (
              <div className="sub-card" key={`${item.studentName}-${item.courseName}`}>
                <div className="row">
                  <strong>{item.studentName}</strong>
                  <span style={{ color: 'var(--danger)', fontWeight: 600 }}>
                    {item.totalRemaining >= 0 ? `剩余 ${item.totalRemaining} 节` : `欠课 ${Math.abs(item.totalRemaining)} 节`}
                  </span>
                </div>
                <div className="row" style={{ marginTop: 2 }}>
                  <span>{item.courseName}</span>
                  <span className="muted">{item.classNames}</span>
                </div>
                <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                  累计 {item.totalPurchased} 节 · 已用 {item.totalUsed} 节
                </div>
                <div className="purchase-list">
                  {item.details.map((d) => (
                    <div className="purchase-pill" key={d.id}>
                      <strong>{formatDate(d.purchasedAt)}</strong>
                      <span>购 {d.purchasedClasses}</span>
                      <span>{d.remainingClasses >= 0 ? `剩 ${d.remainingClasses}` : `欠 ${Math.abs(d.remainingClasses)}`}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </article>
    </div>
  );
}

// ============================================================
// Screen 2: CLASS SUMMARY REPORT
// ============================================================

function ClassSummaryReport() {
  const { state } = useAppContext();
  const { data } = state;

  const [classId, setClassId] = useState<ID>(data.classes[0]?.id ?? '');
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1);
    return isoDateOnly(d);
  });
  const [dateTo, setDateTo] = useState(() => isoDateOnly(new Date()));

  const selectedClass = data.classes.find((c) => c.id === classId);

  const rows = useMemo(() => {
    if (!selectedClass) return [];
    const course = data.courses.find((c) => c.id === selectedClass.courseId);
    return selectedClass.studentIds
      .map((sid) => {
        const student = data.students.find((s) => s.id === sid);
        if (!student) return null;

        // All course cards for this student + course (lifetime)
        const allCards = data.courseCards.filter((cc) => cc.studentId === sid && cc.courseId === selectedClass.courseId);
        const totalPurch = allCards.reduce((a, b) => a + b.purchasedClasses, 0);
        const totalUsed = allCards.reduce((a, b) => a + b.usedClasses, 0);

        // Attendance in date range
        const attInRange = data.attendanceRecords.filter((r) => {
          if (r.studentId !== sid || r.classId !== selectedClass.id) return false;
          const d = isoDateOnly(r.date);
          return d >= dateFrom && d <= dateTo;
        });
        const hwInRange = data.homeworkRecords.filter((r) => {
          if (r.studentId !== sid || r.classId !== selectedClass.id) return false;
          const d = isoDateOnly(r.date);
          return d >= dateFrom && d <= dateTo && r.status === '已提交';
        });

        return {
          studentName: student.name,
          courseName: course?.name ?? '',
          totalPurch,
          totalUsed,
          remaining: totalPurch - totalUsed,
          attend: attInRange.filter((r) => r.status === '出勤').length,
          leave: attInRange.filter((r) => r.status === '请假').length,
          homework: hwInRange.length,
        };
      })
      .filter((r): r is NonNullable<typeof r> => Boolean(r));
  }, [data, classId, dateFrom, dateTo]);

  // Build date lookup: studentId → date → { attStatus, hwStatus, hwContent }
  const { dateHeaders, studentDateCells } = useMemo(() => {
    if (!selectedClass) return { dateHeaders: [] as string[], studentDateCells: new Map<ID, Record<string, { att: string; hw: string; hwContent: string }>>() };
    // Collect all dates in range
    const dates = new Set<string>();
    const allRecs = [...data.attendanceRecords, ...data.homeworkRecords];
    for (const r of allRecs) {
      if (r.classId !== selectedClass.id) continue;
      const d = isoDateOnly(r.date);
      if (d >= dateFrom && d <= dateTo) dates.add(d);
    }
    const sortedDates = [...dates].sort();

    const map = new Map<ID, Record<string, { att: string; hw: string; hwContent: string }>>();
    for (const sid of selectedClass.studentIds) {
      const cells: Record<string, { att: string; hw: string; hwContent: string }> = {};
      for (const d of sortedDates) {
        const att = data.attendanceRecords.find((r) => r.studentId === sid && r.classId === selectedClass.id && isoDateOnly(r.date) === d);
        const hw = data.homeworkRecords.find((r) => r.studentId === sid && r.classId === selectedClass.id && isoDateOnly(r.date) === d);
        cells[d] = { att: att?.status ?? '', hw: hw?.status ?? '', hwContent: hw?.content ?? '' };
      }
      map.set(sid, cells);
    }
    return { dateHeaders: sortedDates, studentDateCells: map };
  }, [data, selectedClass, dateFrom, dateTo]);

  const csvRows = useMemo(() => {
    if (!selectedClass || selectedClass.studentIds.length === 0) return [['']];
    const course = data.courses.find((c) => c.id === selectedClass.courseId);
    const students = selectedClass.studentIds
      .map((sid) => data.students.find((s) => s.id === sid))
      .filter((s): s is NonNullable<typeof s> => Boolean(s));

    // Pre-compute per-student stats
    const studentStats = students.map((student) => {
      const cells = studentDateCells.get(student.id) ?? {};
      const allCards = data.courseCards.filter((cc) => cc.studentId === student.id && cc.courseId === selectedClass.courseId);
      const totalPurch = allCards.reduce((a, b) => a + b.purchasedClasses, 0);
      const totalUsed = allCards.reduce((a, b) => a + b.usedClasses, 0);
      let attendCnt = 0, leaveCnt = 0, hwDone = 0;
      for (const d of dateHeaders) {
        const c = cells[d];
        if (c) {
          if (c.att === '出勤') attendCnt++;
          else if (c.att === '请假') leaveCnt++;
          if (c.hw === '已提交') hwDone++;
        }
      }
      return { totalPurch, totalUsed, remaining: totalPurch - totalUsed, attendCnt, leaveCnt, hwDone, cells };
    });

    const result: string[][] = [];

    // Row: summary labels + student names
    const nameHeader = ['统计项', ...students.map((s) => s.name)];
    const courseRow = ['课程', ...students.map(() => course?.name ?? '')];
    const purchRow = ['累计购买', ...studentStats.map((s) => String(s.totalPurch))];
    const usedRow = ['已用', ...studentStats.map((s) => String(s.totalUsed))];
    const remainRow = ['剩余', ...studentStats.map((s) => String(s.remaining))];
    const attRow = ['出勤', ...studentStats.map((s) => String(s.attendCnt))];
    const leaveRow = ['请假', ...studentStats.map((s) => String(s.leaveCnt))];
    const hwRow = ['作业已交', ...studentStats.map((s) => String(s.hwDone))];

    result.push(nameHeader, courseRow, purchRow, usedRow, remainRow, attRow, leaveRow, hwRow, []);

    // Row per date
    for (const d of dateHeaders) {
      const row = [d];
      for (const s of studentStats) {
        const c = s.cells[d];
        const parts: string[] = [];
        if (c.att) parts.push(c.att);
        if (c.hw) parts.push(c.hw);
        row.push(parts.length > 0 ? parts.join(' / ') : '-');
      }
      result.push(row);
    }

    return result;
  }, [selectedClass, data, dateHeaders, studentDateCells]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Filters */}
      <article className="panel">
        <div className="panel-head"><h2>筛选条件</h2></div>
        <div className="form-grid">
          <label>
            <span>班级</span>
            <select value={classId || data.classes[0]?.id || ''} onChange={(e) => setClassId(e.target.value)}>
              {data.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label>
            <span>起始日期</span>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </label>
          <label>
            <span>截止日期</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </label>
        </div>
        <div className="actions-row" style={{ marginTop: 12 }}>
          <button className="primary" onClick={() => downloadText(`班级汇总-${selectedClass?.name ?? ''}-${dateFrom}-${dateTo}.xls`, toExcelHTML(csvRows), 'application/vnd.ms-excel')} disabled={rows.length === 0}>导出 Excel</button>
        </div>
      </article>

      {/* Results */}
      <article className="panel">
        <div className="panel-head">
          <div>
            <h2>{selectedClass?.name ?? '班级'} · 学员统计</h2>
            <p className="muted">{dateFrom} 至 {dateTo} · {rows.length} 人</p>
          </div>
        </div>

        {rows.length === 0 ? (
          <Empty text="当前班级没有学员或该时间段内无数据。" />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="report-table">
              <thead>
                <tr>
                  <th>学员</th>
                  <th>课程</th>
                  <th>累计购买</th>
                  <th>已用</th>
                  <th>剩余</th>
                  <th>出勤</th>
                  <th>请假</th>
                  <th>作业</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td><strong>{r.studentName}</strong></td>
                    <td>{r.courseName}</td>
                    <td>{r.totalPurch}</td>
                    <td>{r.totalUsed}</td>
                    <td style={{ color: r.remaining < 0 ? 'var(--danger)' : r.remaining <= 5 ? 'var(--danger)' : undefined, fontWeight: 500 }}>
                      {r.remaining < 0 ? `欠${Math.abs(r.remaining)}` : r.remaining}
                    </td>
                    <td>{r.attend}</td>
                    <td>{r.leave}</td>
                    <td>{r.homework}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </div>
  );
}

// ============================================================
// Screen 3: STUDENT DETAIL REPORT
// ============================================================

function StudentDetailReport() {
  const { state } = useAppContext();
  const { data } = state;

  const [studentId, setStudentId] = useState<ID>(data.students[0]?.id ?? '');
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1);
    return isoDateOnly(d);
  });
  const [dateTo, setDateTo] = useState(() => isoDateOnly(new Date()));

  const student = data.students.find((s) => s.id === studentId);

  // Attendance records in range, grouped by class + date
  const attendanceData = useMemo(() => {
    if (!student) return [];
    return data.attendanceRecords
      .filter((r) => {
        if (r.studentId !== studentId) return false;
        const d = isoDateOnly(r.date);
        return d >= dateFrom && d <= dateTo;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [data, studentId, dateFrom, dateTo]);

  const homeworkData = useMemo(() => {
    if (!student) return [];
    return data.homeworkRecords
      .filter((r) => {
        if (r.studentId !== studentId) return false;
        const d = isoDateOnly(r.date);
        return d >= dateFrom && d <= dateTo;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [data, studentId, dateFrom, dateTo]);

  const attStats = useMemo(() => ({
    attend: attendanceData.filter((r) => r.status === '出勤').length,
    leave: attendanceData.filter((r) => r.status === '请假').length,
  }), [attendanceData]);

  const hwStats = useMemo(() => ({
    done: homeworkData.filter((r) => r.status === '已提交').length,
    undone: homeworkData.filter((r) => r.status === '未提交').length,
  }), [homeworkData]);

  const csvRows = useMemo(() => {
    if (!student) return [];
    const header = ['学员', '班级', '日期', '课程', '考勤', '课程卡（按日期动态剩余）', '作业', '开始日期', '结束日期'];
    const rows: string[][] = [header];

    // Merge attendance and homework by date+classId
    const dateMap = new Map<string, { att: AttendanceRecord | null; hw: HomeworkRecord | null }>();
    for (const att of attendanceData) {
      const key = `${isoDateOnly(att.date)}|${att.classId}`;
      const entry = dateMap.get(key) || { att: null, hw: null };
      entry.att = att;
      dateMap.set(key, entry);
    }
    for (const hw of homeworkData) {
      const key = `${isoDateOnly(hw.date)}|${hw.classId}`;
      const entry = dateMap.get(key) || { att: null, hw: null };
      entry.hw = hw;
      dateMap.set(key, entry);
    }

    // Sort by class name, then date ascending
    const merged = [...dateMap.entries()].sort(([a], [b]) => {
      const [dateA, classA] = a.split('|');
      const [dateB, classB] = b.split('|');
      const clsNameA = data.classes.find((c) => c.id === classA)?.name ?? '';
      const clsNameB = data.classes.find((c) => c.id === classB)?.name ?? '';
      if (clsNameA !== clsNameB) return clsNameA.localeCompare(clsNameB);
      return dateA.localeCompare(dateB);
    });

    for (const [, { att, hw }] of merged) {
      const rec = att || hw;
      if (!rec) continue;
      const cls = data.classes.find((c) => c.id === rec.classId);
      const course = data.courses.find((c) => c.id === rec.courseId);
      const rowDate = isoDateOnly(rec.date);

      // Dynamic course card state: calculate used/remaining up to this row's date
      const cards = sortCourseCardsFIFO(
        data.courseCards.filter((cc) => cc.studentId === studentId && cc.courseId === rec.courseId)
      );
      const cardSummary = cards.length > 0
        ? cards.map((cc) => {
            // Count attendance records linked to this card up to (and including) this date
            const usedUpToDate = data.attendanceRecords.filter(
              (a) => a.courseCardId === cc.id &&
                     a.studentId === studentId &&
                     a.status === '出勤' &&
                     isoDateOnly(a.date) <= rowDate
            ).length;
            const remaining = cc.purchasedClasses - usedUpToDate;
            return `购${cc.purchasedClasses}用${usedUpToDate}剩${remaining}`;
          }).join('；')
        : '无';

      rows.push([
        student.name,
        cls?.name ?? '',
        rowDate,
        course?.name ?? '',
        att?.status ?? '无记录',
        cardSummary,
        hw?.status ?? '无记录',
        dateFrom,
        dateTo,
      ]);
    }

    if (rows.length === 1) rows.push(['（该时段内无数据）']);
    return rows;
  }, [student, attendanceData, homeworkData, dateFrom, dateTo, data]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Filters */}
      <article className="panel">
        <div className="panel-head"><h2>筛选条件</h2></div>
        <div className="form-grid">
          <label>
            <span>学员</span>
            <select value={studentId || data.students[0]?.id || ''} onChange={(e) => setStudentId(e.target.value)}>
              {data.students.length === 0 ? <option value="">无学员</option> : null}
              {data.students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label>
            <span>起始日期</span>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </label>
          <label>
            <span>截止日期</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </label>
        </div>
      </article>

      {!student ? (
        <Empty text="请选择学员。" />
      ) : (
        <>
          {/* Stats */}
          <article className="panel">
            <div className="panel-head">
              <div>
                <h2>{student.name}</h2>
                <p className="muted">{dateFrom} 至 {dateTo}</p>
              </div>
              <span className="muted">{student.phone || ''}</span>
            </div>
            <div className="stats">
              <div className="stat"><span>出勤</span><strong>{attStats.attend}</strong></div>
              <div className="stat"><span>请假</span><strong>{attStats.leave}</strong></div>
            </div>
            <div className="stats" style={{ marginTop: 8 }}>
              <div className="stat"><span>作业已交</span><strong>{hwStats.done}</strong></div>
              <div className="stat"><span>作业未交</span><strong style={{ color: hwStats.undone > 0 ? 'var(--danger)' : undefined }}>{hwStats.undone}</strong></div>
            </div>
          </article>

          {/* Attendance list */}
          <article className="panel">
            <div className="panel-head">
              <div>
                <h2>考勤记录</h2>
                <p className="muted">{attendanceData.length} 条</p>
              </div>
            </div>
            {attendanceData.length === 0 ? (
              <p className="muted">该时间段内无考勤记录。</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>日期</th>
                      <th>班级</th>
                      <th>课程</th>
                      <th>状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceData.map((r) => {
                      const cls = data.classes.find((c) => c.id === r.classId);
                      const course = data.courses.find((c) => c.id === r.courseId);
                      const statusColor = r.status === '出勤' ? '#7c3aed' : '#dc2626';
                      return (
                        <tr key={r.id}>
                          <td>{formatDate(r.date)}</td>
                          <td>{cls?.name ?? ''}</td>
                          <td>{course?.name ?? ''}</td>
                          <td style={{ color: statusColor, fontWeight: 500 }}>{r.status}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </article>

          {/* Homework list */}
          <article className="panel">
            <div className="panel-head">
              <div>
                <h2>作业记录</h2>
                <p className="muted">{homeworkData.length} 条</p>
              </div>
            </div>
            {homeworkData.length === 0 ? (
              <p className="muted">该时间段内无作业记录。</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>日期</th>
                      <th>班级</th>
                      <th>课程</th>
                      <th>状态</th>
                      <th>内容</th>
                    </tr>
                  </thead>
                  <tbody>
                    {homeworkData.map((r) => {
                      const cls = data.classes.find((c) => c.id === r.classId);
                      const course = data.courses.find((c) => c.id === r.courseId);
                      return (
                        <tr key={r.id}>
                          <td>{formatDate(r.date)}</td>
                          <td>{cls?.name ?? ''}</td>
                          <td>{course?.name ?? ''}</td>
                          <td style={{ color: r.status === '已提交' ? '#7c3aed' : '#dc2626', fontWeight: 500 }}>{r.status}</td>
                          <td style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.content || '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </article>

          {/* CSV Export */}
          <article className="panel">
            <div className="panel-head"><h2>导出</h2></div>
            <button className="primary" onClick={() => downloadText(`学员明细-${student.name}-${dateFrom}-${dateTo}.xls`, toExcelHTML(csvRows), 'application/vnd.ms-excel')}>
              导出 Excel
            </button>
          </article>
        </>
      )}
    </div>
  );
}
