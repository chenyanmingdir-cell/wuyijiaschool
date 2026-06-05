-- ============================================================
-- 舞艺嘉 PWA - 工作区系统（v2）
-- 先删除旧表，再建新表。请在 Supabase SQL Editor 执行。
-- ============================================================

DROP TABLE IF EXISTS homework_records;
DROP TABLE IF EXISTS attendance_records;
DROP TABLE IF EXISTS course_cards;
DROP TABLE IF EXISTS students;
DROP TABLE IF EXISTS classes;
DROP TABLE IF EXISTS courses;

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON workspaces FOR ALL USING (true) WITH CHECK (true);
