const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const User = require('../src/models/User');
const TestModel = require('../src/models/Test');
const Question = require('../src/models/Question');
const { evaluateTestCases } = require('../src/services/codeExecutionService');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/kairos_test_platform';

test.before(async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(MONGO_URI);
  }
});

test.after(async () => {
  await mongoose.connection.close();
});

test('Rule 1: Password hashing and comparison works correctly', async () => {
  const testUser = new User({
    name: 'Test Hash User',
    email: `test_hash_${Date.now()}@kairos.edu`,
    password: 'SecurePassword@123',
    role: 'student',
  });
  await testUser.save();

  assert.notStrictEqual(testUser.password, 'SecurePassword@123', 'Password should be hashed');
  const isMatch = await testUser.comparePassword('SecurePassword@123');
  assert.strictEqual(isMatch, true, 'comparePassword should return true for valid password');

  const isWrongMatch = await testUser.comparePassword('WrongPassword');
  assert.strictEqual(isWrongMatch, false, 'comparePassword should return false for invalid password');

  await User.findByIdAndDelete(testUser._id);
});

test('Rule 2: Test cannot be published with fewer than 5 questions (e.g. 4 questions)', async () => {
  const admin = await User.findOne({ role: 'admin' });
  const draftTest = await TestModel.create({
    title: 'Four Questions Test',
    subject: 'Algorithms',
    duration: 30,
    startTime: new Date(),
    endTime: new Date(Date.now() + 86400000),
    testType: 'mcq',
    createdBy: admin._id,
    questions: [], // 0 questions initially
  });

  // Add only 4 questions
  const qIds = [];
  for (let i = 1; i <= 4; i++) {
    const q = await Question.create({
      testId: draftTest._id,
      type: 'mcq',
      title: `MCQ Question ${i}`,
      description: `Description ${i}`,
      marks: 5,
      order: i,
      mcqData: {
        options: [
          { id: '1', text: 'Option A', isCorrect: true },
          { id: '2', text: 'Option B', isCorrect: false },
        ],
      },
    });
    qIds.push(q._id);
  }
  draftTest.questions = qIds;
  await draftTest.save();

  assert.throws(
    () => {
      draftTest.validateForPublishing();
    },
    /Minimum 5 questions required/,
    'Should throw error when publishing with fewer than 5 questions'
  );

  // Clean up
  await Question.deleteMany({ testId: draftTest._id });
  await TestModel.findByIdAndDelete(draftTest._id);
});

test('Rule 3: Test with exactly 5 questions can be published', async () => {
  const admin = await User.findOne({ role: 'admin' });
  const validTest = await TestModel.create({
    title: 'Five Questions Valid Test',
    subject: 'Algorithms',
    duration: 30,
    startTime: new Date(),
    endTime: new Date(Date.now() + 86400000),
    testType: 'mcq',
    createdBy: admin._id,
    questions: [],
  });

  const qIds = [];
  for (let i = 1; i <= 5; i++) {
    const q = await Question.create({
      testId: validTest._id,
      type: 'mcq',
      title: `Valid Question ${i}`,
      description: `Description ${i}`,
      marks: i * 2, // Different marks: 2, 4, 6, 8, 10
      order: i,
      mcqData: {
        options: [
          { id: '1', text: 'A', isCorrect: true },
          { id: '2', text: 'B', isCorrect: false },
        ],
      },
    });
    qIds.push(q._id);
  }
  validTest.questions = qIds;
  await validTest.save();

  assert.doesNotThrow(() => {
    validTest.validateForPublishing();
  }, 'Should not throw error for 5 questions');

  // Verify independent marks sum
  const questions = await Question.find({ testId: validTest._id });
  const total = questions.reduce((s, q) => s + q.marks, 0);
  assert.strictEqual(total, 30, 'Total marks should equal 2+4+6+8+10 = 30');

  // Clean up
  await Question.deleteMany({ testId: validTest._id });
  await TestModel.findByIdAndDelete(validTest._id);
});

test('Rule 4: Test cannot exceed 20 questions', async () => {
  const admin = await User.findOne({ role: 'admin' });
  const bigTest = new TestModel({
    title: 'Twenty One Questions Test',
    subject: 'Algorithms',
    duration: 60,
    startTime: new Date(),
    endTime: new Date(Date.now() + 86400000),
    testType: 'mcq',
    createdBy: admin._id,
    questions: new Array(21).fill(new mongoose.Types.ObjectId()),
  });

  assert.throws(
    () => {
      bigTest.validateForPublishing();
    },
    /Maximum 20 questions allowed/,
    'Should throw error when publishing with more than 20 questions'
  );
});

test('Rule 5: Student question view strips isCorrect and hidden test cases', async () => {
  const admin = await User.findOne({ role: 'admin' });
  const question = new Question({
    testId: new mongoose.Types.ObjectId(),
    type: 'coding',
    title: 'Secret Question',
    description: 'Solve this',
    marks: 10,
    explanation: 'Secret teacher explanation',
    codingData: {
      allowedLanguages: ['python'],
      starterCode: { python: 'print(1)' },
      sampleTestCases: [{ input: '1', expectedOutput: '1' }],
      hiddenTestCases: [{ input: '999', expectedOutput: 'Secret Answer' }],
    },
  });

  const studentView = question.toStudentView();
  assert.strictEqual(studentView.codingData.hiddenTestCases, undefined, 'Hidden test cases MUST be stripped for student');
  assert.strictEqual(studentView.explanation, undefined, 'Teacher explanation MUST be stripped for student');
  assert.strictEqual(studentView.codingData.sampleTestCases.length, 1, 'Sample test cases should be preserved');
});

test('Rule 6: Python code execution in sandbox produces expected results', async () => {
  const pythonCode = `import sys
lines = sys.stdin.read().strip().split()
if lines:
    a, b = int(lines[0]), int(lines[1])
    print(a + b)
`;
  const testCases = [
    { input: '10 25', expectedOutput: '35', isSample: true },
    { input: '100 -40', expectedOutput: '60', isSample: false },
  ];

  const evalResult = await evaluateTestCases({
    language: 'python',
    code: pythonCode,
    testCases,
    timeLimit: 3,
  });

  assert.strictEqual(evalResult.passedCount, 2, 'Both test cases should pass');
  assert.strictEqual(evalResult.results[0].passed, true);
  assert.strictEqual(evalResult.results[1].passed, true);
});
