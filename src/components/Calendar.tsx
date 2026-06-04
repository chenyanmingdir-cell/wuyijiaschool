import { useState } from 'react';
import { formatMonth, startOfMonth, addMonths, isoDateOnly, weekdayLabel } from '../utils';
import type { ID } from '../types';

interface CalendarProps {
  selectedDate: string;
  onSelectDate: (date: string) => void;
  markers: Record<string, { hasAttendance: boolean; hasHomework: boolean }>;
}

function buildMonthDays(monthStart: Date): Date[] {
  const firstWeekday = monthStart.getDay();
  const start = new Date(monthStart);
  start.setDate(start.getDate() - firstWeekday);
  return Array.from({ length: 42 }, (_, i) => {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    return day;
  });
}

export default function Calendar({ selectedDate, onSelectDate, markers }: CalendarProps) {
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(new Date(selectedDate)));
  const monthDays = buildMonthDays(monthCursor);

  return (
    <div>
      <div className="panel-head" style={{ justifyContent: 'center', gap: 16 }}>
        <button className="ghost" onClick={() => setMonthCursor(addMonths(monthCursor, -1))} style={{ padding: '8px 12px', fontSize: 16 }}>←</button>
        <strong style={{ fontSize: 15, minWidth: 90, textAlign: 'center' }}>{formatMonth(monthCursor)}</strong>
        <button className="ghost" onClick={() => setMonthCursor(addMonths(monthCursor, 1))} style={{ padding: '8px 12px', fontSize: 16 }}>→</button>
      </div>

      <div className="calendar">
        {Array.from({ length: 7 }, (_, i) => weekdayLabel(i)).map((w) => (
          <div key={w} className="weekday">{w}</div>
        ))}
        {monthDays.map((day) => {
          const dayStr = isoDateOnly(day);
          const isToday = dayStr === isoDateOnly(new Date());
          const isSelected = dayStr === selectedDate;
          const flags = markers[dayStr] ?? { hasAttendance: false, hasHomework: false };
          return (
            <button
              key={day.toISOString()}
              className={['day', isSelected && 'selected', isToday && 'today'].filter(Boolean).join(' ')}
              onClick={() => onSelectDate(dayStr)}
            >
              <span>{day.getDate()}</span>
              <div className="dots">
                {flags.hasAttendance ? <i className="dot purple" /> : null}
                {flags.hasHomework ? <i className="dot blue" /> : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
