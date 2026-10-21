const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const crypto = require('crypto');

// Judge0 Language ID Mapping
const JUDGE0_LANGUAGE_IDS = {
  python: 71, // Python (3.8.1)
  java: 62,   // Java (OpenJDK 13/21)
  c: 50,      // C (GCC 9.2.0)
  cpp: 54,    // C++ (GCC 9.2.0)
};

/**
 * Execute code using Judge0 if configured
 */
const runViaJudge0 = async ({ language, code, stdin = '', timeLimit = 2, memoryLimit = 256 }) => {
  const apiUrl = process.env.JUDGE0_API_URL;
  const apiKey = process.env.JUDGE0_API_KEY;
  const apiHost = process.env.JUDGE0_HOST;

  const langId = JUDGE0_LANGUAGE_IDS[language.toLowerCase()];
  if (!langId) {
    throw new Error(`Unsupported language for Judge0: ${language}`);
  }

  const headers = {
    'Content-Type': 'application/json',
  };
  if (apiKey) {
    headers['X-RapidAPI-Key'] = apiKey;
  }
  if (apiHost) {
    headers['X-RapidAPI-Host'] = apiHost;
  }

  // Fetch API is built-in in Node 18+
  const response = await fetch(`${apiUrl}/submissions?base64_encoded=false&wait=true`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      source_code: code,
      language_id: langId,
      stdin: stdin,
      cpu_time_limit: timeLimit,
      memory_limit: memoryLimit * 1024, // in KB
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Judge0 API error (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  const statusDesc = result.status?.description || 'Unknown';
  const stdout = result.stdout || '';
  const stderr = result.stderr || '';
  const compileOutput = result.compile_output || '';

  return {
    status: statusDesc,
    stdout: stdout.trim(),
    stderr: stderr.trim(),
    compileOutput: compileOutput.trim(),
    time: result.time || 0,
    memory: result.memory || 0,
    isError: result.status?.id > 3, // Status 3 is 'Accepted'
    isAccepted: result.status?.id === 3,
  };
};

/**
 * Local isolated sandboxed execution fallback
 * Spawns child process in a restricted temp directory with timeouts and buffer bounds
 */
const runViaLocalSandbox = async ({ language, code, stdin = '', timeLimit = 3 }) => {
  const lang = language.toLowerCase();
  const runId = crypto.randomBytes(8).toString('hex');
  const tempDir = path.join(os.tmpdir(), `kairos_sandbox_${runId}`);

  try {
    fs.mkdirSync(tempDir, { recursive: true });

    let fileName, compileCmd, compileArgs, runCmd, runArgs;

    if (lang === 'python') {
      fileName = 'solution.py';
      fs.writeFileSync(path.join(tempDir, fileName), code, 'utf8');
      runCmd = 'python';
      runArgs = ['-u', path.join(tempDir, fileName)];
    } else if (lang === 'java') {
      // Look for public class name or fallback to Main
      const classMatch = code.match(/public\s+class\s+([A-Za-z0-9_]+)/);
      const className = classMatch ? classMatch[1] : 'Main';
      fileName = `${className}.java`;
      fs.writeFileSync(path.join(tempDir, fileName), code, 'utf8');
      
      compileCmd = 'javac';
      compileArgs = [path.join(tempDir, fileName)];
      runCmd = 'java';
      runArgs = ['-Xmx256m', '-cp', tempDir, className];
    } else if (lang === 'c') {
      fileName = 'main.c';
      const exeName = process.platform === 'win32' ? 'main.exe' : 'main';
      fs.writeFileSync(path.join(tempDir, fileName), code, 'utf8');
      compileCmd = 'gcc';
      compileArgs = [path.join(tempDir, fileName), '-o', path.join(tempDir, exeName)];
      runCmd = path.join(tempDir, exeName);
      runArgs = [];
    } else if (lang === 'cpp') {
      fileName = 'main.cpp';
      const exeName = process.platform === 'win32' ? 'main.exe' : 'main';
      fs.writeFileSync(path.join(tempDir, fileName), code, 'utf8');
      compileCmd = 'g++';
      compileArgs = [path.join(tempDir, fileName), '-o', path.join(tempDir, exeName)];
      runCmd = path.join(tempDir, exeName);
      runArgs = [];
    } else {
      return {
        status: 'Error',
        stdout: '',
        stderr: `Language '${language}' is not supported in local sandbox.`,
        compileOutput: '',
        time: 0,
        memory: 0,
        isError: true,
        isAccepted: false,
      };
    }

    // Step 1: Compilation if needed
    if (compileCmd) {
      const compileResult = await new Promise((resolve) => {
        let stderrData = '';
        let proc;
        try {
          proc = spawn(compileCmd, compileArgs, { cwd: tempDir, timeout: 8000 });
        } catch (err) {
          return resolve({
            success: false,
            error: `Compiler '${compileCmd}' is not installed or not in system PATH: ${err.message}`,
          });
        }

        proc.stderr.on('data', (data) => {
          stderrData += data.toString();
        });

        proc.on('error', (err) => {
          resolve({
            success: false,
            error: `Failed to invoke ${compileCmd}: ${err.message}`,
          });
        });

        proc.on('close', (code) => {
          if (code !== 0) {
            resolve({
              success: false,
              error: stderrData || `Compilation failed with exit code ${code}`,
            });
          } else {
            resolve({ success: true });
          }
        });
      });

      if (!compileResult.success) {
        return {
          status: 'Compilation Error',
          stdout: '',
          stderr: '',
          compileOutput: compileResult.error,
          time: 0,
          memory: 0,
          isError: true,
          isAccepted: false,
        };
      }
    }

    // Step 2: Execution with Stdin and strict Timeout
    const startTime = Date.now();
    const runResult = await new Promise((resolve) => {
      let stdoutData = '';
      let stderrData = '';
      let isTimedOut = false;
      let child;

      try {
        child = spawn(runCmd, runArgs, {
          cwd: tempDir,
          timeout: timeLimit * 1000,
        });
      } catch (err) {
        return resolve({
          status: 'Runtime Error',
          stdout: '',
          stderr: `Failed to execute: ${err.message}`,
          time: 0,
          isError: true,
        });
      }

      const timer = setTimeout(() => {
        isTimedOut = true;
        try {
          child.kill('SIGKILL');
        } catch (e) {}
      }, timeLimit * 1000);

      if (stdin) {
        child.stdin.write(stdin);
        child.stdin.end();
      } else {
        child.stdin.end();
      }

      child.stdout.on('data', (data) => {
        if (stdoutData.length < 50000) {
          stdoutData += data.toString();
        }
      });

      child.stderr.on('data', (data) => {
        if (stderrData.length < 50000) {
          stderrData += data.toString();
        }
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        resolve({
          status: 'Runtime Error',
          stdout: stdoutData,
          stderr: err.message,
          time: (Date.now() - startTime) / 1000,
          isError: true,
        });
      });

      child.on('close', (code, signal) => {
        clearTimeout(timer);
        const elapsed = (Date.now() - startTime) / 1000;
        if (isTimedOut || signal === 'SIGKILL' || signal === 'SIGTERM') {
          resolve({
            status: 'Time Limit Exceeded',
            stdout: stdoutData.trim(),
            stderr: 'Execution timed out',
            time: elapsed,
            isError: true,
          });
        } else if (code !== 0) {
          resolve({
            status: 'Runtime Error',
            stdout: stdoutData.trim(),
            stderr: stderrData.trim() || `Process exited with code ${code}`,
            time: elapsed,
            isError: true,
          });
        } else {
          resolve({
            status: 'Accepted',
            stdout: stdoutData.trim(),
            stderr: stderrData.trim(),
            time: elapsed,
            isError: false,
          });
        }
      });
    });

    return {
      status: runResult.status,
      stdout: runResult.stdout,
      stderr: runResult.stderr,
      compileOutput: '',
      time: runResult.time,
      memory: 0,
      isError: runResult.isError,
      isAccepted: !runResult.isError,
    };
  } catch (error) {
    return {
      status: 'Execution Error',
      stdout: '',
      stderr: error.message,
      compileOutput: '',
      time: 0,
      memory: 0,
      isError: true,
      isAccepted: false,
    };
  } finally {
    // Clean up sandbox temp files safely
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch (e) {
      // Ignore cleanup error
    }
  }
};

/**
 * Universal runCode function: Tries Judge0 if configured, falls back to isolated local sandbox
 */
const runCode = async ({ language, code, stdin = '', timeLimit = 2, memoryLimit = 256 }) => {
  if (process.env.JUDGE0_API_URL) {
    try {
      return await runViaJudge0({ language, code, stdin, timeLimit, memoryLimit });
    } catch (err) {
      console.warn(`[CodeExecution] Judge0 API call failed: ${err.message}. Falling back to local sandbox.`);
    }
  }
  return await runViaLocalSandbox({ language, code, stdin, timeLimit });
};

/**
 * Normalize output string for fair comparison (handles trailing whitespace & newline differences)
 */
const normalizeOutput = (str = '') => {
  return str
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim();
};

/**
 * Evaluate code against multiple test cases
 */
const evaluateTestCases = async ({ language, code, testCases = [], timeLimit = 2, memoryLimit = 256 }) => {
  const results = [];
  let passedCount = 0;
  let totalTime = 0;

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    const execRes = await runCode({
      language,
      code,
      stdin: tc.input || '',
      timeLimit,
      memoryLimit,
    });

    totalTime += execRes.time || 0;

    if (execRes.status === 'Compilation Error') {
      // Stop further test cases if compilation failed
      results.push({
        testCaseIndex: i + 1,
        isSample: tc.isSample || false,
        passed: false,
        input: tc.isSample ? tc.input : undefined,
        expectedOutput: tc.isSample ? tc.expectedOutput : undefined,
        actualOutput: '',
        errorMessage: execRes.compileOutput || 'Compilation Error',
        executionTime: 0,
        status: 'Compilation Error',
      });
      break;
    }

    const actualNormalized = normalizeOutput(execRes.stdout);
    const expectedNormalized = normalizeOutput(tc.expectedOutput);
    const passed = !execRes.isError && actualNormalized === expectedNormalized;

    if (passed) {
      passedCount++;
    }

    results.push({
      testCaseIndex: i + 1,
      isSample: tc.isSample || false,
      passed,
      // For samples, safe to return input & expected
      input: tc.isSample ? tc.input : undefined,
      expectedOutput: tc.isSample ? tc.expectedOutput : undefined,
      actualOutput: tc.isSample ? execRes.stdout : (passed ? 'Output matched' : 'Output mismatch'),
      errorMessage: execRes.stderr || (passed ? '' : (execRes.status !== 'Accepted' ? execRes.status : 'Wrong Answer')),
      executionTime: execRes.time,
      status: passed ? 'Passed' : (execRes.isError ? execRes.status : 'Wrong Answer'),
    });
  }

  return {
    results,
    passedCount,
    totalCount: testCases.length,
    percentagePassed: testCases.length > 0 ? (passedCount / testCases.length) * 100 : 0,
    averageTime: testCases.length > 0 ? totalTime / testCases.length : 0,
  };
};

module.exports = {
  runCode,
  evaluateTestCases,
  normalizeOutput,
};
