import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { getTestById, publishTest } from '../services/testService';
import {
  getQuestions,
  addQuestion,
  updateQuestion,
  deleteQuestion,
} from '../services/questionService';
import {
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  FileQuestion,
  Code2,
  Award,
  ArrowLeft,
  Eye,
  Check,
  Save,
  X,
  Sparkles,
} from 'lucide-react';

export const QuestionEditor = () => {
  const { id: testId } = useParams();
  const toast = useToast();
  const navigate = useNavigate();

  const [test, setTest] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [questionType, setQuestionType] = useState('mcq'); // 'mcq' | 'coding'

  // Form State for Question
  const [qTitle, setQTitle] = useState('');
  const [qDescription, setQDescription] = useState('');
  const [qMarks, setQMarks] = useState(5);
  const [qDifficulty, setQDifficulty] = useState('medium');
  const [qExplanation, setQExplanation] = useState('');

  // MCQ Options State
  const [mcqOptions, setMcqOptions] = useState([
    { id: 'opt_1', text: '', isCorrect: true },
    { id: 'opt_2', text: '', isCorrect: false },
    { id: 'opt_3', text: '', isCorrect: false },
    { id: 'opt_4', text: '', isCorrect: false },
  ]);
  const [mcqNegativeMarks, setMcqNegativeMarks] = useState(1);

  // Coding Specific State
  const [sampleCases, setSampleCases] = useState([
    { input: '', expectedOutput: '', explanation: '' },
  ]);
  const [hiddenCases, setHiddenCases] = useState([
    { input: '', expectedOutput: '', marksWeight: 1 },
  ]);
  const [starterPython, setStarterPython] = useState('# Write your solution here\nimport sys\n\ndef solution():\n    pass\n\nif __name__ == "__main__":\n    solution()\n');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [testRes, qRes] = await Promise.all([
        getTestById(testId),
        getQuestions(testId),
      ]);
      if (testRes.success) setTest(testRes.test);
      if (qRes.success) setQuestions(qRes.questions || []);
    } catch (err) {
      toast.error('Failed to load questions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [testId]);

  const questionCount = questions.length;
  const canPublish = questionCount >= 5 && questionCount <= 20;
  const totalMarks = questions.reduce((sum, q) => sum + (q.marks || 0), 0);

  const resetForm = () => {
    setEditingQuestion(null);
    setQTitle('');
    setQDescription('');
    setQMarks(5);
    setQDifficulty('medium');
    setQExplanation('');
    setMcqOptions([
      { id: 'opt_1', text: '', isCorrect: true },
      { id: 'opt_2', text: '', isCorrect: false },
      { id: 'opt_3', text: '', isCorrect: false },
      { id: 'opt_4', text: '', isCorrect: false },
    ]);
    setSampleCases([{ input: '', expectedOutput: '', explanation: '' }]);
    setHiddenCases([{ input: '', expectedOutput: '', marksWeight: 1 }]);
    setStarterPython('# Write your solution here\nimport sys\n\ndef solution():\n    pass\n\nif __name__ == "__main__":\n    solution()\n');
  };

  const handleOpenAdd = (type) => {
    if (questionCount >= 20) {
      toast.error('Maximum limit of 20 questions reached for this test.');
      return;
    }
    resetForm();
    setQuestionType(type);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (q) => {
    setEditingQuestion(q);
    setQuestionType(q.type);
    setQTitle(q.title || '');
    setQDescription(q.description || '');
    setQMarks(q.marks || 5);
    setQDifficulty(q.difficulty || 'medium');
    setQExplanation(q.explanation || '');

    if (q.type === 'mcq') {
      setMcqOptions(q.mcqData?.options || []);
      setMcqNegativeMarks(q.mcqData?.negativeMarks || 0);
    } else if (q.type === 'coding') {
      setSampleCases(q.codingData?.sampleTestCases || []);
      setHiddenCases(q.codingData?.hiddenTestCases || []);
      setStarterPython(q.codingData?.starterCode?.python || '');
    }
    setIsModalOpen(true);
  };

  const handleSaveQuestion = async (e) => {
    e.preventDefault();

    if (!qTitle || !qDescription) {
      toast.error('Question title and description are required.');
      return;
    }

    if (questionType === 'mcq') {
      if (mcqOptions.some((opt) => !opt.text.trim())) {
        toast.error('All MCQ options must contain text.');
        return;
      }
      if (!mcqOptions.some((opt) => opt.isCorrect)) {
        toast.error('Please select one correct answer option.');
        return;
      }
    } else if (questionType === 'coding') {
      if (sampleCases.length === 0 || !sampleCases[0].expectedOutput.trim()) {
        toast.error('Coding questions require at least one sample test case with expected output.');
        return;
      }
    }

    const payload = {
      type: questionType,
      title: qTitle,
      description: qDescription,
      marks: Number(qMarks),
      difficulty: qDifficulty,
      explanation: qExplanation,
      order: editingQuestion ? editingQuestion.order : questionCount + 1,
    };

    if (questionType === 'mcq') {
      payload.mcqData = {
        options: mcqOptions,
        negativeMarks: Number(mcqNegativeMarks),
      };
    } else if (questionType === 'coding') {
      payload.codingData = {
        allowedLanguages: ['python', 'java', 'c', 'cpp'],
        starterCode: {
          python: starterPython,
          java: 'import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        // Your code here\n    }\n}\n',
          c: '#include <stdio.h>\n\nint main() {\n    // Your code here\n    return 0;\n}\n',
          cpp: '#include <iostream>\nusing namespace std;\n\nint main() {\n    // Your code here\n    return 0;\n}\n',
        },
        sampleTestCases: sampleCases,
        hiddenTestCases: hiddenCases,
        timeLimit: 2,
        memoryLimit: 256,
      };
    }

    try {
      if (editingQuestion) {
        const res = await updateQuestion(testId, editingQuestion._id, payload);
        if (res.success) {
          toast.success('Question updated successfully.');
        }
      } else {
        const res = await addQuestion(testId, payload);
        if (res.success) {
          toast.success('Question added successfully.');
        }
      }
      setIsModalOpen(false);
      resetForm();
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save question.');
    }
  };

  const handleDelete = async (qId) => {
    if (!window.confirm('Delete this question? Marks will be automatically recalculated.')) return;
    try {
      const res = await deleteQuestion(testId, qId);
      if (res.success) {
        toast.success('Question removed.');
        fetchData();
      }
    } catch (err) {
      toast.error('Failed to delete question.');
    }
  };

  const handlePublishTest = async () => {
    if (!canPublish) {
      toast.error(`Cannot publish: Test must have between 5 and 20 questions (currently ${questionCount}).`);
      return;
    }
    try {
      const res = await publishTest(testId);
      if (res.success) {
        toast.success(res.message);
        fetchData();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Publishing failed.');
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center">
        <div className="w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mx-auto mb-3"></div>
        <p className="text-sm text-slate-400">Loading question manager...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Top Breadcrumb & Status */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <Link
            to="/teacher/dashboard"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition mb-1"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </Link>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <span>{test?.title}</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                test?.isPublished
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              }`}
            >
              {test?.isPublished ? 'Published' : 'Draft'}
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Subject: {test?.subject} &bull; Duration: {test?.duration} mins
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Link
            to={`/tests/${testId}/preview`}
            className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition border border-slate-700"
          >
            <Eye className="w-4 h-4" />
            <span>Preview Test</span>
          </Link>

          {!test?.isPublished && (
            <button
              onClick={handlePublishTest}
              disabled={!canPublish}
              className={`py-2 px-4 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                canPublish
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 cursor-pointer'
                  : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-75'
              }`}
              title={
                canPublish
                  ? 'Publish test for students'
                  : `Need between 5 and 20 questions to publish (currently ${questionCount})`
              }
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Publish Test</span>
            </button>
          )}
        </div>
      </div>

      {/* 5-20 Questions Validation & Auto Calculated Max Marks Banner */}
      <div className="glass-panel p-5 rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Question Requirement (5 to 20):
            </span>
            <span
              className={`text-sm font-bold font-mono px-2 py-0.5 rounded-lg ${
                canPublish
                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40'
                  : 'bg-amber-950 text-amber-400 border border-amber-500/40'
              }`}
            >
              {questionCount} of 20 Questions
            </span>
          </div>

          <div className="w-full sm:w-64 bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
            <div
              className={`h-full transition-all duration-300 ${
                questionCount < 5 ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(100, (questionCount / 20) * 100)}%` }}
            ></div>
          </div>

          <p className="text-[11px] text-slate-400">
            {questionCount < 5
              ? `Add ${5 - questionCount} more question(s) to meet the minimum publishing requirement.`
              : questionCount > 20
              ? `Remove ${questionCount - 20} question(s) to meet the maximum limit.`
              : 'Validation met! Test can be published.'}
          </p>
        </div>

        {/* Auto Calculated Maximum Marks */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 px-5 text-right w-full sm:w-auto">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            Total Max Test Score
          </span>
          <p className="text-2xl font-black text-indigo-400 font-mono">
            {totalMarks} <span className="text-xs text-slate-400 font-normal">Marks</span>
          </p>
          <span className="text-[10px] text-slate-500">Sum of individual question marks</span>
        </div>
      </div>

      {/* Add Question Action Buttons */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <FileQuestion className="w-4 h-4 text-indigo-400" />
          <span>Question List ({questionCount})</span>
        </h2>

        <div className="flex items-center gap-2">
          {(test?.testType === 'mixed' || test?.testType === 'mcq') && (
            <button
              onClick={() => handleOpenAdd('mcq')}
              disabled={questionCount >= 20}
              className="py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-1.5 transition disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>Add MCQ Question</span>
            </button>
          )}

          {(test?.testType === 'mixed' || test?.testType === 'coding') && (
            <button
              onClick={() => handleOpenAdd('coding')}
              disabled={questionCount >= 20}
              className="py-2 px-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs flex items-center gap-1.5 transition disabled:opacity-50"
            >
              <Code2 className="w-4 h-4" />
              <span>Add Coding Problem</span>
            </button>
          )}
        </div>
      </div>

      {/* Question Cards List */}
      {questions.length === 0 ? (
        <div className="py-16 text-center bg-slate-900/30 rounded-3xl border border-slate-800 p-6">
          <FileQuestion className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-white">No questions added yet</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto mb-4">
            Add at least 5 questions using the buttons above to enable publishing.
          </p>
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => handleOpenAdd('mcq')}
              className="py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
            >
              + Add First MCQ
            </button>
            <button
              onClick={() => handleOpenAdd('coding')}
              className="py-2 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold"
            >
              + Add First Coding Question
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {questions.map((q, idx) => (
            <div
              key={q._id}
              className="glass-card rounded-2xl border border-slate-800 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
            >
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="w-6 h-6 rounded-lg bg-indigo-600/30 text-indigo-300 font-bold text-xs flex items-center justify-center font-mono">
                    {idx + 1}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-800 text-slate-300 border border-slate-700">
                    {q.type}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                    {q.marks} Marks
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize bg-slate-900 text-slate-400">
                    {q.difficulty}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-white">{q.title}</h3>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">{q.description}</p>

                {q.type === 'mcq' && q.mcqData?.options && (
                  <div className="mt-2 text-[11px] text-slate-400 flex items-center gap-3">
                    <span>{q.mcqData.options.length} Options</span>
                    {q.mcqData.negativeMarks > 0 && (
                      <span className="text-rose-400">-{q.mcqData.negativeMarks} Negative Mark</span>
                    )}
                  </div>
                )}

                {q.type === 'coding' && q.codingData && (
                  <div className="mt-2 text-[11px] text-slate-400 flex items-center gap-3">
                    <span>{q.codingData.sampleTestCases?.length || 0} Sample Cases</span>
                    <span>{q.codingData.hiddenTestCases?.length || 0} Hidden Cases</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
                <button
                  onClick={() => handleOpenEdit(q)}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                  title="Edit Question & Marks"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(q._id)}
                  className="p-2 rounded-xl bg-rose-950/30 hover:bg-rose-950/50 text-rose-400 transition"
                  title="Delete Question"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Question Modal (Add / Edit) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 sm:p-8 my-8 shadow-2xl relative">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-bold text-white mb-1">
              {editingQuestion ? 'Edit Question' : `Add ${questionType.toUpperCase()} Question`}
            </h3>
            <p className="text-xs text-slate-400 mb-6">
              Configure question statement, assign individual marks, and set evaluation rules.
            </p>

            <form onSubmit={handleSaveQuestion} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Question Title / Headline <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={qTitle}
                  onChange={(e) => setQTitle(e.target.value)}
                  placeholder="e.g. Binary Search Tree In-order Traversal"
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 px-3.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Question Description & Instructions (Markdown supported) <span className="text-rose-400">*</span>
                </label>
                <textarea
                  value={qDescription}
                  onChange={(e) => setQDescription(e.target.value)}
                  rows={4}
                  required
                  placeholder="Detailed problem statement, constraints, or question text..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 px-3.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                ></textarea>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Question Marks <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    value={qMarks}
                    onChange={(e) => setQMarks(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 px-3.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                  <span className="text-[10px] text-slate-500">Independent marks for this question</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Difficulty Level
                  </label>
                  <select
                    value={qDifficulty}
                    onChange={(e) => setQDifficulty(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 px-3.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
              </div>

              {/* MCQ Options Field */}
              {questionType === 'mcq' && (
                <div className="space-y-3 pt-3 border-t border-slate-800">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                      Answer Options (Select the correct choice)
                    </label>
                    {mcqOptions.length < 6 && (
                      <button
                        type="button"
                        onClick={() =>
                          setMcqOptions([
                            ...mcqOptions,
                            { id: `opt_${Date.now()}`, text: '', isCorrect: false },
                          ])
                        }
                        className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
                      >
                        + Add Option
                      </button>
                    )}
                  </div>

                  {mcqOptions.map((opt, oIdx) => (
                    <div key={opt.id || oIdx} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="correctOpt"
                        checked={opt.isCorrect}
                        onChange={() => {
                          setMcqOptions(
                            mcqOptions.map((item, idx) => ({
                              ...item,
                              isCorrect: idx === oIdx,
                            }))
                          );
                        }}
                        className="w-4 h-4 text-emerald-500 bg-slate-950 border-slate-700 focus:ring-emerald-500 cursor-pointer"
                        title="Mark as correct answer"
                      />
                      <input
                        type="text"
                        value={opt.text}
                        onChange={(e) => {
                          const updated = [...mcqOptions];
                          updated[oIdx].text = e.target.value;
                          setMcqOptions(updated);
                        }}
                        placeholder={`Option ${oIdx + 1}`}
                        required
                        className="flex-1 bg-slate-950 border border-slate-700 rounded-xl py-1.5 px-3 text-xs text-white focus:outline-none focus:border-indigo-500"
                      />
                      {mcqOptions.length > 2 && (
                        <button
                          type="button"
                          onClick={() => setMcqOptions(mcqOptions.filter((_, idx) => idx !== oIdx))}
                          className="text-slate-500 hover:text-rose-400 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}

                  <div className="pt-2">
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Negative Penalty (Marks deducted if wrong)
                    </label>
                    <input
                      type="number"
                      step="0.25"
                      min="0"
                      value={mcqNegativeMarks}
                      onChange={(e) => setMcqNegativeMarks(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 px-3.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              )}

              {/* Coding Test Cases Fields */}
              {questionType === 'coding' && (
                <div className="space-y-4 pt-3 border-t border-slate-800">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                      Sample Test Cases (Visible to Students)
                    </label>
                    {sampleCases.map((sc, scIdx) => (
                      <div key={scIdx} className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-[10px] text-slate-400 font-mono">Input:</span>
                            <textarea
                              value={sc.input}
                              onChange={(e) => {
                                const copy = [...sampleCases];
                                copy[scIdx].input = e.target.value;
                                setSampleCases(copy);
                              }}
                              rows={2}
                              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs font-mono text-white focus:outline-none"
                            ></textarea>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 font-mono">Expected Output:</span>
                            <textarea
                              value={sc.expectedOutput}
                              onChange={(e) => {
                                const copy = [...sampleCases];
                                copy[scIdx].expectedOutput = e.target.value;
                                setSampleCases(copy);
                              }}
                              rows={2}
                              required
                              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs font-mono text-white focus:outline-none"
                            ></textarea>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                      Hidden Test Cases (Private - Used for Server Scoring)
                    </label>
                    {hiddenCases.map((hc, hcIdx) => (
                      <div key={hcIdx} className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-[10px] text-slate-400 font-mono">Hidden Input:</span>
                            <textarea
                              value={hc.input}
                              onChange={(e) => {
                                const copy = [...hiddenCases];
                                copy[hcIdx].input = e.target.value;
                                setHiddenCases(copy);
                              }}
                              rows={2}
                              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs font-mono text-white focus:outline-none"
                            ></textarea>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 font-mono">Hidden Expected Output:</span>
                            <textarea
                              value={hc.expectedOutput}
                              onChange={(e) => {
                                const copy = [...hiddenCases];
                                copy[hcIdx].expectedOutput = e.target.value;
                                setHiddenCases(copy);
                              }}
                              rows={2}
                              required
                              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs font-mono text-white focus:outline-none"
                            ></textarea>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Optional Teacher Explanation / Feedback (Shown after results released)
                </label>
                <textarea
                  value={qExplanation}
                  onChange={(e) => setQExplanation(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 px-3.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                ></textarea>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="py-2.5 px-4 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="py-2.5 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Question</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
