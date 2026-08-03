import { useState } from 'react';
import { formatMonth, startOfMonth, addMonths, isoDateOnly, weekdayLabel } from '../utils';
import type { ID } from '../types';
import { IconChevronLeft, IconChevronRight } from './Icons';

interface CalendarProps {
  selectedDate: string;
  onSelectDate: (date: string) => void;
  markers: Record<string, { hasAttendance: boolean; hasLeave: boolean; hasHomework: boolean }>;
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
      {/* Title — same style as 当日班级 panel heading */}
      <h2 style={{
        textAlign: 'center',
        fontFamily: 'var(--font-display)',
        fontSize: 17,
        fontWeight: 600,
        color: 'var(--text)',
        margin: '0 0 14px',
        letterSpacing: '-0.01em',
      }}>
        舞艺嘉学校教学日历
      </h2>

      <div className="panel-head" style={{ justifyContent: 'center', gap: 16 }}>
        <button
          onClick={() => setMonthCursor(addMonths(monthCursor, -1))}
          aria-label="上个月"
          style={{
            background: 'transparent',
            border: 'none',
            padding: '8px 10px',
            color: 'var(--muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 8,
            cursor: 'pointer',
          }}
        >
          <IconChevronLeft size={18} />
        </button>
        <strong style={{ fontSize: 15, minWidth: 90, textAlign: 'center' }}>{formatMonth(monthCursor)}</strong>
        <button
          onClick={() => setMonthCursor(addMonths(monthCursor, 1))}
          aria-label="下个月"
          style={{
            background: 'transparent',
            border: 'none',
            padding: '8px 10px',
            color: 'var(--muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 8,
            cursor: 'pointer',
          }}
        >
          <IconChevronRight size={18} />
        </button>
      </div>

      <div className="calendar">
        {Array.from({ length: 7 }, (_, i) => weekdayLabel(i)).map((w) => (
          <div key={w} className="weekday">{w}</div>
        ))}
        {monthDays.map((day) => {
          const dayStr = isoDateOnly(day);
          const isToday = dayStr === isoDateOnly(new Date());
          const isSelected = dayStr === selectedDate;
          const flags = markers[dayStr] ?? { hasAttendance: false, hasLeave: false, hasHomework: false };
          return (
            <button
              key={day.toISOString()}
              className={['day', isSelected && 'selected', isToday && 'today'].filter(Boolean).join(' ')}
              onClick={() => onSelectDate(dayStr)}
            >
              <span>{day.getDate()}</span>
              <div className="dots">
                {flags.hasAttendance ? <i className="dot purple" /> : null}
                {flags.hasLeave ? <i className="dot red" /> : null}
                {flags.hasHomework ? <i className="dot blue" /> : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
