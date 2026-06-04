import { useRef, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { exportBackup, importBackup } from '../storage';
import Empty from '../components/Empty';
import { formatDate } from '../utils';

function downloadText(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

export default function Settings() {
  const { state, dispatch } = useAppContext();
  const { data } = state;
  const [editing, setEditing] = useState(false);
  const [courseName, setCourseName] = useState('');
  const importRef = useRef<HTMLInputElement | null>(null);

  const handleImport = async (file: File | null) => {
    if (!file) return;
    try {
      const imported = await importBackup(file);
      dispatch({ type: 'REPLACE_DATA', data: imported });
    } catch (e: any) {
      dispatch({ type: 'SET_FLASH', flash: { kind: 'error', text: e.message || '导入失败' } });
    } finally {
      if (importRef.current) importRef.current.value = '';
    }
  };

  return (
    <section className="grid-2">
      {/* Courses */}
      <article className="panel">
        <div className="panel-head">
          <div>
            <h2>课程设置</h2>
          </div>
          {!editing ? (
            <button className="ghost" style={{ fontSize: 13, padding: '6px 12px' }} onClick={() => setEditing(true)}>编辑</button>
          ) : (
            <button className="ghost" style={{ fontSize: 12 }} onClick={() => setEditing(false)}>收起</button>
          )}
        </div>

        {/* Read-only course list */}
        <div className="cards">
          {data.courses.length === 0 ? <Empty text="当前还没有课程。" /> : null}
          {data.courses.map((course) => (
            <div className="mini-card" key={course.id}>
              <div className="mini-card-title">
                <strong>{course.name}</strong>
                <span>{formatDate(course.createdAt)}</span>
              </div>
              <div className="row">
                <span>关联班级 {data.classes.filter((c) => c.courseId === course.id).length}</span>
                <span>关联购课 {data.courseCards.filter((cc) => cc.courseId === course.id).length}</span>
              </div>
              {editing ? (
                <button className="ghost danger" style={{ marginTop: 6, padding: '4px 10px', fontSize: 12 }}
                  onClick={() => dispatch({ type: 'DELETE_COURSE', id: course.id })}>删除</button>
              ) : null}
            </div>
          ))}
        </div>

        {/* Add course form, shown only when editing */}
        {editing ? (
          <div style={{ marginTop: 12 }}>
            <div className="form-grid">
              <label>
                <span>新增课程</span>
                <input value={courseName} onChange={(e) => setCourseName(e.target.value)} placeholder="例如 舞蹈、数学" />
              </label>
              <div>
                <button className="primary" onClick={() => { dispatch({ type: 'CREATE_COURSE', name: courseName }); setCourseName(''); }}>
                  新增课程
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </article>

      {/* Backup */}
      <article className="panel">
        <div className="panel-head">
          <div>
            <h2>数据备份</h2>
            <p className="muted">导出 JSON，换手机时直接恢复</p>
          </div>
        </div>
        <input ref={importRef} type="file" accept="application/json" hidden onChange={(e) => { void handleImport(e.target.files?.[0] ?? null); }} />
        <div className="actions-row">
          <button className="primary" onClick={async () => {
            const json = await exportBackup(data);
            downloadText(`wuyijiaschool-backup-${new Date().toISOString().slice(0, 10)}.json`, json, 'application/json');
            dispatch({ type: 'SET_FLASH', flash: { kind: 'success', text: '已导出备份文件' } });
          }}>导出备份 JSON</button>
          <button className="ghost" onClick={() => importRef.current?.click()}>导入备份 JSON</button>
        </div>
      </article>
    </section>
  );
}
