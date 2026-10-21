import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  getTests,
  publishTest,
  unpublishTest,
  deleteTest,
  toggleReleaseResults,
} from '../services/testService';
import {
  Plus,
  FileQuestion,
  Clock,
  Award,
  Users,
  Eye,
  Edit,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Share2,
  Search,
  Filter,
} from 'lucide-react';

export const TeacherDashboard = () => {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchTests = async () => {
    try {
      setLoading(true);
      const data = await getTests();
      if (data.success) {
        setTests(data.tests || []);
      }
    } catch (err) {
      toast.error('Failed to load tests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTests();
  }, []);

  const handlePublish = async (testId, currentCount) => {
    if (currentCount < 5) {
      toast.error(`Cannot publish: Test has only ${currentCount} questions. Minimum 5 questions required.`);
      return;
    }
    if (currentCount > 20) {
      toast.error(`Cannot publish: Test has ${currentCount} questions. Maximum 20 questions allowed.`);
      return;
    }

    try {
      const data = await publishTest(testId);
      if (data.success) {
        toast.success(data.message || 'Test published successfully!');
        fetchTests();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to publish test.');
    }
  };

  const handleUnpublish = async (testId) => {
    if (!window.confirm('Revert test to draft mode? Students will no longer see it.')) return;
    try {
      const data = await unpublishTest(testId);
      if (data.success) {
        toast.info('Test reverted to draft mode.');
        fetchTests();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to unpublish test.');
    }
  };

  const handleDelete = async (testId) => {
    if (!window.confirm('Are you sure you want to delete this test and all its questions? This cannot be undone.')) return;
    try {
      const data = await deleteTest(testId);
      if (data.success) {
        toast.success('Test deleted successfully.');
        fetchTests();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete test.');
    }
  };

  const handleToggleRelease = async (testId, currentReleaseState) => {
    try {
      const data = await toggleReleaseResults(testId, !currentReleaseState);
      if (data.success) {
        toast.success(data.message);
        fetchTests();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update results status.');
    }
  };

  const filteredTests = tests.filter((t) => {
    const matchesStatus = filterStatus === 'all' || (filterStatus === 'published' ? t.isPublished : !t.isPublished);
    const matchesSearch =
      t.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.subject?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header & Quick Action */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
            Teacher & Test Management
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Build tests, assign individual marks, manage 5–20 question validation, evaluate coding tasks, and release results.
          </p>
        </div>

        <Link
          to="/tests/create"
          className="w-full sm:w-auto py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/25 transition"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Test</span>
        </Link>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              filterStatus === 'all' ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'
            }`}
          >
            All Tests ({tests.length})
          </button>
          <button
            onClick={() => setFilterStatus('published')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              filterStatus === 'published' ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'
            }`}
          >
            Published ({tests.filter((t) => t.isPublished).length})
          </button>
          <button
            onClick={() => setFilterStatus('draft')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              filterStatus === 'draft' ? 'bg-amber-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'
            }`}
          >
            Drafts ({tests.filter((t) => !t.isPublished).length})
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search assigned tests..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Tests Grid */}
      {loading ? (
        <div className="py-20 text-center">
          <div className="w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm text-slate-400">Loading tests...</p>
        </div>
      ) : filteredTests.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/40 rounded-3xl border border-slate-800 p-6">
          <FileQuestion className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-white">No tests found</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Click "Create New Test" above to build your first examination.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTests.map((test) => {
            const qCount = test.questions ? test.questions.length : 0;
            const canPublish = qCount >= 5 && qCount <= 20;

            return (
              <div
                key={test._id}
                className="glass-card rounded-2xl border border-slate-800 p-5 flex flex-col justify-between hover:border-slate-700 transition"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        test.isPublished
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      {test.isPublished ? 'Published' : 'Draft'}
                    </span>

                    <span className="text-[11px] font-mono text-slate-400 uppercase">
                      {test.testType}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-white line-clamp-1">{test.title}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{test.subject}</p>

                  {/* Question Count & Validation Status Notice */}
                  <div className="mt-3 p-2.5 rounded-xl bg-slate-900 border border-slate-800/80 text-xs flex items-center justify-between">
                    <div>
                      <span className="text-slate-400">Questions: </span>
                      <strong className={`font-mono ${canPublish ? 'text-indigo-400' : 'text-amber-400'}`}>
                        {qCount} / 20
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400">Max Marks: </span>
                      <strong className="text-slate-200 font-mono">{test.totalMarks || 0}</strong>
                    </div>
                  </div>

                  {!canPublish && (
                    <p className="text-[11px] text-amber-400/90 mt-2 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>Requires 5 to 20 questions to publish (currently {qCount}).</span>
                    </p>
                  )}
                </div>

                <div className="mt-5 pt-4 border-t border-slate-800 space-y-2">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <Link
                      to={`/tests/${test._id}/questions`}
                      className="py-2 px-3 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 font-semibold flex items-center justify-center gap-1.5 transition"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>Edit Questions</span>
                    </Link>

                    <Link
                      to={`/tests/${test._id}/preview`}
                      className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold flex items-center justify-center gap-1.5 transition"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Preview</span>
                    </Link>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <Link
                      to={`/tests/${test._id}/results`}
                      className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold flex items-center justify-center gap-1.5 transition"
                    >
                      <Users className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Submissions</span>
                    </Link>

                    {test.isPublished ? (
                      <button
                        onClick={() => handleUnpublish(test._id)}
                        className="py-2 px-3 rounded-xl bg-amber-950/40 hover:bg-amber-950/60 border border-amber-500/30 text-amber-300 font-semibold flex items-center justify-center transition"
                      >
                        Revert to Draft
                      </button>
                    ) : (
                      <button
                        onClick={() => handlePublish(test._id, qCount)}
                        className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center justify-center gap-1.5 transition shadow-sm shadow-emerald-600/30"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Publish Test</span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 text-[11px] text-slate-400">
                    <button
                      onClick={() => handleToggleRelease(test._id, test.isResultsReleased)}
                      className={`hover:underline flex items-center gap-1 ${
                        test.isResultsReleased ? 'text-cyan-400 font-semibold' : 'text-slate-400'
                      }`}
                    >
                      <Share2 className="w-3 h-3" />
                      <span>{test.isResultsReleased ? 'Results Released' : 'Release Results'}</span>
                    </button>

                    <button
                      onClick={() => handleDelete(test._id)}
                      className="text-rose-400 hover:text-rose-300 flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
