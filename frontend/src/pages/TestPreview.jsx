import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getTestById, publishTest } from '../services/testService';
import { useToast } from '../context/ToastContext';
import {
  ArrowLeft,
  Clock,
  Award,
  FileQuestion,
  Code2,
  CheckCircle2,
  AlertCircle,
  Eye,
  Check,
} from 'lucide-react';

export const TestPreview = () => {
  const { id: testId } = useParams();
  const toast = useToast();
  const navigate = useNavigate();

  const [test, setTest] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTestById(testId)
      .then((res) => {
        if (res.success) setTest(res.test);
      })
      .catch((err) => toast.error('Failed to load test preview.'))
      .finally(() => setLoading(false));
  }, [testId]);

  const handlePublish = async () => {
    try {
      const res = await publishTest(testId);
      if (res.success) {
        toast.success(res.message);
        navigate('/teacher/dashboard');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Publishing failed.');
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center">
        <div className="w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mx-auto mb-3"></div>
        <p className="text-sm text-slate-400">Loading test preview...</p>
      </div>
    );
  }

  const qList = test?.questions || [];
  const canPublish = qList.length >= 5 && qList.length <= 20;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <Link
            to={`/tests/${testId}/questions`}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition mb-1"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Question Editor</span>
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white">{test?.title}</h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Preview Mode
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Subject: {test?.subject} &bull; Duration: {test?.duration} mins &bull; Format: {test?.testType?.toUpperCase()}
          </p>
        </div>

        {!test?.isPublished && (
          <button
            onClick={handlePublish}
            disabled={!canPublish}
            className={`py-2.5 px-5 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
              canPublish
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Publish Test ({qList.length}/20)</span>
          </button>
        )}
      </div>

      {/* Meta Specs Card */}
      <div className="glass-panel p-5 rounded-2xl border border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
        <div>
          <p className="text-[10px] uppercase font-bold text-slate-400">Questions</p>
          <p className="text-xl font-bold text-white mt-0.5">{qList.length}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase font-bold text-slate-400">Total Marks</p>
          <p className="text-xl font-bold text-indigo-400 mt-0.5">{test?.totalMarks || 0}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase font-bold text-slate-400">Negative Marks</p>
          <p className="text-xl font-bold text-amber-400 mt-0.5">{test?.hasNegativeMarking ? `Yes (-${test.negativeMarkValue})` : 'None'}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase font-bold text-slate-400">Navigation</p>
          <p className="text-xl font-bold text-cyan-400 mt-0.5 capitalize">{test?.navigationMode}</p>
        </div>
      </div>

      {/* Instructions Box */}
      <div className="glass-panel p-5 rounded-2xl border border-slate-800">
        <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 mb-2">Instructions</h3>
        <p className="text-xs text-slate-300 whitespace-pre-line leading-relaxed">{test?.instructions}</p>
      </div>

      {/* Questions Preview List */}
      <div className="space-y-6">
        {qList.map((q, idx) => (
          <div key={q._id} className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-xs font-bold text-indigo-400 font-mono">
                QUESTION #{idx + 1} &bull; {q.type.toUpperCase()}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                {q.marks} Marks
              </span>
            </div>

            <div>
              <h4 className="text-base font-bold text-white">{q.title}</h4>
              <p className="text-xs text-slate-300 mt-2 whitespace-pre-wrap leading-relaxed">{q.description}</p>
            </div>

            {/* MCQ Options Display */}
            {q.type === 'mcq' && q.mcqData?.options && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                {q.mcqData.options.map((opt, oIdx) => (
                  <div
                    key={opt.id || oIdx}
                    className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                      opt.isCorrect
                        ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
                        : 'bg-slate-900 border-slate-800 text-slate-300'
                    }`}
                  >
                    <span>{opt.text}</span>
                    {opt.isCorrect && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                        Correct Answer
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Coding Sample Test Cases Display */}
            {q.type === 'coding' && q.codingData && (
              <div className="space-y-3 pt-2">
                <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                  Public Sample Test Cases ({q.codingData.sampleTestCases?.length || 0})
                </p>
                {q.codingData.sampleTestCases?.map((tc, tcIdx) => (
                  <div key={tcIdx} className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs font-mono">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase">Input:</span>
                        <pre className="text-slate-300">{tc.input || '(empty)'}</pre>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase">Expected Output:</span>
                        <pre className="text-slate-300">{tc.expectedOutput}</pre>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
