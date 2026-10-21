import React, { useState } from 'react';
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
  code,
  language,
  onChangeCode,
  onChangeLanguage,
  onResetStarterCode,
}) => {
  const toast = useToast();
  const [isRunning, setIsRunning] = useState(false);
  const [activeTab, setActiveTab] = useState('testcases'); // 'testcases' | 'console'
  const [runResults, setRunResults] = useState(null);
  const [customInput, setCustomInput] = useState('');

  const allowedLanguages = question.codingData?.allowedLanguages || ['python', 'java', 'c', 'cpp'];

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

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
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

      {/* Monaco Editor Container */}
      <div className="flex-1 min-h-[340px] relative">
        <Editor
          height="100%"
          language={LANGUAGE_CONFIGS[language]?.monacoLang || 'python'}
          value={code}
          onChange={(val) => onChangeCode(val || '')}
          theme="vs-dark"
          options={{
            fontSize: 13,
            fontFamily: '"Fira Code", Consolas, monospace',
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 4,
            wordWrap: 'on',
            lineNumbers: 'on',
            padding: { top: 12, bottom: 12 },
          }}
        />
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
              <span>Console Output</span>
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-3.5 overflow-y-auto text-xs font-mono">
          {activeTab === 'testcases' && (
            <div>
              {!runResults ? (
                <div className="text-slate-500 text-center py-4 font-sans">
                  Click <strong className="text-indigo-400">"Run Code"</strong> to test your solution against the sample test cases.
                </div>
              ) : (
                <div className="space-y-3">
                  {runResults.results.map((res, i) => (
                    <div
                      key={i}
                      className={`p-3 rounded-xl border ${
                        res.passed
                          ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
                          : 'bg-rose-950/20 border-rose-500/30 text-rose-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2 font-sans font-semibold">
                        <span className="flex items-center gap-1.5">
                          {res.passed ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <XCircle className="w-4 h-4 text-rose-400" />
                          )}
                          <span>Sample Case #{res.testCaseIndex}</span>
                        </span>
                        <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
                          {res.executionTime !== undefined && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {res.executionTime}s
                            </span>
                          )}
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              res.passed
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-rose-500/20 text-rose-300'
                            }`}
                          >
                            {res.status || (res.passed ? 'Passed' : 'Failed')}
                          </span>
                        </div>
                      </div>

                      {res.input !== undefined && (
                        <div className="mb-1.5">
                          <span className="text-[10px] text-slate-400 font-sans uppercase font-bold">Input:</span>
                          <pre className="bg-slate-950/80 p-2 rounded-lg mt-0.5 text-slate-300 whitespace-pre-wrap">
                            {res.input || '(empty)'}
                          </pre>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {res.expectedOutput !== undefined && (
                          <div>
                            <span className="text-[10px] text-slate-400 font-sans uppercase font-bold">Expected Output:</span>
                            <pre className="bg-slate-950/80 p-2 rounded-lg mt-0.5 text-slate-300 whitespace-pre-wrap">
                              {res.expectedOutput}
                            </pre>
                          </div>
                        )}
                        <div>
                          <span className="text-[10px] text-slate-400 font-sans uppercase font-bold">Your Output:</span>
                          <pre className="bg-slate-950/80 p-2 rounded-lg mt-0.5 text-slate-300 whitespace-pre-wrap">
                            {res.actualOutput || '(no output)'}
                          </pre>
                        </div>
                      </div>

                      {res.errorMessage && (
                        <div className="mt-2 text-rose-400 bg-rose-950/40 p-2 rounded-lg">
                          <span className="text-[10px] font-sans font-bold uppercase">Error Detail:</span>
                          <pre className="whitespace-pre-wrap mt-0.5">{res.errorMessage}</pre>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'console' && (
            <div className="space-y-2">
              <p className="text-slate-400 font-sans text-xs">Standard output & stderr from execution:</p>
              <pre className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-slate-300 whitespace-pre-wrap min-h-[80px]">
                {runResults
                  ? runResults.results.map((r, i) => `--- Case #${i + 1} ---\n${r.actualOutput || '(none)'}\n${r.errorMessage ? `Error: ${r.errorMessage}\n` : ''}`).join('\n')
                  : 'No execution output yet. Click "Run Code".'}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
