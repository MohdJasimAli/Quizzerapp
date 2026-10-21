import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  getAttemptResult,
  getTestResults,
  manualEvaluate,
  exportResultsCSV,
} from '../services/resultService';
import {
  Award,
  CheckCircle2,
  XCircle,
  FileText,
  Download,
  ArrowLeft,
  Users,
  Search,
  Edit,
  Clock,
  ShieldAlert,
  Save,
  X,
  Code2,
} from 'lucide-react';

export const ResultsPage = () => {
  const { attemptId, testId } = useParams();
  const { user, isAdmin, isTeacher, isStudent } = useAuth();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Manual Evaluation Modal State (for Teacher/Admin)
  const [evalModalOpen, setEvalModalOpen] = useState(false);
  const [activeResult, setActiveResult] = useState(null);
  const [selectedQId, setSelectedQId] = useState('');
  const [overrideMarks, setOverrideMarks] = useState(0);
  const [feedbackText, setFeedbackText] = useState('');
  const [isSavingEval, setIsSavingEval] = useState(false);

  const fetchResults = async () => {
    try {
      setLoading(true);
      if (testId) {
        // Teacher / Admin Test Submissions Table
        const res = await getTestResults(testId);
        if (res.success) setData(res);
      } else if (attemptId) {
        // Single Attempt Result View (Student or Teacher)
        const res = await getAttemptResult(attemptId);
        if (res.success) setData(res);
      }
    } catch (err) {
      toast.error('Failed to load assessment results.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();
  }, [attemptId, testId]);

  const handleExportCSV = async () => {
    try {
      await exportResultsCSV(testId, data?.test?.title || 'Assessment');
      toast.success('CSV Export downloaded successfully.');
    } catch (err) {
      toast.error('Failed to export CSV report.');
    }
  };

  const handleOpenManualEval = (resItem) => {
    setActiveResult(resItem);
    const firstQ = resItem.questionEvaluations?.[0];
    if (firstQ) {
      setSelectedQId(firstQ.questionId);
      setOverrideMarks(firstQ.marksAwarded);
      setFeedbackText(firstQ.teacherFeedback || '');
    }
    setEvalModalOpen(true);
  };

  const handleSaveEvaluation = async (e) => {
    e.preventDefault();
    if (!activeResult || !selectedQId) return;
    setIsSavingEval(true);

    try {
      const res = await manualEvaluate(activeResult._id, {
        questionId: selectedQId,
        manualMarks: Number(overrideMarks),
        feedback: feedbackText,
      });

      if (res.success) {
        toast.success('Marks and feedback updated successfully.');
        setEvalModalOpen(false);
        fetchResults();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update evaluation.');
    } finally {
      setIsSavingEval(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center">
        <div className="w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mx-auto mb-3"></div>
        <p className="text-sm text-slate-400">Loading results report...</p>
      </div>
    );
  }

  // VIEW 1: SINGLE ATTEMPT RESULT (Student or Individual Inspector)
  if (attemptId) {
    const isReleased = data?.isReleased;
    const result = data?.result;

    if (!isReleased) {
      return (
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <div className="glass-panel p-8 rounded-3xl border border-slate-800 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mx-auto">
              <Clock className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-white">Results Pending Publication</h2>
            <p className="text-sm text-slate-300 leading-relaxed max-w-md mx-auto">
              Your test has been received and evaluated on the server. The instructor has configured results for manual release. You will be able to review your score and detailed answers as soon as results are officially released.
            </p>
            <div className="pt-4">
              <Link
                to="/student/dashboard"
                className="py-2.5 px-6 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
              >
                Return to Dashboard
              </Link>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <Link
          to="/student/dashboard"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </Link>

        {/* Scorecard Hero */}
        <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-800 shadow-2xl relative overflow-hidden">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                  result.isDisqualified
                    ? 'bg-rose-500/30 text-rose-300 border border-rose-500/50'
                    : result.isPassed
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                }`}
              >
                {result.isDisqualified ? 'DISQUALIFIED (0 MARKS)' : result.isPassed ? 'PASSED ASSESSMENT' : 'NEEDS IMPROVEMENT'}
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-2">
                Official Examination Scorecard
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                Student: <strong className="text-slate-200">{result.studentId?.name || user?.name}</strong> &bull; Roll: {result.studentId?.rollNumber || user?.rollNumber}
              </p>
              {result.isDisqualified && (
                <div className="mt-3 p-2.5 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs">
                  <strong>Disqualified for Integrity Violation: </strong>
                  <span>{result.disqualificationReason || 'Leaving examination screen / tab switch'}</span>
                </div>
              )}
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 px-6 text-center w-full sm:w-auto">
              <p className="text-xs uppercase font-bold text-slate-400">Score Obtained</p>
              <p className="text-3xl font-black text-indigo-400 font-mono mt-1">
                {result.totalMarksObtained} <span className="text-sm font-normal text-slate-500">/ {result.maxMarks}</span>
              </p>
              <p className="text-xs text-emerald-400 font-bold mt-0.5">{result.percentage}%</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-6 pt-6 border-t border-slate-800/80 text-center">
            <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
              <p className="text-[10px] uppercase font-bold text-slate-400">MCQ Score</p>
              <p className="text-base font-bold text-slate-200 mt-0.5">{result.mcqScore} Marks</p>
            </div>
            <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
              <p className="text-[10px] uppercase font-bold text-slate-400">Coding Score</p>
              <p className="text-base font-bold text-slate-200 mt-0.5">{result.codingScore} Marks</p>
            </div>
            <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 col-span-2 sm:col-span-1">
              <p className="text-[10px] uppercase font-bold text-slate-400">Evaluated On</p>
              <p className="text-xs font-bold text-slate-300 mt-1 font-mono">
                {new Date(result.evaluatedAt || result.updatedAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>

        {/* Question-Wise Breakdown */}
        <div className="space-y-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-400" />
            <span>Question-wise Performance Breakdown</span>
          </h2>

          {result.questionEvaluations?.map((qe, idx) => (
            <div
              key={qe.questionId || idx}
              className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-3"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-indigo-600/30 text-indigo-300 font-bold text-xs flex items-center justify-center font-mono">
                    {idx + 1}
                  </span>
                  <span className="text-xs font-bold text-white">{qe.questionTitle}</span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-slate-800 text-slate-300">
                    {qe.questionType}
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-xs font-bold font-mono text-indigo-400">
                    {qe.marksAwarded} / {qe.allocatedMarks} Marks
                  </span>
                </div>
              </div>

              {qe.questionType === 'mcq' && (
                <div className="text-xs space-y-1">
                  <p className="text-slate-400">
                    Your Selection: <strong className="text-slate-200">{qe.mcqSelectedOption || '(unanswered)'}</strong>
                  </p>
                  <p className="text-slate-400">
                    Correct Option: <strong className="text-emerald-400">{qe.mcqCorrectOption}</strong>
                  </p>
                  <span
                    className={`inline-block text-[10px] font-bold uppercase px-2 py-0.5 rounded-full mt-1 ${
                      qe.mcqIsCorrect
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-rose-500/20 text-rose-300'
                    }`}
                  >
                    {qe.mcqIsCorrect ? 'Correct' : 'Incorrect'}
                  </span>
                </div>
              )}

              {qe.questionType === 'coding' && (
                <div className="text-xs space-y-2">
                  <div className="flex items-center gap-4 text-slate-400">
                    <span>Language: <strong className="text-slate-200 uppercase">{qe.codingLanguage}</strong></span>
                    <span>
                      Passed Test Cases: <strong className="text-emerald-400 font-mono">{qe.testCasesPassed} / {qe.testCasesTotal}</strong>
                    </span>
                  </div>

                  {qe.codingCode && (
                    <div className="mt-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Your Submitted Code:</p>
                      <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 font-mono text-xs overflow-x-auto max-h-48">
                        {qe.codingCode}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              {qe.teacherFeedback && (
                <div className="p-3 rounded-xl bg-indigo-950/30 border border-indigo-500/20 text-xs text-indigo-200">
                  <strong className="text-indigo-300 font-semibold">Teacher Feedback: </strong>
                  {qe.teacherFeedback}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // VIEW 2: TEACHER / ADMIN TEST SUBMISSIONS TABLE
  const testInfo = data?.test;
  const stats = data?.stats;
  const resultsList = data?.results || [];

  const filteredResults = resultsList.filter((r) => {
    const student = r.studentId;
    return (
      student?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student?.rollNumber?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <Link
            to="/teacher/dashboard"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition mb-1"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </Link>
          <h1 className="text-2xl font-bold text-white">{testInfo?.title} &mdash; Results</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Subject: {testInfo?.subject} &bull; Total Marks: {testInfo?.totalMarks}
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/25 transition"
        >
          <Download className="w-4 h-4" />
          <span>Export Results (CSV)</span>
        </button>
      </div>

      {/* Analytics KPI Ribbon */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-4 rounded-2xl border border-slate-800 text-center">
          <p className="text-[10px] uppercase font-bold text-slate-400">Total Submissions</p>
          <p className="text-2xl font-bold text-white mt-0.5">{stats?.totalSubmissions || 0}</p>
        </div>
        <div className="glass-panel p-4 rounded-2xl border border-slate-800 text-center">
          <p className="text-[10px] uppercase font-bold text-slate-400">Average Score</p>
          <p className="text-2xl font-bold text-indigo-400 mt-0.5">{stats?.avgScore || 0}</p>
        </div>
        <div className="glass-panel p-4 rounded-2xl border border-slate-800 text-center">
          <p className="text-[10px] uppercase font-bold text-slate-400">Pass Percentage</p>
          <p className="text-2xl font-bold text-emerald-400 mt-0.5">{stats?.passPercentage || 0}%</p>
        </div>
        <div className="glass-panel p-4 rounded-2xl border border-slate-800 text-center">
          <p className="text-[10px] uppercase font-bold text-slate-400">Highest Score</p>
          <p className="text-2xl font-bold text-cyan-400 mt-0.5">{stats?.highestScore || 0}</p>
        </div>
      </div>

      {/* Submissions Table with Search */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between gap-4">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-400" />
            <span>Participant Submissions ({filteredResults.length})</span>
          </h2>

          <div className="relative w-64">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search student or roll..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl py-1.5 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900 text-slate-400 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Student</th>
                <th className="py-3 px-4">Roll Number</th>
                <th className="py-3 px-4">MCQ</th>
                <th className="py-3 px-4">Coding</th>
                <th className="py-3 px-4">Total</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Violations</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredResults.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    No submissions matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredResults.map((r) => (
                  <tr key={r._id} className="hover:bg-slate-900/50 transition">
                    <td className="py-3 px-4 font-semibold text-white">
                      {r.studentId?.name || 'Student'}
                      <div className="text-[11px] text-slate-500 font-normal">{r.studentId?.email}</div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-300">
                      {r.studentId?.rollNumber || 'N/A'}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-300">{r.mcqScore}</td>
                    <td className="py-3 px-4 font-mono text-slate-300">{r.codingScore}</td>
                    <td className="py-3 px-4 font-mono font-bold text-indigo-400">
                      {r.totalMarksObtained} <span className="text-[10px] text-slate-500">({r.percentage}%)</span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          r.isDisqualified || r.attemptId?.status === 'disqualified'
                            ? 'bg-rose-950/80 text-rose-300 border border-rose-500/50'
                            : r.isPassed
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-rose-500/20 text-rose-300'
                        }`}
                      >
                        {r.isDisqualified || r.attemptId?.status === 'disqualified' ? 'Disqualified (0)' : r.isPassed ? 'Passed' : 'Failed'}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono">
                      {r.attemptId?.violationCount > 0 ? (
                        <span className="text-amber-400 font-bold flex items-center gap-1">
                          <ShieldAlert className="w-3.5 h-3.5" />
                          <span>{r.attemptId.violationCount}</span>
                        </span>
                      ) : (
                        <span className="text-slate-500">0</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <button
                        onClick={() => handleOpenManualEval(r)}
                        className="py-1 px-2.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 text-[11px] font-semibold transition"
                      >
                        Evaluate
                      </button>
                      <Link
                        to={`/results/${r.attemptId?._id || r.attemptId}`}
                        className="py-1 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold transition"
                      >
                        Inspect
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Evaluation Modal */}
      {evalModalOpen && activeResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">Manual Score Evaluation</h3>
              <button onClick={() => setEvalModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Evaluating student: <strong className="text-white">{activeResult.studentId?.name}</strong>
            </p>

            <form onSubmit={handleSaveEvaluation} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Select Question to Grade
                </label>
                <select
                  value={selectedQId}
                  onChange={(e) => {
                    const qId = e.target.value;
                    setSelectedQId(qId);
                    const qEval = activeResult.questionEvaluations?.find((qe) => qe.questionId === qId);
                    if (qEval) {
                      setOverrideMarks(qEval.marksAwarded);
                      setFeedbackText(qEval.teacherFeedback || '');
                    }
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 px-3 text-xs text-white"
                >
                  {activeResult.questionEvaluations?.map((qe, idx) => (
                    <option key={qe.questionId} value={qe.questionId}>
                      Q{idx + 1}: {qe.questionTitle} (Max: {qe.allocatedMarks})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Awarded Marks
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={overrideMarks}
                  onChange={(e) => setOverrideMarks(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 px-3 text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Instructor Feedback & Guidance
                </label>
                <textarea
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  rows={3}
                  placeholder="Provide personalized advice, code comments, or grading notes..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 px-3 text-xs text-white"
                ></textarea>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEvalModalOpen(false)}
                  className="py-2 px-4 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEval}
                  className="py-2 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>Update Marks</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
