import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getTests } from '../services/testService';
import { getMyAttempts } from '../services/attemptService';
import {
  Clock,
  BookOpen,
  CheckCircle2,
  Calendar,
  ArrowRight,
  Code2,
  Award,
  Search,
  AlertCircle,
  FileText,
} from 'lucide-react';

export const StudentDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('available'); // 'available' | 'upcoming' | 'completed'
  const [tests, setTests] = useState([]);
  const [myAttempts, setMyAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [testsRes, attemptsRes] = await Promise.all([
          getTests(),
          getMyAttempts(),
        ]);

        if (testsRes.success) setTests(testsRes.tests || []);
        if (attemptsRes.success) setMyAttempts(attemptsRes.attempts || []);
      } catch (err) {
        console.error('Error fetching student dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const now = new Date();

  // Categorize tests
  const completedTestIds = new Set(
    myAttempts
      .filter((a) => ['submitted', 'timed_out', 'disqualified'].includes(a.status))
      .map((a) => a.testId?._id?.toString() || a.testId?.toString())
  );

  const availableTests = tests.filter((t) => {
    const start = new Date(t.startTime);
    const end = new Date(t.endTime);
    const isOngoing = now >= start && now <= end;
    const isCompleted = completedTestIds.has(t._id.toString());
    return isOngoing && !isCompleted;
  });

  const upcomingTests = tests.filter((t) => {
    const start = new Date(t.startTime);
    return now < start;
  });

  const completedAttemptsList = myAttempts.filter((a) =>
    ['submitted', 'timed_out', 'disqualified'].includes(a.status)
  );

  const filterTests = (list) => {
    if (!searchTerm) return list;
    return list.filter(
      (item) =>
        item.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.subject?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Welcome Banner */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-800 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-indigo-600/10 to-transparent pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-2">
              <Code2 className="w-3.5 h-3.5" />
              <span>Kairos Club Student Portal</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
              Welcome, {user?.name}!
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Roll No: <span className="text-slate-200 font-mono">{user?.rollNumber || 'N/A'}</span> &bull; {user?.department}
            </p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="flex-1 sm:flex-initial bg-slate-900 border border-slate-800 rounded-2xl p-3 px-5 text-center">
              <p className="text-xs text-slate-400 font-semibold uppercase">Tests Taken</p>
              <p className="text-xl font-bold text-indigo-400">{completedAttemptsList.length}</p>
            </div>
            <div className="flex-1 sm:flex-initial bg-slate-900 border border-slate-800 rounded-2xl p-3 px-5 text-center">
              <p className="text-xs text-slate-400 font-semibold uppercase">Available</p>
              <p className="text-xl font-bold text-emerald-400">{availableTests.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0">
          <button
            onClick={() => setActiveTab('available')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'available'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Available Assessments</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-950/60 font-mono">
              {availableTests.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('upcoming')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'upcoming'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Upcoming</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-950/60 font-mono">
              {upcomingTests.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('completed')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'completed'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Completed & Results</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-950/60 font-mono">
              {completedAttemptsList.length}
            </span>
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search tests..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Content Area */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
          <p className="text-sm text-slate-400 font-medium">Loading assessments...</p>
        </div>
      ) : (
        <div>
          {/* TAB 1: AVAILABLE TESTS */}
          {activeTab === 'available' && (
            <div>
              {filterTests(availableTests).length === 0 ? (
                <div className="text-center py-16 bg-slate-900/40 rounded-3xl border border-slate-800 p-6">
                  <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <h3 className="text-base font-semibold text-white">No active assessments right now</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    Check the Upcoming tab for scheduled tests, or check back later when an instructor publishes a new test.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filterTests(availableTests).map((test) => (
                    <div
                      key={test._id}
                      className="glass-card rounded-2xl border border-slate-800 hover:border-indigo-500/40 p-5 flex flex-col justify-between transition-all group hover:shadow-xl hover:shadow-indigo-950/30"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                            {test.testType}
                          </span>
                          <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span> Live Now
                          </span>
                        </div>

                        <h3 className="text-base font-bold text-white group-hover:text-indigo-300 transition line-clamp-2">
                          {test.title}
                        </h3>
                        <p className="text-xs text-slate-400 mt-1 font-medium">{test.subject}</p>

                        <p className="text-xs text-slate-400 mt-3 line-clamp-2 leading-relaxed">
                          {test.description || 'No description provided.'}
                        </p>

                        <div className="mt-4 pt-4 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-xs text-slate-300">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-indigo-400" />
                            <span>{test.duration} mins</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Award className="w-3.5 h-3.5 text-indigo-400" />
                            <span>{test.totalMarks} Marks</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-6">
                        <Link
                          to={`/tests/${test._id}/instructions`}
                          className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-semibold text-xs flex items-center justify-center gap-2 transition shadow-md shadow-indigo-600/20"
                        >
                          <span>Read Instructions & Start</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: UPCOMING TESTS */}
          {activeTab === 'upcoming' && (
            <div>
              {filterTests(upcomingTests).length === 0 ? (
                <div className="text-center py-16 bg-slate-900/40 rounded-3xl border border-slate-800 p-6">
                  <Calendar className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <h3 className="text-base font-semibold text-white">No upcoming assessments scheduled</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    New tests will appear here once announced by teachers or club administrators.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filterTests(upcomingTests).map((test) => (
                    <div
                      key={test._id}
                      className="glass-card rounded-2xl border border-slate-800 p-5 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700">
                            {test.testType}
                          </span>
                          <span className="text-xs text-amber-400 font-medium">Scheduled</span>
                        </div>

                        <h3 className="text-base font-bold text-white line-clamp-2">{test.title}</h3>
                        <p className="text-xs text-slate-400 mt-1">{test.subject}</p>

                        <div className="mt-4 p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-1">
                          <p className="text-slate-400">
                            Starts on: <strong className="text-slate-200">{new Date(test.startTime).toLocaleString()}</strong>
                          </p>
                          <p className="text-slate-400">
                            Duration: <strong className="text-slate-200">{test.duration} minutes</strong>
                          </p>
                        </div>
                      </div>

                      <div className="mt-6">
                        <button
                          disabled
                          className="w-full py-2.5 px-4 rounded-xl bg-slate-800 text-slate-500 font-semibold text-xs cursor-not-allowed"
                        >
                          Assessment Not Yet Active
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: COMPLETED ATTEMPTS & RESULTS */}
          {activeTab === 'completed' && (
            <div>
              {completedAttemptsList.length === 0 ? (
                <div className="text-center py-16 bg-slate-900/40 rounded-3xl border border-slate-800 p-6">
                  <CheckCircle2 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <h3 className="text-base font-semibold text-white">No completed assessments yet</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    Once you submit a test, your evaluation results, marks breakdown, and teacher feedback will be available here.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {completedAttemptsList.map((att) => {
                    const test = att.testId;
                    const isResultsReleased = test?.isResultsReleased;

                    return (
                      <div
                        key={att._id}
                        className="glass-card rounded-2xl border border-slate-800 p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                      >
                        <div>
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              Submitted
                            </span>
                            <span className="text-xs text-slate-400">
                              on {new Date(att.submittedAt || att.updatedAt).toLocaleString()}
                            </span>
                          </div>

                          <h3 className="text-base font-bold text-white">{test?.title || 'Examination'}</h3>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {test?.subject} &bull; Total Marks: {test?.totalMarks}
                          </p>
                        </div>

                        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                          <Link
                            to={`/results/${att._id}`}
                            className="w-full md:w-auto py-2.5 px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs flex items-center justify-center gap-2 transition border border-slate-700"
                          >
                            <span>{isResultsReleased ? 'View Detailed Scorecard' : 'View Submission Status'}</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
