require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Test = require('../models/Test');
const Question = require('../models/Question');

const createDemoTest = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/kairos_test_platform';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    // Find teacher Alan Turing or create admin as creator
    let teacher = await User.findOne({ role: 'teacher' });
    if (!teacher) {
      teacher = await User.findOne({ role: 'admin' });
    }

    // Remove any previous demo test with this title to allow clean idempotency
    const title = '🚀 KAIROS LIVE DEMO TEST — Camera, Retina Tracking & Instant Score';
    const existing = await Test.findOne({ title });
    if (existing) {
      await Question.deleteMany({ testId: existing._id });
      await Test.deleteOne({ _id: existing._id });
      console.log('Cleared previous demo test');
    }

    const now = new Date();
    const startTime = new Date(now.getTime() - 10 * 60 * 1000); // 10 mins ago
    const endTime = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days ahead

    const demoTest = await Test.create({
      title,
      description: 'Hands-on interactive demo test designed for testing webcam access, real-time retina eye-gaze tracking, Monaco editor code execution, and instant scorecard generation upon submission.',
      subject: 'Kairos Club Interactive Live Demo',
      instructions: '1. Camera and Retina Proctoring: Active webcam access is mandatory. Please align your face in the preview box.\n2. Eye-Gaze Monitoring: The proctor monitors retina alignment in real time. Looking away from the screen for over 3 seconds triggers an immediate kick-out with 0 marks.\n3. Attempt Limit: Configured with 99 attempts for continuous testing.\n4. Instant Evaluation: All answers and code submissions are graded immediately upon submission.',
      duration: 15,
      startTime,
      endTime,
      testType: 'mixed',
      status: 'published',
      isPublished: true,
      publishedAt: now,
      createdBy: teacher._id,
      assignedTeacher: teacher._id,
      maxAttempts: 99,
      navigationMode: 'free',
      hasNegativeMarking: true,
      negativeMarkValue: 1,
      randomizeQuestions: false,
      randomizeOptions: false,
      releaseResultsMode: 'immediate',
      isResultsReleased: true,
      resultsReleasedAt: now,
      integrityPolicy: {
        warningLimit: 3,
        actionOnLimit: 'auto_submit',
        requireFullscreen: true,
        detectTabSwitch: true,
        requireCamera: true,
        requireRetinaTracking: true,
      },
      targetGroups: ['All Students'],
    });

    // Question 1: MCQ - Starvation Prevention
    const q1 = await Question.create({
      testId: demoTest._id,
      type: 'mcq',
      title: 'Starvation Prevention in Process Scheduling',
      description: 'Which process scheduling technique dynamically elevates the priority of processes waiting for a long duration in the ready queue to prevent starvation?',
      marks: 5,
      difficulty: 'easy',
      explanation: 'Aging gradually increases the priority of waiting processes over time, ensuring they eventually execute.',
      order: 1,
      options: [
        { id: 'opt1', text: 'Aging Algorithm', isCorrect: true },
        { id: 'opt2', text: 'Shortest Job First (SJF)', isCorrect: false },
        { id: 'opt3', text: 'Round Robin without preemption', isCorrect: false },
        { id: 'opt4', text: 'First-Come First-Served (FCFS)', isCorrect: false },
      ],
    });

    // Question 2: MCQ - Balanced Tree Search Time Complexity
    const q2 = await Question.create({
      testId: demoTest._id,
      type: 'mcq',
      title: 'Time Complexity of Balanced BST Search',
      description: 'What is the worst-case time complexity of searching an element in a balanced Binary Search Tree (such as an AVL or Red-Black Tree) containing N nodes?',
      marks: 5,
      difficulty: 'easy',
      explanation: 'Balanced BSTs maintain a height of O(log N), guaranteeing logarithmic search time.',
      order: 2,
      options: [
        { id: 'opt1', text: 'O(N)', isCorrect: false },
        { id: 'opt2', text: 'O(log N)', isCorrect: true },
        { id: 'opt3', text: 'O(1)', isCorrect: false },
        { id: 'opt4', text: 'O(N log N)', isCorrect: false },
      ],
    });

    // Question 3: MCQ - Retina Tracking Mechanism
    const q3 = await Question.create({
      testId: demoTest._id,
      type: 'mcq',
      title: 'Browser Retina Eye-Gaze Tracking Principle',
      description: 'In the Kairos Test proctoring engine, how is horizontal retina gaze deviation (looking away left or right from the screen) computed?',
      marks: 5,
      difficulty: 'medium',
      explanation: 'Kairos Test measures the proportional displacement of the pupil/iris center relative to the inner and outer eye corners in real time.',
      order: 3,
      options: [
        { id: 'opt1', text: 'Proportional displacement of iris/pupil center between inner and outer eye corners', isCorrect: true },
        { id: 'opt2', text: 'Audio spectrum analysis via microphone', isCorrect: false },
        { id: 'opt3', text: 'Mouse cursor movement velocity', isCorrect: false },
        { id: 'opt4', text: 'Battery discharge rate monitor', isCorrect: false },
      ],
    });

    // Question 4: Coding - Factorial
    const q4 = await Question.create({
      testId: demoTest._id,
      type: 'coding',
      title: 'Factorial Calculation',
      description: 'Write a Python program that reads an integer N from standard input and prints N! (the factorial of N). Note that 0! = 1.',
      marks: 10,
      difficulty: 'easy',
      order: 4,
      codingData: {
        allowedLanguages: ['python', 'cpp', 'java', 'c'],
        starterCode: {
          python: 'import sys\n\ndef factorial(n):\n    # Write your solution here\n    if n <= 1:\n        return 1\n    return n * factorial(n - 1)\n\nif __name__ == "__main__":\n    lines = sys.stdin.read().strip().split()\n    if lines:\n        val = int(lines[0])\n        print(factorial(val))\n',
          cpp: '#include <iostream>\nusing namespace std;\n\nlong long factorial(int n) {\n    if (n <= 1) return 1;\n    return n * factorial(n - 1);\n}\n\nint main() {\n    int n;\n    if (cin >> n) {\n        cout << factorial(n) << endl;\n    }\n    return 0;\n}\n',
          java: 'import java.util.Scanner;\n\npublic class Solution {\n    public static long factorial(int n) {\n        if (n <= 1) return 1;\n        return n * factorial(n - 1);\n    }\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        if (sc.hasNextInt()) {\n            System.out.println(factorial(sc.nextInt()));\n        }\n    }\n}\n',
          c: '#include <stdio.h>\n\nlong long factorial(int n) {\n    if (n <= 1) return 1;\n    return n * factorial(n - 1);\n}\n\nint main() {\n    int n;\n    if (scanf("%d", &n) == 1) {\n        printf("%lld\\n", factorial(n));\n    }\n    return 0;\n}\n',
        },
        sampleTestCases: [
          {
            input: '5',
            expectedOutput: '120',
            explanation: '5! = 5 * 4 * 3 * 2 * 1 = 120',
          },
        ],
        hiddenTestCases: [
          {
            input: '0',
            expectedOutput: '1',
          },
          {
            input: '7',
            expectedOutput: '5040',
          },
        ],
        timeLimit: 2,
        memoryLimit: 128,
        scoringStrategy: 'proportional',
      },
    });

    // Question 5: Coding - Palindrome String Checker
    const q5 = await Question.create({
      testId: demoTest._id,
      type: 'coding',
      title: 'Alphanumeric Palindrome Validator',
      description: 'Write a program that reads a string from standard input and determines whether it is a palindrome. Consider only alphanumeric characters and ignore case.\nPrint `True` if it is a palindrome, otherwise print `False`.',
      marks: 15,
      difficulty: 'medium',
      order: 5,
      codingData: {
        allowedLanguages: ['python', 'cpp', 'java', 'c'],
        starterCode: {
          python: 'import sys\n\ndef is_palindrome(s):\n    cleaned = "".join(c.lower() for c in s if c.isalnum())\n    return cleaned == cleaned[::-1]\n\nif __name__ == "__main__":\n    raw = sys.stdin.read().strip()\n    print(is_palindrome(raw))\n',
          cpp: '#include <iostream>\n#include <string>\n#include <cctype>\nusing namespace std;\n\nint main() {\n    string s, clean = "";\n    getline(cin, s);\n    for (char c : s) {\n        if (isalnum(c)) clean += tolower(c);\n    }\n    string rev = clean;\n    for (int i = 0; i < rev.length() / 2; i++) {\n        swap(rev[i], rev[rev.length() - 1 - i]);\n    }\n    if (clean == rev) cout << "True" << endl;\n    else cout << "False" << endl;\n    return 0;\n}\n',
          java: 'import java.util.Scanner;\n\npublic class Solution {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        String s = sc.hasNextLine() ? sc.nextLine() : "";\n        StringBuilder sb = new StringBuilder();\n        for (char c : s.toCharArray()) {\n            if (Character.isLetterOrDigit(c)) sb.append(Character.toLowerCase(c));\n        }\n        String clean = sb.toString();\n        String rev = sb.reverse().toString();\n        System.out.println(clean.equals(rev) ? "True" : "False");\n    }\n}\n',
          c: '#include <stdio.h>\n#include <string.h>\n#include <ctype.h>\n\nint main() {\n    char s[1000], clean[1000];\n    if (!fgets(s, sizeof(s), stdin)) return 0;\n    int j = 0;\n    for (int i = 0; s[i]; i++) {\n        if (isalnum(s[i])) clean[j++] = tolower(s[i]);\n    }\n    clean[j] = \'\\0\';\n    int isPal = 1;\n    for (int i = 0; i < j / 2; i++) {\n        if (clean[i] != clean[j - 1 - i]) { isPal = 0; break; }\n    }\n    printf("%s\\n", isPal ? "True" : "False");\n    return 0;\n}\n',
        },
        sampleTestCases: [
          {
            input: 'racecar',
            expectedOutput: 'True',
            explanation: 'racecar spelled backwards is racecar',
          },
        ],
        hiddenTestCases: [
          {
            input: 'A man a plan a canal Panama',
            expectedOutput: 'True',
          },
          {
            input: 'Kairos Club Examination',
            expectedOutput: 'False',
          },
        ],
        timeLimit: 2,
        memoryLimit: 128,
        scoringStrategy: 'proportional',
      },
    });

    // Update Test with question IDs and total marks
    demoTest.questions = [q1._id, q2._id, q3._id, q4._id, q5._id];
    demoTest.questionCount = 5;
    demoTest.totalMarks = 5 + 5 + 5 + 10 + 15; // 40
    await demoTest.save();

    console.log('Successfully created Demo Test:');
    console.log('  Title:', demoTest.title);
    console.log('  ID:', demoTest._id);
    console.log('  Total Marks:', demoTest.totalMarks);
    console.log('  Questions:', demoTest.questionCount);
    console.log('  Max Attempts:', demoTest.maxAttempts);
    console.log('  Integrity Policy:', demoTest.integrityPolicy);

    process.exit(0);
  } catch (err) {
    console.error('Error creating demo test:', err);
    process.exit(1);
  }
};

createDemoTest();
