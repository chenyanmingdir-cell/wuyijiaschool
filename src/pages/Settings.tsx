import { useRef, useState } from 'react';
import { useAppContext } from '../context/AppContext';
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
  const { state, flash, createCourse, deleteCourse, createWorkspace, switchWorkspace, deleteWorkspace, exportBackup, importBackup } = useAppContext();
  const { data, workspaceId, workspaceName, workspaces } = state;

  // Course editing
  const [editing, setEditing] = useState(false);
  const [courseName, setCourseName] = useState('');

  // Workspace
  const [showNewWs, setShowNewWs] = useState(false);
  const [newWsName, setNewWsName] = useState('');

  const importRef = useRef<HTMLInputElement | null>(null);

  const handleImport = async (file: File | null) => {
    if (!file) return;
    try {
      await importBackup(file);
    } catch (e: any) {
      flash('error', e.message || '导入失败');
    } finally {
      if (importRef.current) importRef.current.value = '';
    }
  };

  return (
    <section className="grid-2">
      {/* Workspace Management */}
      <article className="panel" style={{ gridColumn: '1 / -1' }}>
        <div className="panel-head">
          <div>
            <h2>数据版本</h2>
            <p className="muted">每个人可以有自己的数据版本，互不影响。切换后自动保存当前数据。</p>
          </div>
        </div>

        {/* Current workspace + list */}
        <div className="cards">
          {workspaces.map((ws) => (
            <div
              key={ws.id}
              className={`mini-card${ws.id === workspaceId ? ' active' : ''}`}
              style={ws.id === workspaceId ? { borderColor: 'var(--primary)', background: 'var(--panel-bg)' } : {}}
            >
              <div className="mini-card-title">
                <strong>
                  {ws.name}
                  {ws.id === workspaceId ? <span style={{ fontSize: 11, color: 'var(--primary)', marginLeft: 8 }}>当前使用</span> : null}
                </strong>
              </div>
              <div className="row" style={{ marginTop: 4 }}>
                <span className="muted" style={{ fontSize: 12 }}>创建于 {formatDate(ws.createdAt)}</span>
              </div>
              <div className="row" style={{ marginTop: 4 }}>
                <span style={{ fontSize: 12 }}>
                  班级 {ws.data.classes.length} · 学员 {ws.data.students.length}
                </span>
              </div>
              <div className="actions-row" style={{ marginTop: 8 }}>
                {ws.id !== workspaceId ? (
                  <button className="primary" style={{ fontSize: 12, padding: '6px 14px' }} onClick={() => switchWorkspace(ws.id)}>
                    切换到此版本
                  </button>
                ) : null}
                {ws.id === workspaceId && workspaces.length > 1 ? (
                  <button className="ghost danger" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => deleteWorkspace(ws.id)}>
                    删除
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        {/* New workspace */}
        {showNewWs ? (
          <div className="form-grid" style={{ marginTop: 12 }}>
            <label>
              <span>新版本名称</span>
              <input
                value={newWsName}
                onChange={(e) => setNewWsName(e.target.value)}
                placeholder="例如：李老师的数据"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newWsName.trim()) {
                    createWorkspace(newWsName).then(() => {
                      setNewWsName('');
                      setShowNewWs(false);
                    });
                  }
                }}
              />
            </label>
            <div className="actions-row">
              <button className="primary" disabled={!newWsName.trim()} onClick={async () => {
                await createWorkspace(newWsName);
                setNewWsName('');
                setShowNewWs(false);
              }}>创建</button>
              <button className="ghost" onClick={() => { setShowNewWs(false); setNewWsName(''); }}>取消</button>
            </div>
          </div>
        ) : (
          <div className="actions-row" style={{ marginTop: 12 }}>
            <button className="ghost" onClick={() => setShowNewWs(true)}>+ 新建数据版本</button>
          </div>
        )}
      </article>

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
                  onClick={() => deleteCourse(course.id)}>删除</button>
              ) : null}
            </div>
          ))}
        </div>

        {editing ? (
          <div style={{ marginTop: 12 }}>
            <div className="form-grid">
              <label>
                <span>新增课程</span>
                <input value={courseName} onChange={(e) => setCourseName(e.target.value)} placeholder="例如 舞蹈、数学" />
              </label>
              <div>
                <button className="primary" onClick={() => { createCourse(courseName); setCourseName(''); }}>
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
            <p className="muted">导出当前「{workspaceName}」的数据为 JSON，可导入到其他版本或备份保存</p>
          </div>
        </div>
        <input ref={importRef} type="file" accept="application/json" hidden onChange={(e) => { void handleImport(e.target.files?.[0] ?? null); }} />
        <div className="actions-row">
          <button className="primary" onClick={() => {
            const json = exportBackup();
            downloadText(`wuyijiaschool-${workspaceName}-${new Date().toISOString().slice(0, 10)}.json`, json, 'application/json');
            flash('success', '已导出备份文件');
          }}>导出备份 JSON</button>
          <button className="ghost" onClick={() => importRef.current?.click()}>导入备份 JSON</button>
        </div>
        <p className="muted" style={{ marginTop: 8, fontSize: 12 }}>导入会替换当前「{workspaceName}」的数据，请确认后再操作。</p>
      </article>
    </section>
  );
}
