import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { getActivityLogs } from '../services/adminService';
import { useToast } from '../context/ToastContext';
import {
  ShieldAlert,
  AlertTriangle,
  Clock,
  Search,
  Filter,
  CheckCircle2,
  AlertOctagon,
  ArrowLeft,
} from 'lucide-react';

export const ActivityLogsPage = () => {
  const [searchParams] = useSearchParams();
  const testIdParam = searchParams.get('testId');
  const toast = useToast();

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [eventTypeFilter, setEventTypeFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = {};
      if (testIdParam) params.testId = testIdParam;
      if (eventTypeFilter) params.eventType = eventTypeFilter;
      if (severityFilter) params.severity = severityFilter;

      const res = await getActivityLogs(params);
      if (res.success) {
        setLogs(res.logs || []);
      }
    } catch (err) {
      toast.error('Failed to load integrity audit logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [testIdParam, eventTypeFilter, severityFilter]);

  const filteredLogs = logs.filter((log) => {
    const student = log.studentId;
    const test = log.testId;
    return (
      student?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student?.rollNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      test?.title?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-rose-400" />
            <span>Anti-Cheating & Integrity Audit Logs</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Browser-level event audit trail tracking fullscreen changes, window blur, tab switching, and auto-submissions.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={eventTypeFilter}
            onChange={(e) => setEventTypeFilter(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-xl py-1.5 px-3 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="">All Event Types</option>
            <option value="retina_gaze_violation">Retina Gaze Violation (Eyes Off-Screen)</option>
            <option value="face_not_detected">Face Not Detected</option>
            <option value="multiple_faces_detected">Multiple Faces Detected</option>
            <option value="camera_disconnected">Camera Disconnected</option>
            <option value="tab_switch">Tab Switch</option>
            <option value="fullscreen_exit">Fullscreen Exit</option>
            <option value="window_blur">Window Blur</option>
            <option value="auto_submitted_violation">Auto-Submitted (Disqualified / Limit)</option>
            <option value="test_started">Test Started</option>
            <option value="test_submitted">Test Submitted</option>
          </select>

          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-xl py-1.5 px-3 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="">All Severities</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
          </select>
        </div>

        <div className="relative w-64">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search student or test..."
            className="w-full bg-slate-900 border border-slate-700 rounded-xl py-1.5 pl-9 pr-3 text-xs text-white focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Logs Table */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900 text-slate-400 font-semibold uppercase text-[10px] border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Severity</th>
                <th className="py-3 px-4">Event Description</th>
                <th className="py-3 px-4">Student</th>
                <th className="py-3 px-4">Test Title</th>
                <th className="py-3 px-4">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    No activity logs found.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  let sevClass = 'bg-slate-800 text-slate-300';
                  if (log.severity === 'critical') sevClass = 'bg-rose-950 text-rose-300 border border-rose-500/40';
                  else if (log.severity === 'warning') sevClass = 'bg-amber-950 text-amber-300 border border-amber-500/40';
                  else if (log.severity === 'info') sevClass = 'bg-indigo-950 text-indigo-300 border border-indigo-500/40';

                  return (
                    <tr key={log._id} className="hover:bg-slate-900/50 transition">
                      <td className="py-3 px-4 font-mono text-slate-400 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${sevClass}`}>
                          {log.severity}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-white capitalize">
                        {log.eventType.replace(/_/g, ' ')}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-200">{log.studentId?.name || 'N/A'}</span>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {log.studentId?.rollNumber}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-300 max-w-xs truncate">
                        {log.testId?.title || 'Unknown Test'}
                      </td>
                      <td className="py-3 px-4 text-[11px] text-slate-400 font-mono">
                        {log.details?.details || (log.details?.violationCount ? `Violation count: ${log.details.violationCount}` : JSON.stringify(log.details || ''))}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
