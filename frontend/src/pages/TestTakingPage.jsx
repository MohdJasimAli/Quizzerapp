import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  startTest,
  autosaveMCQ,
  autosaveCoding,
  logIntegrityEvent,
  submitTest,
} from '../services/attemptService';
import { useToast } from '../context/ToastContext';
import { Timer } from '../components/Timer';
import { QuestionNavigator } from '../components/QuestionNavigator';
import { CodeEditorPanel } from '../components/CodeEditorPanel';
import { MobileCodingNotice } from '../components/MobileCodingNotice';
import { IntegrityWarningModal } from '../components/IntegrityWarningModal';
import {
  Code2,
  CheckCircle2,
  AlertCircle,
  Flag,
  ArrowLeft,
  ArrowRight,
  Send,
  CloudCheck,
  Maximize2,
  Menu,
  X,
  Loader2,
  Bookmark,
} from 'lucide-react';

export const TestTakingPage = () => {
  const { id: testId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [test, setTest] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [attempt, setAttempt] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Answers State: questionId -> { selectedOptionId, code, language, isFlagged, isAnswered }
  const [answersState, setAnswersState] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState(null);

  // Integrity & Violation State
  const [integrityModalOpen, setIntegrityModalOpen] = useState(false);
  const [lastViolationType, setLastViolationType] = useState('tab_switch');
  const [violationCount, setViolationCount] = useState(0);
  const [isAutoSubmitted, setIsAutoSubmitted] = useState(false);

  // UI state
  const [mobilePaletteOpen, setMobilePaletteOpen] = useState(false);
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeQuestion = questions[currentIndex] || null;

  // 1. Initial Load / Resume Attempt
  useEffect(() => {
    const initTest = async () => {
      try {
        setLoading(true);
        // Start or resume
        const data = await startTest(testId);
        if (data.success) {
          setTest(data.test);
          setQuestions(data.questions || []);
          setAttempt(data.attempt);
          setViolationCount(data.attempt.violationCount || 0);

          // Populate initial answers from attempt
          const initialAnswers = {};
          data.questions.forEach((q) => {
            if (q.type === 'mcq') {
              const saved = data.attempt.mcqAnswers?.find(
                (a) => a.questionId.toString() === q._id.toString()
              );
              initialAnswers[q._id] = {
                selectedOptionId: saved?.selectedOptionId || '',
                isFlagged: Boolean(saved?.isFlagged),
                isAnswered: Boolean(saved?.selectedOptionId),
              };
            } else if (q.type === 'coding') {
              const saved = data.attempt.codingAnswers?.find(
                (a) => a.questionId.toString() === q._id.toString()
              );
              const defaultLang = q.codingData?.allowedLanguages?.[0] || 'python';
              const code = saved?.code || q.codingData?.starterCode?.[defaultLang] || '';
              initialAnswers[q._id] = {
                code,
                language: saved?.language || defaultLang,
                isFlagged: Boolean(saved?.isFlagged),
                isAnswered: Boolean(code && code.trim().length > 15),
              };
            }
          });
          setAnswersState(initialAnswers);
          setLastSavedTime(new Date());
        }
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to initialize test.');
        navigate('/student/dashboard');
      } finally {
        setLoading(false);
      }
    };

    initTest();
  }, [testId, navigate]);

  // 2. Anti-Cheating & Integrity Event Listener
  const triggerIntegrityViolation = useCallback(
    async (eventType, details) => {
      if (!attempt || isAutoSubmitted || isSubmitting) return;

      try {
        const res = await logIntegrityEvent(attempt._id, eventType, details);
        if (res.success) {
          setViolationCount(res.violationCount);
          setLastViolationType(eventType);

          if (res.disqualified) {
            setIsAutoSubmitted(true);
            toast.error('Violation detected! You have been immediately disqualified and kicked out with 0 marks.');
            navigate(`/tests/${testId}/submitted`, {
              state: {
                isDisqualified: true,
                reason: details || eventType,
                message: res.message,
                result: res.result,
                testTitle: test?.title,
              },
            });
            return;
          }

          setIntegrityModalOpen(true);
          if (res.autoSubmitted) {
            setIsAutoSubmitted(true);
            toast.error('Integrity violation limit exceeded. Test automatically submitted.');
            setTimeout(() => {
              navigate(`/tests/${testId}/submitted`, { state: { autoSubmitted: true } });
            }, 2000);
          }
        }
      } catch (err) {
        console.error('Integrity report error:', err);
      }
    },
    [attempt, isAutoSubmitted, isSubmitting, testId, test, navigate, toast]
  );

  useEffect(() => {
    if (!attempt || loading || isAutoSubmitted) return;

    // Detect Tab Switch / Window Blur
    const handleVisibilityChange = () => {
      if (document.hidden) {
        triggerIntegrityViolation('tab_switch', 'Student switched browser tab or minimized window');
      }
    };

    const handleWindowBlur = () => {
      triggerIntegrityViolation('window_blur', 'Window lost active keyboard/mouse focus');
    };

    // Detect Fullscreen Exit
    const handleFullscreenChange = () => {
      const isFullscreen = Boolean(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement
      );
      if (!isFullscreen && test?.integrityPolicy?.requireFullscreen) {
        triggerIntegrityViolation('fullscreen_exit', 'Student exited fullscreen examination mode');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, [attempt, loading, isAutoSubmitted, test, triggerIntegrityViolation]);

  // 3. Periodic Background Autosave (Every 25 seconds)
  useEffect(() => {
    if (!attempt || loading || !activeQuestion) return;

    const interval = setInterval(async () => {
      if (activeQuestion.type === 'coding') {
        const curr = answersState[activeQuestion._id];
        if (curr) {
          try {
            setIsSaving(true);
            await autosaveCoding(attempt._id, {
              questionId: activeQuestion._id,
              code: curr.code,
              language: curr.language,
              isFlagged: curr.isFlagged,
            });
            setLastSavedTime(new Date());
          } catch (e) {
            console.error('Periodic autosave failed:', e);
          } finally {
            setIsSaving(false);
          }
        }
      }
    }, 25000);

    return () => clearInterval(interval);
  }, [attempt, loading, activeQuestion, answersState]);

  // 4. Save question answer immediately on selection (MCQ) or on question switch (Coding)
  const saveCurrentQuestion = async (qId, updatedData) => {
    if (!attempt) return;
    setIsSaving(true);
    try {
      if (activeQuestion?.type === 'mcq') {
        await autosaveMCQ(attempt._id, {
          questionId: qId,
          selectedOptionId: updatedData.selectedOptionId,
          isFlagged: updatedData.isFlagged,
        });
      } else if (activeQuestion?.type === 'coding') {
        await autosaveCoding(attempt._id, {
          questionId: qId,
          code: updatedData.code,
          language: updatedData.language,
          isFlagged: updatedData.isFlagged,
        });
      }
      setLastSavedTime(new Date());
    } catch (err) {
      console.error('Save error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectMCQOption = (optionId) => {
    if (!activeQuestion) return;
    const qId = activeQuestion._id;
    const isAnswered = Boolean(optionId);
    const nextState = {
      ...answersState,
      [qId]: {
        ...(answersState[qId] || {}),
        selectedOptionId: optionId,
        isAnswered,
      },
    };
    setAnswersState(nextState);
    saveCurrentQuestion(qId, nextState[qId]);
  };

  const handleToggleFlag = () => {
    if (!activeQuestion) return;
    const qId = activeQuestion._id;
    const currentFlag = answersState[qId]?.isFlagged || false;
    const nextState = {
      ...answersState,
      [qId]: {
        ...(answersState[qId] || {}),
        isFlagged: !currentFlag,
      },
    };
    setAnswersState(nextState);
    saveCurrentQuestion(qId, nextState[qId]);
  };

  const handleCodeChange = (newCode) => {
    if (!activeQuestion) return;
    const qId = activeQuestion._id;
    setAnswersState((prev) => ({
      ...prev,
      [qId]: {
        ...(prev[qId] || {}),
        code: newCode,
        isAnswered: Boolean(newCode && newCode.trim().length > 15),
      },
    }));
  };

  const handleLanguageChange = (newLang) => {
    if (!activeQuestion) return;
    const qId = activeQuestion._id;
    const starter = activeQuestion.codingData?.starterCode?.[newLang] || '';
    setAnswersState((prev) => ({
      ...prev,
      [qId]: {
        ...(prev[qId] || {}),
        language: newLang,
        code: starter,
      },
    }));
  };

  const handleResetStarter = () => {
    if (!activeQuestion) return;
    const qId = activeQuestion._id;
    const lang = answersState[qId]?.language || 'python';
    const starter = activeQuestion.codingData?.starterCode?.[lang] || '';
    setAnswersState((prev) => ({
      ...prev,
      [qId]: {
        ...(prev[qId] || {}),
        code: starter,
      },
    }));
    toast.info('Code reset to default starter template.');
  };

  const handleNavigateQuestion = (targetIdx) => {
    // If switching away from coding question, trigger autosave immediately
    if (activeQuestion) {
      saveCurrentQuestion(activeQuestion._id, answersState[activeQuestion._id]);
    }
    setCurrentIndex(targetIdx);
    setMobilePaletteOpen(false);
  };

  // 5. Final Submission Handler
  const handleFinalSubmit = async (isAuto = false, reason = 'manual_submit') => {
    if (isSubmitting || !attempt) return;
    setIsSubmitting(true);

    try {
      // Autosave current question before submitting
      if (activeQuestion) {
        await saveCurrentQuestion(activeQuestion._id, answersState[activeQuestion._id]);
      }

      const res = await submitTest(attempt._id, isAuto, reason);
      if (res.success) {
        toast.success('Assessment submitted successfully!');
        navigate(`/tests/${testId}/submitted`, {
          state: {
            result: res.result,
            isReleased: res.isReleased,
            testTitle: test?.title,
          },
        });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Submission error. Please try again.');
      setIsSubmitting(false);
    }
  };

  // Re-request fullscreen when warning modal is acknowledged
  const handleAcknowledgeWarning = async () => {
    setIntegrityModalOpen(false);
    if (!isAutoSubmitted) {
      try {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        }
      } catch (e) {}
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
        <p className="text-sm text-slate-300 font-medium">Entering secure examination environment...</p>
      </div>
    );
  }

  const answeredCount = Object.values(answersState).filter((a) => a?.isAnswered).length;
  const flaggedCount = Object.values(answersState).filter((a) => a?.isFlagged).length;
  const unansweredCount = questions.length - answeredCount;

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col select-none">
      {/* Top Focused Examination Bar */}
      <header className="sticky top-0 z-30 bg-slate-950 border-b border-slate-800 px-4 py-2.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          {/* Test Name & Club Identity */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0">
              <Code2 className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-xs sm:text-sm font-bold text-white line-clamp-1">
                {test?.title}
              </h1>
              <div className="flex items-center gap-2 text-[10px] text-slate-400">
                <span>{test?.subject}</span>
                <span>&bull;</span>
                <span className="flex items-center gap-1 text-slate-300">
                  {isSaving ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin text-indigo-400" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      <span>Autosaved</span>
                    </>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Timer & Submit Controls */}
          <div className="flex items-center gap-3">
            {attempt?.deadline && (
              <Timer
                deadline={attempt.deadline}
                onExpire={() => {
                  toast.warning('Examination time expired! Auto-submitting all answers...');
                  handleFinalSubmit(true, 'timer_expired');
                }}
              />
            )}

            <button
              onClick={() => setSubmitModalOpen(true)}
              className="py-1.5 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-1.5 transition shadow-md shadow-emerald-600/20"
            >
              <Send className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Finish & Submit</span>
              <span className="sm:hidden">Submit</span>
            </button>

            {/* Mobile Navigator Drawer Toggle */}
            <button
              onClick={() => setMobilePaletteOpen(!mobilePaletteOpen)}
              className="lg:hidden p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
              title="Open Question Palette"
            >
              {mobilePaletteOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Examination Workspace */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Center: Question Statement & Workspace (9 cols on desktop) */}
        <div className="lg:col-span-8 xl:col-span-9 flex flex-col justify-between space-y-6">
          {activeQuestion ? (
            <div className="space-y-6">
              {/* Question Header Card */}
              <div className="glass-panel p-5 sm:p-6 rounded-2xl border border-slate-800 space-y-4">
                <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 font-bold text-xs flex items-center justify-center font-mono">
                      {currentIndex + 1}
                    </span>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      Question {currentIndex + 1} of {questions.length}
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-slate-800 text-slate-300 border border-slate-700">
                      {activeQuestion.type}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                      {activeQuestion.marks} Marks
                    </span>

                    <button
                      onClick={handleToggleFlag}
                      className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 transition ${
                        answersState[activeQuestion._id]?.isFlagged
                          ? 'bg-amber-950/60 border-amber-500/50 text-amber-300'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                      title="Flag question to review later"
                    >
                      <Bookmark className="w-3.5 h-3.5 fill-current" />
                      <span className="hidden sm:inline">
                        {answersState[activeQuestion._id]?.isFlagged ? 'Flagged' : 'Flag'}
                      </span>
                    </button>
                  </div>
                </div>

                <div>
                  <h2 className="text-base sm:text-lg font-bold text-white">
                    {activeQuestion.title}
                  </h2>
                  <div className="text-xs sm:text-sm text-slate-300 mt-2 whitespace-pre-wrap leading-relaxed">
                    {activeQuestion.description}
                  </div>
                </div>
              </div>

              {/* MCQ Workspace (Touch Friendly Cards) */}
              {activeQuestion.type === 'mcq' && activeQuestion.mcqData?.options && (
                <div className="space-y-3">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Select your answer:
                  </p>
                  <div className="grid grid-cols-1 gap-2.5">
                    {activeQuestion.mcqData.options.map((opt) => {
                      const isSelected =
                        answersState[activeQuestion._id]?.selectedOptionId === opt.id;

                      return (
                        <div
                          key={opt.id}
                          onClick={() => handleSelectMCQOption(opt.id)}
                          className={`p-4 rounded-xl border cursor-pointer transition flex items-center gap-3.5 transform active:scale-[0.99] ${
                            isSelected
                              ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-lg shadow-indigo-600/20 ring-1 ring-indigo-500'
                              : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 text-slate-300 hover:bg-slate-850'
                          }`}
                        >
                          <div
                            className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition ${
                              isSelected
                                ? 'border-indigo-400 bg-indigo-600'
                                : 'border-slate-600 bg-slate-950'
                            }`}
                          >
                            {isSelected && <div className="w-2 h-2 rounded-full bg-white"></div>}
                          </div>
                          <span className="text-xs sm:text-sm font-medium leading-relaxed">
                            {opt.text}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Coding Workspace (Monaco Editor & Console) */}
              {activeQuestion.type === 'coding' && (
                <div className="space-y-3">
                  <MobileCodingNotice />
                  <CodeEditorPanel
                    question={activeQuestion}
                    code={answersState[activeQuestion._id]?.code || ''}
                    language={answersState[activeQuestion._id]?.language || 'python'}
                    onChangeCode={handleCodeChange}
                    onChangeLanguage={handleLanguageChange}
                    onResetStarterCode={handleResetStarter}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="py-20 text-center text-slate-500">No active question found.</div>
          )}

          {/* Bottom Question Navigation Buttons */}
          <div className="pt-6 border-t border-slate-800/80 flex items-center justify-between gap-3">
            <button
              onClick={() => handleNavigateQuestion(currentIndex - 1)}
              disabled={currentIndex === 0}
              className="py-2.5 px-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white font-semibold text-xs flex items-center gap-1.5 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Previous Question</span>
            </button>

            <span className="text-xs text-slate-500 font-mono hidden sm:inline">
              Question {currentIndex + 1} of {questions.length}
            </span>

            {currentIndex < questions.length - 1 ? (
              <button
                onClick={() => handleNavigateQuestion(currentIndex + 1)}
                className="py-2.5 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-1.5 transition shadow-md shadow-indigo-600/20"
              >
                <span>Next Question</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => setSubmitModalOpen(true)}
                className="py-2.5 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 transition shadow-md shadow-emerald-600/20"
              >
                <span>Review & Submit</span>
                <Send className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Right Sidebar: Question Palette (3 cols on desktop) */}
        <div className="hidden lg:block lg:col-span-4 xl:col-span-3">
          <div className="sticky top-20 glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Questions Overview
            </h3>
            <QuestionNavigator
              questions={questions}
              currentIndex={currentIndex}
              onSelectQuestion={handleNavigateQuestion}
              answers={answersState}
            />
          </div>
        </div>
      </div>

      {/* Mobile Drawer Navigator */}
      {mobilePaletteOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-md flex flex-col justify-end p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 max-h-[80vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Question Navigator
              </h3>
              <button
                onClick={() => setMobilePaletteOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <QuestionNavigator
              questions={questions}
              currentIndex={currentIndex}
              onSelectQuestion={handleNavigateQuestion}
              answers={answersState}
            />
          </div>
        </div>
      )}

      {/* Integrity Warning Modal */}
      <IntegrityWarningModal
        isOpen={integrityModalOpen}
        violationCount={violationCount}
        warningLimit={test?.integrityPolicy?.warningLimit || 3}
        eventType={lastViolationType}
        onAcknowledge={handleAcknowledgeWarning}
        autoSubmitted={isAutoSubmitted}
      />

      {/* Submit Confirmation Modal */}
      {submitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl space-y-5">
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mx-auto mb-3">
                <Send className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-white">Ready to Submit?</h3>
              <p className="text-xs text-slate-400 mt-1">
                Please verify your responses before final submission. Once submitted, you cannot resume this attempt.
              </p>
            </div>

            {/* Response Summary Pills */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30">
                <p className="text-emerald-400 font-bold text-lg">{answeredCount}</p>
                <p className="text-[10px] uppercase font-bold text-emerald-400/80">Answered</p>
              </div>

              <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/30">
                <p className="text-amber-400 font-bold text-lg">{flaggedCount}</p>
                <p className="text-[10px] uppercase font-bold text-amber-400/80">Flagged</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <p className="text-slate-300 font-bold text-lg">{unansweredCount}</p>
                <p className="text-[10px] uppercase font-bold text-slate-400">Unanswered</p>
              </div>
            </div>

            {unansweredCount > 0 && (
              <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>You have {unansweredCount} unanswered questions remaining.</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSubmitModalOpen(false)}
                className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
              >
                Return to Test
              </button>

              <button
                type="button"
                onClick={() => handleFinalSubmit(false, 'manual_submit')}
                disabled={isSubmitting}
                className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Confirm & Finish</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
