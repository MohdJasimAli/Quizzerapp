import React, { useState, useRef } from 'react';
import Editor from '@monaco-editor/react';
import {
  Play,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Clock,
  Terminal,
  Check,
  ChevronDown,
  Loader2,
  Code2,
  FileCode,
} from 'lucide-react';
import { runCodeSample } from '../services/executionService';
import { useToast } from '../context/ToastContext';

const LANGUAGE_CONFIGS = {
  python: { label: 'Python 3', monacoLang: 'python' },
  java: { label: 'Java (OpenJDK 21)', monacoLang: 'java' },
  c: { label: 'C (GCC)', monacoLang: 'c' },
  cpp: { label: 'C++ (G++)', monacoLang: 'cpp' },
};

export const CodeEditorPanel = ({
  question,
  code = '',
  language = 'python',
  onChangeCode,
  onChangeLanguage,
  onResetStarterCode,
}) => {
  const toast = useToast();
  const [isRunning, setIsRunning] = useState(false);
  const [activeTab, setActiveTab] = useState('testcases'); // 'testcases' | 'console'
  const [runResults, setRunResults] = useState(null);
  const [customInput, setCustomInput] = useState('');
  const [useClassicTextarea, setUseClassicTextarea] = useState(false);
  const textareaRef = useRef(null);
  const editorRef = useRef(null);

  const allowedLanguages = question.codingData?.allowedLanguages || ['python', 'java', 'c', 'cpp'];

  const handleEditorMount = (editor) => {
    editorRef.current = editor;
    try {
      editor.focus();
    } catch (e) {}
  };

  const handleRunCode = async () => {
    setIsRunning(true);
    try {
      const data = await runCodeSample({
        questionId: question._id,
        language,
        code,
      });

      if (data.success) {
        setRunResults(data);
        setActiveTab('testcases');
        if (data.passedCount === data.totalCount) {
          toast.success(`All ${data.totalCount} sample test cases passed!`);
        } else {
          toast.warning(`${data.passedCount} of ${data.totalCount} sample test cases passed.`);
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to execute code');
    } finally {
      setIsRunning(false);
    }
  };

  // Tab key indent handler for fallback textarea
  const handleTextareaKeyDown = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const { selectionStart, selectionEnd, value } = e.target;
      const newValue = value.substring(0, selectionStart) + '    ' + value.substring(selectionEnd);
      onChangeCode(newValue);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = selectionStart + 4;
        }
      }, 0);
    }
  };

  return (
    <div className="flex flex-col bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl select-text">
      {/* Top Bar: Language Picker, Reset, Run Code */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-slate-950 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-400">Language:</label>
          <div className="relative">
            <select
              value={language}
              onChange={(e) => onChangeLanguage(e.target.value)}
              className="appearance-none bg-slate-900 border border-slate-700 hover:border-slate-600 rounded-lg py-1.5 pl-3 pr-8 text-xs font-medium text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              {allowedLanguages.map((lang) => (
                <option key={lang} value={lang}>
                  {LANGUAGE_CONFIGS[lang]?.label || lang.toUpperCase()}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
          </div>

          {/* Toggle between Monaco Editor and Classic Textarea if needed */}
          <button
            type="button"
            onClick={() => setUseClassicTextarea(!useClassicTextarea)}
            className="text-[11px] text-slate-400 hover:text-indigo-400 px-2 py-1 rounded bg-slate-900 border border-slate-800 hover:border-slate-700 transition"
            title="Switch editor mode"
          >
            {useClassicTextarea ? 'Switch to Monaco IDE' : 'Plain Text Mode'}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onResetStarterCode}
            type="button"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition border border-transparent hover:border-slate-700"
            title="Reset to starter template"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset Code</span>
          </button>

          <button
            onClick={handleRunCode}
            disabled={isRunning}
            type="button"
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 transition shadow-md shadow-indigo-600/20 disabled:opacity-50"
          >
            {isRunning ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Running...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Run Code</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Editor Writing Area */}
      <div className="relative min-h-[380px] h-[400px] w-full bg-[#1e1e1e] select-text">
        {useClassicTextarea ? (
          <textarea
            ref={textareaRef}
            value={code}
            onChange={(e) => onChangeCode(e.target.value)}
            onKeyDown={handleTextareaKeyDown}
            placeholder="Type your code solution here..."
            spellCheck={false}
            className="w-full h-full p-4 bg-slate-950 font-mono text-xs sm:text-sm text-slate-100 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500 leading-relaxed border-none"
          />
        ) : (
          <Editor
            height="400px"
            language={LANGUAGE_CONFIGS[language]?.monacoLang || 'python'}
            value={code}
            onChange={(val) => onChangeCode(val || '')}
            onMount={handleEditorMount}
            theme="vs-dark"
            options={{
              readOnly: false,
              domReadOnly: false,
              fontSize: 13,
              fontFamily: '"Fira Code", Consolas, "Courier New", monospace',
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 4,
              wordWrap: 'on',
              lineNumbers: 'on',
              padding: { top: 12, bottom: 12 },
              cursorBlinking: 'blink',
              cursorStyle: 'line',
              selectOnLineNumbers: true,
              accessibilitySupport: 'off',
            }}
          />
        )}
      </div>

      {/* Bottom Output Console */}
      <div className="border-t border-slate-800 bg-slate-950 flex flex-col max-h-64 overflow-hidden">
        {/* Console Header Tabs */}
        <div className="flex items-center justify-between px-4 py-1.5 border-b border-slate-800/80 bg-slate-900/40 text-xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveTab('testcases')}
              className={`flex items-center gap-1.5 py-1 px-2.5 rounded-md font-medium transition ${
                activeTab === 'testcases'
                  ? 'bg-slate-800 text-indigo-300'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Check className="w-3.5 h-3.5" />
              <span>Sample Test Cases</span>
              {runResults && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    runResults.passedCount === runResults.totalCount
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                      : 'bg-amber-950 text-amber-400 border border-amber-500/30'
                  }`}
                >
                  {runResults.passedCount}/{runResults.totalCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('console')}
              className={`flex items-center gap-1.5 py-1 px-2.5 rounded-md font-medium transition ${
                activeTab === 'console'
                  ? 'bg-slate-800 text-indigo-300'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Output Console</span>
            </button>
          </div>

          {runResults && (
            <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-500" />
                <span>{runResults.executionTime}ms</span>
              </span>
            </div>
          )}
        </div>

        {/* Console Tab Content */}
        <div className="p-4 overflow-y-auto max-h-48 font-mono text-xs select-text">
          {activeTab === 'testcases' && (
            <div className="space-y-3">
              {(!runResults || !runResults.results) && (
                <div className="py-4 text-center text-slate-500 text-xs">
                  Click <strong>Run Code</strong> above to evaluate your code against the public sample test cases.
                </div>
              )}

              {runResults?.results?.map((res, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-xl border transition ${
                    res.passed
                      ? 'bg-emerald-950/20 border-emerald-500/30'
                      : 'bg-rose-950/20 border-rose-500/30'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                      {res.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-400" />
                      )}
                      <span>Test Case #{idx + 1}</span>
                    </span>
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                        res.passed ? 'bg-emerald-900/50 text-emerald-300' : 'bg-rose-900/50 text-rose-300'
                      }`}
                    >
                      {res.passed ? 'Passed' : 'Failed'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                    <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Input</span>
                      <pre className="text-slate-300 mt-0.5 whitespace-pre-wrap">{res.input || '(empty)'}</pre>
                    </div>

                    <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Expected Output</span>
                      <pre className="text-emerald-400 mt-0.5 whitespace-pre-wrap">{res.expectedOutput}</pre>
                    </div>

                    {!res.passed && (
                      <div className="sm:col-span-2 bg-rose-950/40 p-2 rounded-lg border border-rose-900/50">
                        <span className="text-[10px] uppercase font-bold text-rose-400 block">Your Output</span>
                        <pre className="text-rose-200 mt-0.5 whitespace-pre-wrap">
                          {res.actualOutput || res.error || '(no output)'}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'console' && (
            <div className="space-y-2">
              {runResults?.compilationError ? (
                <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300">
                  <p className="font-bold mb-1">Compilation / Syntax Error:</p>
                  <pre className="whitespace-pre-wrap">{runResults.compilationError}</pre>
                </div>
              ) : runResults?.results?.[0]?.error ? (
                <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300">
                  <p className="font-bold mb-1">Runtime Error:</p>
                  <pre className="whitespace-pre-wrap">{runResults.results[0].error}</pre>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-300">
                  <p className="font-semibold text-slate-400 mb-1">Standard Output:</p>
                  <pre className="whitespace-pre-wrap text-emerald-400">
                    {runResults?.results?.[0]?.actualOutput || 'No output recorded.'}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
