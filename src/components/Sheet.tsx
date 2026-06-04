import type { ReactNode } from 'react';

interface SheetProps {
  title: string;
  onClose: () => void;
  onSave?: () => void;
  children: ReactNode;
}

export default function Sheet({ title, onClose, onSave, children }: SheetProps) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <button className="ghost" onClick={onClose}>取消</button>
          <strong>{title}</strong>
          {onSave ? (
            <button className="primary" onClick={onSave}>保存</button>
          ) : (
            <div />
          )}
        </div>
        <div className="form-grid">{children}</div>
      </div>
    </div>
  );
}
