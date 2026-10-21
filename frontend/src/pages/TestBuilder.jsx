import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { createTest, getTestById, updateTest } from '../services/testService';
import { getUsers } from '../services/adminService';
import {
  FileQuestion,
  Clock,
  Calendar,
  Settings,
  ShieldAlert,
  ArrowRight,
  ArrowLeft,
  Save,
  CheckCircle2,
} from 'lucide-react';

export const TestBuilder = () => {
  const { id } = useParams(); // If id exists, it's edit mode
  const isEditMode = Boolean(id);

  const { user, isAdmin } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(isEditMode);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    subject: '',
    instructions: '1. Fullscreen mode is mandatory.\n2. Switching tabs will trigger an integrity warning.\n3. Autosave is active throughout the test.\n4. Ensure steady internet connection.',
    duration: 45,
    startTime: new Date(Date.now() + 10 * 60 * 1000).toISOString().slice(0, 16),
    endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
    testType: 'mixed', // 'mcq' | 'coding' | 'mixed'
    maxAttempts: 1,
    navigationMode: 'free',
    hasNegativeMarking: false,
    negativeMarkValue: 1,
    randomizeQuestions: false,
    randomizeOptions: false,
    releaseResultsMode: 'manual',
    warningLimit: 3,
    actionOnLimit: 'flag_for_review', // 'warn_only' | 'flag_for_review' | 'auto_submit'
    assignedTeacher: '',
  });

  useEffect(() => {
    if (isAdmin) {
      getUsers({ role: 'teacher' }).then((res) => {
        if (res.success) setTeachers(res.users || []);
      });
    }

    if (isEditMode) {
      getTestById(id)
        .then((res) => {
          if (res.success && res.test) {
            const t = res.test;
            setFormData({
              title: t.title || '',
              description: t.description || '',
              subject: t.subject || '',
              instructions: t.instructions || '',
              duration: t.duration || 45,
              startTime: new Date(t.startTime).toISOString().slice(0, 16),
              endTime: new Date(t.endTime).toISOString().slice(0, 16),
              testType: t.testType || 'mixed',
              maxAttempts: t.maxAttempts || 1,
              navigationMode: t.navigationMode || 'free',
              hasNegativeMarking: Boolean(t.hasNegativeMarking),
              negativeMarkValue: t.negativeMarkValue || 1,
              randomizeQuestions: Boolean(t.randomizeQuestions),
              randomizeOptions: Boolean(t.randomizeOptions),
              releaseResultsMode: t.releaseResultsMode || 'manual',
              warningLimit: t.integrityPolicy?.warningLimit || 3,
              actionOnLimit: t.integrityPolicy?.actionOnLimit || 'flag_for_review',
              assignedTeacher: t.assignedTeacher?._id || '',
            });
          }
        })
        .finally(() => setLoading(false));
    }
  }, [id, isEditMode, isAdmin]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const payload = {
        title: formData.title,
        description: formData.description,
        subject: formData.subject,
        instructions: formData.instructions,
        duration: Number(formData.duration),
        startTime: new Date(formData.startTime),
        endTime: new Date(formData.endTime),
        testType: formData.testType,
        maxAttempts: Number(formData.maxAttempts),
        navigationMode: formData.navigationMode,
        hasNegativeMarking: formData.hasNegativeMarking,
        negativeMarkValue: formData.hasNegativeMarking ? Number(formData.negativeMarkValue) : 0,
        randomizeQuestions: formData.randomizeQuestions,
        randomizeOptions: formData.randomizeOptions,
        releaseResultsMode: formData.releaseResultsMode,
        integrityPolicy: {
          warningLimit: Number(formData.warningLimit),
          actionOnLimit: formData.actionOnLimit,
          requireFullscreen: true,
          detectTabSwitch: true,
        },
        assignedTeacher: formData.assignedTeacher || undefined,
      };

      if (isEditMode) {
        const res = await updateTest(id, payload);
        if (res.success) {
          toast.success('Test metadata updated successfully.');
          navigate(`/tests/${id}/questions`);
        }
      } else {
        const res = await createTest(payload);
        if (res.success) {
          toast.success('Test created! Now add between 5 and 20 questions.');
          navigate(`/tests/${res.test._id}/questions`);
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save test.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center">
        <div className="w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mx-auto mb-3"></div>
        <p className="text-sm text-slate-400">Loading test settings...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <Link
          to="/teacher/dashboard"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Tests</span>
        </Link>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
          Step 1: Test Configuration &bull; Step 2: Questions (5–20)
        </span>
      </div>

      <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-800 shadow-2xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">
            {isEditMode ? 'Edit Test Configuration' : 'Create New Assessment'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Configure test instructions, scheduling, negative marking, and browser anti-cheating deterrence.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Basic Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-indigo-400 border-b border-slate-800 pb-2 flex items-center gap-2">
              <FileQuestion className="w-4 h-4" />
              <span>General Assessment Details</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Test Title <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="e.g. Kairos Club DSA Assessment 2026"
                  required
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2 px-3.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Subject / Topic <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  placeholder="e.g. Data Structures & Algorithms"
                  required
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2 px-3.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Format / Type <span className="text-rose-400">*</span>
                </label>
                <select
                  name="testType"
                  value={formData.testType}
                  onChange={handleChange}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2 px-3.5 text-sm text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="mixed">Mixed (MCQs + Coding Challenges)</option>
                  <option value="coding">Coding Assessment Only</option>
                  <option value="mcq">MCQ Examination Only</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Brief Description
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={2}
                  placeholder="Brief summary displayed on student dashboard cards..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2 px-3.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                ></textarea>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Examination Instructions (Markdown supported)
                </label>
                <textarea
                  name="instructions"
                  value={formData.instructions}
                  onChange={handleChange}
                  rows={3}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2 px-3.5 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-indigo-500"
                ></textarea>
              </div>
            </div>
          </div>

          {/* Section 2: Timing & Schedule */}
          <div className="space-y-4 pt-4 border-t border-slate-800">
            <h3 className="text-sm font-bold uppercase tracking-wider text-indigo-400 border-b border-slate-800 pb-2 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>Timing & Duration</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-1">
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Duration (Minutes: 1 min to 1 hr) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="number"
                  name="duration"
                  value={formData.duration}
                  onChange={handleChange}
                  min={1}
                  max={60}
                  required
                  placeholder="1 - 60"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2 px-3.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
                {/* Preset Duration Buttons */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {[1, 5, 15, 30, 45, 60].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, duration: mins }))}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition ${
                        Number(formData.duration) === mins
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {mins === 60 ? '1 hr' : `${mins}m`}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Start Date & Time <span className="text-rose-400">*</span>
                </label>
                <input
                  type="datetime-local"
                  name="startTime"
                  value={formData.startTime}
                  onChange={handleChange}
                  required
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2 px-3.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  End Date & Time <span className="text-rose-400">*</span>
                </label>
                <input
                  type="datetime-local"
                  name="endTime"
                  value={formData.endTime}
                  onChange={handleChange}
                  required
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2 px-3.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Assessment Behavior & Integrity */}
          <div className="space-y-4 pt-4 border-t border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-sm font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4" />
                <span>Evaluation Rules & Integrity Policy</span>
              </h3>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                Immediate Kick-Out Active
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-rose-950/20 border border-rose-500/30 text-xs text-rose-200">
              <strong>Strict Zero Tolerance Policy Enforced:</strong> If a student commits any integrity violation (tab switch, window minimization, or exiting fullscreen), the test will immediately kick them out, disqualify the attempt, and record <strong>0 marks</strong>. When the duration timer expires, the test automatically submits.
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-900 border border-slate-800">
                <input
                  type="checkbox"
                  id="hasNegativeMarking"
                  name="hasNegativeMarking"
                  checked={formData.hasNegativeMarking}
                  onChange={handleChange}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-950 border-slate-700 cursor-pointer"
                />
                <label htmlFor="hasNegativeMarking" className="text-xs text-slate-300 cursor-pointer">
                  Enable Negative Marking for MCQs
                </label>
              </div>

              {formData.hasNegativeMarking && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Default Penalty per Incorrect Answer
                  </label>
                  <input
                    type="number"
                    step="0.25"
                    name="negativeMarkValue"
                    value={formData.negativeMarkValue}
                    onChange={handleChange}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2 px-3.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Question Navigation
                </label>
                <select
                  name="navigationMode"
                  value={formData.navigationMode}
                  onChange={handleChange}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2 px-3.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="free">Free Navigation (Navigate back and forth)</option>
                  <option value="linear">Linear (Cannot return to previous question)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Result Release Mode
                </label>
                <select
                  name="releaseResultsMode"
                  value={formData.releaseResultsMode}
                  onChange={handleChange}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2 px-3.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="manual">Manual Release (Instructor reviews first)</option>
                  <option value="immediate">Immediate (Score displayed upon submission)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Integrity Warning Limit
                </label>
                <input
                  type="number"
                  name="warningLimit"
                  value={formData.warningLimit}
                  onChange={handleChange}
                  min={1}
                  max={10}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2 px-3.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Action When Warning Limit Reached
                </label>
                <select
                  name="actionOnLimit"
                  value={formData.actionOnLimit}
                  onChange={handleChange}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2 px-3.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="flag_for_review">Flag attempt for manual instructor review</option>
                  <option value="auto_submit">Auto-submit test immediately</option>
                  <option value="warn_only">Warning display only</option>
                </select>
              </div>

              {isAdmin && teachers.length > 0 && (
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Assign Faculty / Teacher
                  </label>
                  <select
                    name="assignedTeacher"
                    value={formData.assignedTeacher}
                    onChange={handleChange}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2 px-3.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">Assign to Me (Admin)</option>
                    {teachers.map((t) => (
                      <option key={t._id} value={t._id}>
                        {t.name} ({t.email}) - {t.department}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          <div className="pt-6 border-t border-slate-800 flex items-center justify-end gap-3">
            <Link
              to="/teacher/dashboard"
              className="py-2.5 px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition"
            >
              Cancel
            </Link>

            <button
              type="submit"
              disabled={submitting}
              className="py-2.5 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isEditMode ? 'Save & Continue to Questions' : 'Create & Add Questions'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
