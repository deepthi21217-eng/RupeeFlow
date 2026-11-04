import { useState } from 'react';
import { Bell, CheckCheck, X } from 'lucide-react';
import { useNotifications } from '@/context/useNotifications';

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="relative text-slate-400 hover:text-blue-600 p-1" title="Notifications" aria-label="Notifications">
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && <span className="absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center px-1">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>
      {open && <>
        <button className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} aria-label="Close notifications" />
        <div className="absolute right-0 top-8 z-50 w-80 max-w-[calc(100vw-2rem)] rf-card shadow-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div><h3 className="text-sm font-semibold text-slate-800">Notifications</h3><p className="text-[11px] text-slate-400">{unreadCount} unread</p></div>
            <div className="flex items-center gap-2"><button onClick={() => void markAllRead()} className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"><CheckCheck className="w-3.5 h-3.5" /> Mark all read</button><button onClick={() => setOpen(false)} className="text-slate-400"><X className="w-4 h-4" /></button></div>
          </div>
          <div className="max-h-80 overflow-y-auto">{notifications.length === 0 ? <p className="text-sm text-slate-400 text-center py-8">No notifications yet.</p> : notifications.map((notification) => <button key={notification.id} onClick={() => void markRead(notification.id)} className={`w-full text-left px-4 py-3 border-b border-slate-50 hover:bg-blue-50/50 ${!notification.is_read ? 'bg-blue-50/30' : ''}`}><div className="flex gap-2"><span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${notification.is_read ? 'bg-slate-200' : 'bg-blue-600'}`} /><div><p className="text-xs font-semibold text-slate-700">{notification.title}</p><p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{notification.message}</p><p className="text-[10px] text-slate-400 mt-1">{new Date(notification.created_at).toLocaleString('en-IN')}</p></div></div></button>)}</div>
        </div>
      </>}
    </div>
  );
}
