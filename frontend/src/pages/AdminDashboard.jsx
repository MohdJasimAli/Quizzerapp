import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getDashboardStats } from '../services/adminService';
import {
  Users,
  GraduationCap,
  FileQuestion,
  ShieldAlert,
  Plus,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  Clock,
  Sparkles,
} from 'lucide-react';

export const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [recentTests, setRecentTests] = useState([]);
  const [recentViolations, setRecentViolations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const data = await getDashboardStats();
        if (data.success) {
          setStats(data.stats);
          setRecentTests(data.recentTests || []);
          setRecentViolations(data.recentViolations || []);
        }
      } catch (err) {
        console.error('Failed to load admin stats:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
        <p className="text-sm text-slate-400">Loading system metrics...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Banner & Quick Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Admin Overview & Analytics
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Global monitoring, faculty assignments, test creation, and integrity auditing.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <Link
            to="/tests/create"
            className="flex-1 sm:flex-initial py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/25 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Create Test</span>
          </Link>
          <Link
            to="/admin/teachers"
            className="flex-1 sm:flex-initial py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center justify-center gap-1.5 border border-slate-700 transition"
          >
            <GraduationCap className="w-4 h-4 text-indigo-400" />
            <span>Manage Teachers</span>
          </Link>
          <Link
            to="/admin/students"
            className="flex-1 sm:flex-initial py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center justify-center gap-1.5 border border-slate-700 transition"
          >
            <Users className="w-4 h-4 text-cyan-400" />
            <span>Manage Students</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Students</p>
            <p className="text-2xl font-black text-white mt-0.5">{stats?.totalStudents || 0}</p>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Faculty / Teachers</p>
            <p className="text-2xl font-black text-white mt-0.5">{stats?.totalTeachers || 0}</p>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <FileQuestion className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Published Tests</p>
            <p className="text-2xl font-black text-white mt-0.5">
              {stats?.publishedTests || 0} <span className="text-xs font-normal text-slate-500">/ {stats?.totalTests || 0} total</span>
            </p>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-rose-500/20 bg-rose-950/10 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-rose-300">Integrity Flags</p>
            <p className="text-2xl font-black text-rose-300 mt-0.5">
              {stats?.flaggedAttempts || 0} <span className="text-xs font-normal text-rose-400/80">attempts</span>
            </p>
          </div>
        </div>
      </div>

      {/* Grid: Recent Tests & Integrity Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Tests Table */}
        <div className="glass-panel rounded-2xl border border-slate-800 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <FileQuestion className="w-4 h-4 text-indigo-400" />
                <span>Recent Assessments</span>
              </h2>
              <Link to="/teacher/dashboard" className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1">
                <span>View All</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="space-y-3">
              {recentTests.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">No tests created yet.</p>
              ) : (
                recentTests.map((test) => (
                  <div
                    key={test._id}
                    className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                            test.isPublished
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}
                        >
                          {test.status}
                        </span>
                        <span className="text-[11px] text-slate-400 uppercase font-mono">{test.testType}</span>
                      </div>
                      <h4 className="text-xs font-bold text-white line-clamp-1">{test.title}</h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {test.subject} &bull; {test.duration} mins &bull; {test.totalMarks} Marks
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Link
                        to={`/tests/${test._id}/preview`}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
                        title="Preview"
                      >
                        Preview
                      </Link>
                      <Link
                        to={`/tests/${test._id}/results`}
                        className="p-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 text-xs font-medium transition"
                        title="Results"
                      >
                        Results
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Real-time Integrity Violation Logs */}
        <div className="glass-panel rounded-2xl border border-slate-800 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                <span>Suspicious Activity Timeline</span>
              </h2>
              <Link to="/admin/activity-logs" className="text-xs text-rose-400 hover:text-rose-300 font-semibold flex items-center gap-1">
                <span>All Logs</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="space-y-2.5">
              {recentViolations.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  No integrity anomalies logged recently. All tests clean!
                </div>
              ) : (
                recentViolations.map((log) => (
                  <div
                    key={log._id}
                    className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-start justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-semibold text-slate-200">{log.studentId?.name || 'Student'}</span>
                        <span className="text-[10px] text-slate-500 font-mono">({log.studentId?.rollNumber || 'N/A'})</span>
                      </div>
                      <p className="text-rose-400 font-medium capitalize">
                        {log.eventType.replace(/_/g, ' ')}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                        Test: {log.testId?.title || 'Unknown Test'}
                      </p>
                    </div>

                    <div className="text-right text-[10px] text-slate-500 shrink-0 font-mono">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
