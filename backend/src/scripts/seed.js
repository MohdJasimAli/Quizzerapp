require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Test = require('../models/Test');
const Question = require('../models/Question');
const TestAttempt = require('../models/TestAttempt');
const Result = require('../models/Result');
const ActivityLog = require('../models/ActivityLog');

const seedData = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/kairos_test_platform';
    await mongoose.connect(mongoUri);
    console.log(`Connected to MongoDB for seeding: ${mongoUri}`);

    // Clear existing collections
    await User.deleteMany({});
    await Test.deleteMany({});
    await Question.deleteMany({});
    await TestAttempt.deleteMany({});
    await Result.deleteMany({});
    await ActivityLog.deleteMany({});

    console.log('Cleared existing collections.');

    // 1. Create Users
    const admin = await User.create({
      name: 'Kairos Club Administrator',
      email: 'admin@kairos.edu',
      password: 'Admin@12345',
      role: 'admin',
      department: 'Computer Science & Engineering',
      batch: 'Faculty Advisor',
      isActive: true,
    });

    const teacher1 = await User.create({
      name: 'Prof. Alan Turing',
      email: 'teacher@kairos.edu',
      password: 'Teacher@12345',
      role: 'teacher',
      department: 'Computer Science & Engineering',
      batch: 'Senior Lecturer',
      isActive: true,
    });

    const teacher2 = await User.create({
      name: 'Dr. Neha Sharma',
      email: 'dr.sharma@kairos.edu',
      password: 'Teacher@12345',
      role: 'teacher',
      department: 'Information Technology',
      batch: 'Associate Professor',
      isActive: true,
    });

    const student1 = await User.create({
      name: 'Alex Mercer',
      email: 'student1@kairos.edu',
      password: 'Student@12345',
      role: 'student',
      department: 'Computer Science & Engineering',
      rollNumber: 'CSE-2024-001',
      batch: '2024-2028',
      isActive: true,
    });

    const student2 = await User.create({
      name: 'Sophia Chen',
      email: 'student2@kairos.edu',
      password: 'Student@12345',
      role: 'student',
      department: 'Computer Science & Engineering',
      rollNumber: 'CSE-2024-042',
      batch: '2024-2028',
      isActive: true,
    });

    const student3 = await User.create({
      name: 'Rahul Verma',
      email: 'student3@kairos.edu',
      password: 'Student@12345',
      role: 'student',
      department: 'Information Technology',
      rollNumber: 'IT-2024-089',
      batch: '2024-2028',
      isActive: true,
    });

    console.log('Users created:');
    console.log('  Admin:    admin@kairos.edu / Admin@12345');
    console.log('  Teacher:  teacher@kairos.edu / Teacher@12345');
    console.log('  Student1: student1@kairos.edu / Student@12345');
    console.log('  Student2: student2@kairos.edu / Student@12345');

    // 2. Create Test 1: Kairos Club Annual Assessment (Mixed, 5 Questions, Published)
    const now = new Date();
    const startTime = new Date(now.getTime() - 2 * 60 * 60 * 1000); // started 2 hours ago
    const endTime = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // ends in 7 days

    const test1 = await Test.create({
      title: 'Kairos Club Technical Assessment 2026',
      description: 'Comprehensive entrance assessment for Kairos Technical Club. Covers Core Computer Science principles, Data Structures, and Algorithmic problem-solving.',
      subject: 'Data Structures & Algorithms',
      instructions: '1. This test consists of 3 MCQs and 2 Coding challenges.\n2. Total duration is 45 minutes.\n3. Full-screen mode is strictly monitored.\n4. Do not switch tabs or minimize the browser window. Repeated violations will flag your attempt for review.\n5. Monaco Editor is equipped with Python, Java, C, and C++ compilers.',
      duration: 45,
      startTime,
      endTime,
      testType: 'mixed',
      status: 'published',
      isPublished: true,
      publishedAt: now,
      createdBy: teacher1._id,
      assignedTeacher: teacher1._id,
      maxAttempts: 1,
      navigationMode: 'free',
      hasNegativeMarking: true,
      negativeMarkValue: 1,
      randomizeQuestions: false,
      randomizeOptions: false,
      releaseResultsMode: 'manual',
      isResultsReleased: true, // Released for demo review
      resultsReleasedAt: now,
      integrityPolicy: {
        warningLimit: 3,
        actionOnLimit: 'flag_for_review',
        requireFullscreen: true,
        detectTabSwitch: true,
        requireCamera: true,
        requireRetinaTracking: true,
      },
      targetGroups: ['All Students'],
    });

    // Create 5 questions for Test 1 (meets >= 5 questions rule)
    const q1 = await Question.create({
      testId: test1._id,
      type: 'mcq',
      title: 'Time Complexity of Binary Search',
      description: 'What is the worst-case time complexity of searching an element in a sorted array of size $N$ using the Binary Search algorithm?',
      marks: 4,
      difficulty: 'easy',
      explanation: 'Binary Search halves the search space in each step, leading to logarithmic complexity O(log N).',
      order: 1,
      mcqData: {
        negativeMarks: 1,
        options: [
          { id: 'opt_1', text: 'O(N)', isCorrect: false },
          { id: 'opt_2', text: 'O(log N)', isCorrect: true },
          { id: 'opt_3', text: 'O(N log N)', isCorrect: false },
          { id: 'opt_4', text: 'O(1)', isCorrect: false },
        ],
      },
    });

    const q2 = await Question.create({
      testId: test1._id,
      type: 'mcq',
      title: 'HTTP Status Code for Unauthorized Access',
      description: 'Which HTTP status code is officially returned by REST APIs when authentication credentials are missing or invalid?',
      marks: 4,
      difficulty: 'easy',
      explanation: 'HTTP 401 Unauthorized indicates that the request requires user authentication credentials.',
      order: 2,
      mcqData: {
        negativeMarks: 1,
        options: [
          { id: 'opt_1', text: '400 Bad Request', isCorrect: false },
          { id: 'opt_2', text: '401 Unauthorized', isCorrect: true },
          { id: 'opt_3', text: '403 Forbidden', isCorrect: false },
          { id: 'opt_4', text: '404 Not Found', isCorrect: false },
        ],
      },
    });

    const q3 = await Question.create({
      testId: test1._id,
      type: 'mcq',
      title: 'Memory Stack vs Heap Allocation',
      description: 'In C/C++ and modern systems, where are local primitive function variables and function call frames typically allocated?',
      marks: 6,
      difficulty: 'medium',
      explanation: 'Local variables and stack frames are allocated on the Call Stack in LIFO order.',
      order: 3,
      mcqData: {
        negativeMarks: 1.5,
        options: [
          { id: 'opt_1', text: 'Heap Memory', isCorrect: false },
          { id: 'opt_2', text: 'Stack Memory', isCorrect: true },
          { id: 'opt_3', text: 'Data Segment (BSS)', isCorrect: false },
          { id: 'opt_4', text: 'Read-Only Memory', isCorrect: false },
        ],
      },
    });

    const q4 = await Question.create({
      testId: test1._id,
      type: 'coding',
      title: 'Two Sum Problem',
      description: `### Problem Description
Given a list of space-separated integers and a target integer on the next line, find the indices (0-based) of the two numbers such that they add up to the target.

### Input Format
- Line 1: Space-separated integers representing the array.
- Line 2: A single integer $T$ (Target sum).

### Output Format
Print the two 0-based indices separated by a space in ascending order. (Assume exactly one valid pair exists).`,
      marks: 10,
      difficulty: 'medium',
      order: 4,
      codingData: {
        allowedLanguages: ['python', 'java', 'c', 'cpp'],
        starterCode: {
          python: `import sys

def two_sum():
    lines = sys.stdin.read().strip().split('\\n')
    if not lines or len(lines) < 2:
        return
    nums = list(map(int, lines[0].strip().split()))
    target = int(lines[1].strip())
    
    seen = {}
    for i, num in enumerate(nums):
        diff = target - num
        if diff in seen:
            print(f"{seen[diff]} {i}")
            return
        seen[num] = i

if __name__ == '__main__':
    two_sum()
`,
          java: `import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        if (!sc.hasNextLine()) return;
        String[] parts = sc.nextLine().trim().split("\\\\s+");
        int target = sc.nextInt();
        int[] nums = new int[parts.length];
        for (int i = 0; i < parts.length; i++) nums[i] = Integer.parseInt(parts[i]);
        
        Map<Integer, Integer> map = new HashMap<>();
        for (int i = 0; i < nums.length; i++) {
            int complement = target - nums[i];
            if (map.containsKey(complement)) {
                System.out.println(map.get(complement) + " " + i);
                return;
            }
            map.put(nums[i], i);
        }
    }
}
`,
          c: `#include <stdio.h>
#include <stdlib.h>

int main() {
    int arr[1000];
    int n = 0;
    while (scanf("%d", &arr[n]) == 1) {
        n++;
        char c = getchar();
        if (c == '\\n' || c == EOF) break;
    }
    int target;
    if (scanf("%d", &target) != 1) return 0;

    for (int i = 0; i < n; i++) {
        for (int j = i + 1; j < n; j++) {
            if (arr[i] + arr[j] == target) {
                printf("%d %d\\n", i, j);
                return 0;
            }
        }
    }
    return 0;
}
`,
          cpp: `#include <iostream>
#include <vector>
#include <unordered_map>
#include <sstream>
using namespace std;

int main() {
    string line;
    if (!getline(cin, line)) return 0;
    stringstream ss(line);
    vector<int> nums;
    int val;
    while (ss >> val) nums.push_back(val);
    int target;
    if (!(cin >> target)) return 0;

    unordered_map<int, int> seen;
    for (int i = 0; i < (int)nums.size(); i++) {
        int diff = target - nums[i];
        if (seen.count(diff)) {
            cout << seen[diff] << " " << i << "\\n";
            return 0;
        }
        seen[nums[i]] = i;
    }
    return 0;
}
`,
        },
        sampleTestCases: [
          {
            input: '2 7 11 15\n9',
            expectedOutput: '0 1',
            explanation: 'nums[0] + nums[1] = 2 + 7 = 9.',
          },
          {
            input: '3 2 4\n6',
            expectedOutput: '1 2',
            explanation: 'nums[1] + nums[2] = 2 + 4 = 6.',
          },
        ],
        hiddenTestCases: [
          {
            input: '3 3\n6',
            expectedOutput: '0 1',
            marksWeight: 1,
          },
          {
            input: '1 5 8 12 19 23\n27',
            expectedOutput: '2 4',
            marksWeight: 1,
          },
        ],
        timeLimit: 2,
        memoryLimit: 256,
      },
    });

    const q5 = await Question.create({
      testId: test1._id,
      type: 'coding',
      title: 'Palindrome String Checker',
      description: `### Problem Description
Write a program that takes a single line string, converts all uppercase letters into lowercase letters, removes all non-alphanumeric characters, and checks if it reads the same forward and backward.

### Input Format
A single line containing the string $S$.

### Output Format
Print \`true\` if it is a palindrome, otherwise print \`false\`.`,
      marks: 16,
      difficulty: 'hard',
      order: 5,
      codingData: {
        allowedLanguages: ['python', 'java', 'c', 'cpp'],
        starterCode: {
          python: `import sys
import re

def is_palindrome():
    s = sys.stdin.read().strip()
    cleaned = re.sub(r'[^a-zA-Z0-9]', '', s).lower()
    if cleaned == cleaned[::-1]:
        print("true")
    else:
        print("false")

if __name__ == '__main__':
    is_palindrome()
`,
          java: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        if (!sc.hasNextLine()) {
            System.out.println("true");
            return;
        }
        String s = sc.nextLine().replaceAll("[^a-zA-Z0-9]", "").toLowerCase();
        String rev = new StringBuilder(s).reverse().toString();
        System.out.println(s.equals(rev) ? "true" : "false");
    }
}
`,
          c: `#include <stdio.h>
#include <ctype.h>
#include <string.h>

int main() {
    char s[2000];
    if (!fgets(s, sizeof(s), stdin)) {
        printf("true\\n");
        return 0;
    }
    char clean[2000];
    int len = 0;
    for (int i = 0; s[i] != '\\0'; i++) {
        if (isalnum((unsigned char)s[i])) {
            clean[len++] = tolower((unsigned char)s[i]);
        }
    }
    for (int i = 0; i < len / 2; i++) {
        if (clean[i] != clean[len - 1 - i]) {
            printf("false\\n");
            return 0;
        }
    }
    printf("true\\n");
    return 0;
}
`,
          cpp: `#include <iostream>
#include <string>
#include <cctype>
#include <algorithm>
using namespace std;

int main() {
    string s;
    if (!getline(cin, s)) {
        cout << "true\\n";
        return 0;
    }
    string clean = "";
    for (char c : s) {
        if (isalnum((unsigned char)c)) clean += tolower((unsigned char)c);
    }
    string rev = clean;
    reverse(rev.begin(), rev.end());
    cout << (clean == rev ? "true" : "false") << "\\n";
    return 0;
}
`,
        },
        sampleTestCases: [
          {
            input: 'A man, a plan, a canal: Panama',
            expectedOutput: 'true',
            explanation: '"amanaplanacanalpanama" is a palindrome.',
          },
          {
            input: 'race a car',
            expectedOutput: 'false',
            explanation: '"raceacar" is not a palindrome.',
          },
        ],
        hiddenTestCases: [
          {
            input: ' ',
            expectedOutput: 'true',
            marksWeight: 1,
          },
          {
            input: '0P',
            expectedOutput: 'false',
            marksWeight: 1,
          },
          {
            input: 'Was it a car or a cat I saw?',
            expectedOutput: 'true',
            marksWeight: 1,
          },
        ],
        timeLimit: 2,
        memoryLimit: 256,
      },
    });

    const test1Questions = [q1._id, q2._id, q3._id, q4._id, q5._id];
    const test1TotalMarks = q1.marks + q2.marks + q3.marks + q4.marks + q5.marks; // 4 + 4 + 6 + 10 + 16 = 40
    test1.questions = test1Questions;
    test1.totalMarks = test1TotalMarks;
    test1.questionCount = test1Questions.length;
    await test1.save();

    // 3. Create Sample Completed Attempt for Student 2 (Sophia Chen)
    const att2StartTime = new Date(now.getTime() - 40 * 60 * 1000);
    const att2SubmittedAt = new Date(now.getTime() - 5 * 60 * 1000);

    const attempt2 = await TestAttempt.create({
      testId: test1._id,
      studentId: student2._id,
      attemptNumber: 1,
      startTime: att2StartTime,
      deadline: new Date(att2StartTime.getTime() + 45 * 60 * 1000),
      submittedAt: att2SubmittedAt,
      status: 'submitted',
      submissionReason: 'manual_submit',
      mcqAnswers: [
        { questionId: q1._id, selectedOptionId: 'opt_2', isFlagged: false },
        { questionId: q2._id, selectedOptionId: 'opt_2', isFlagged: false },
        { questionId: q3._id, selectedOptionId: 'opt_2', isFlagged: false },
      ],
      codingAnswers: [
        {
          questionId: q4._id,
          language: 'python',
          code: q4.codingData.starterCode.python,
          isFlagged: false,
        },
        {
          questionId: q5._id,
          language: 'python',
          code: q5.codingData.starterCode.python,
          isFlagged: false,
        },
      ],
      integrityEvents: [
        {
          eventType: 'tab_switch',
          timestamp: new Date(att2StartTime.getTime() + 10 * 60 * 1000),
          details: 'Switched to browser documentation tab',
        },
      ],
      violationCount: 1,
      isFlaggedForReview: false,
    });

    await Result.create({
      attemptId: attempt2._id,
      testId: test1._id,
      studentId: student2._id,
      totalMarksObtained: 40,
      maxMarks: 40,
      percentage: 100,
      isPassed: true,
      mcqScore: 14,
      codingScore: 26,
      questionEvaluations: [
        {
          questionId: q1._id,
          questionType: 'mcq',
          questionTitle: q1.title,
          allocatedMarks: 4,
          marksAwarded: 4,
          isEvaluated: true,
          mcqSelectedOption: 'opt_2',
          mcqCorrectOption: 'opt_2',
          mcqIsCorrect: true,
        },
        {
          questionId: q2._id,
          questionType: 'mcq',
          questionTitle: q2.title,
          allocatedMarks: 4,
          marksAwarded: 4,
          isEvaluated: true,
          mcqSelectedOption: 'opt_2',
          mcqCorrectOption: 'opt_2',
          mcqIsCorrect: true,
        },
        {
          questionId: q3._id,
          questionType: 'mcq',
          questionTitle: q3.title,
          allocatedMarks: 6,
          marksAwarded: 6,
          isEvaluated: true,
          mcqSelectedOption: 'opt_2',
          mcqCorrectOption: 'opt_2',
          mcqIsCorrect: true,
        },
        {
          questionId: q4._id,
          questionType: 'coding',
          questionTitle: q4.title,
          allocatedMarks: 10,
          marksAwarded: 10,
          isEvaluated: true,
          codingLanguage: 'python',
          codingCode: q4.codingData.starterCode.python,
          testCasesTotal: 4,
          testCasesPassed: 4,
          testCasesDetails: [
            { testCaseIndex: 1, isSample: true, passed: true, input: '2 7 11 15\n9', expectedOutput: '0 1', actualOutput: '0 1' },
            { testCaseIndex: 2, isSample: true, passed: true, input: '3 2 4\n6', expectedOutput: '1 2', actualOutput: '1 2' },
            { testCaseIndex: 3, isSample: false, passed: true, input: '3 3\n6', expectedOutput: '0 1', actualOutput: '0 1' },
            { testCaseIndex: 4, isSample: false, passed: true, input: '1 5 8 12 19 23\n27', expectedOutput: '2 4', actualOutput: '2 4' },
          ],
        },
        {
          questionId: q5._id,
          questionType: 'coding',
          questionTitle: q5.title,
          allocatedMarks: 16,
          marksAwarded: 16,
          isEvaluated: true,
          codingLanguage: 'python',
          codingCode: q5.codingData.starterCode.python,
          testCasesTotal: 5,
          testCasesPassed: 5,
          testCasesDetails: [
            { testCaseIndex: 1, isSample: true, passed: true, input: 'A man, a plan, a canal: Panama', expectedOutput: 'true', actualOutput: 'true' },
            { testCaseIndex: 2, isSample: true, passed: true, input: 'race a car', expectedOutput: 'false', actualOutput: 'false' },
            { testCaseIndex: 3, isSample: false, passed: true, input: ' ', expectedOutput: 'true', actualOutput: 'true' },
            { testCaseIndex: 4, isSample: false, passed: true, input: '0P', expectedOutput: 'false', actualOutput: 'false' },
            { testCaseIndex: 5, isSample: false, passed: true, input: 'Was it a car or a cat I saw?', expectedOutput: 'true', actualOutput: 'true' },
          ],
          teacherFeedback: 'Outstanding logic and clean implementation!',
        },
      ],
      isReleased: true,
      releasedAt: now,
      evaluatedAt: now,
      evaluatedBy: teacher1._id,
    });

    await ActivityLog.create({
      testId: test1._id,
      studentId: student2._id,
      attemptId: attempt2._id,
      eventType: 'tab_switch',
      severity: 'warning',
      details: { violationCount: 1, details: 'Switched window or lost focus' },
      timestamp: new Date(att2StartTime.getTime() + 10 * 60 * 1000),
    });

    // 4. Create Test 2: MCQ Sprint (MCQ, 5 Questions, Published)
    const test2 = await Test.create({
      title: 'Computer Networks & Operating Systems MCQ Sprint',
      description: 'Quick-fire objective examination on OSI stack, TCP/IP protocols, process scheduling, and concurrency.',
      subject: 'Operating Systems & Networks',
      instructions: 'Answer all 5 questions. Navigation is unrestricted. Negative marks apply for wrong choices.',
      duration: 30,
      startTime: new Date(now.getTime() - 10 * 60 * 1000),
      endTime: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
      testType: 'mcq',
      status: 'published',
      isPublished: true,
      publishedAt: now,
      createdBy: teacher2._id,
      assignedTeacher: teacher2._id,
      maxAttempts: 1,
      navigationMode: 'free',
      hasNegativeMarking: true,
      negativeMarkValue: 1,
      randomizeQuestions: true,
      randomizeOptions: true,
      releaseResultsMode: 'manual',
      isResultsReleased: false,
      integrityPolicy: {
        warningLimit: 3,
        actionOnLimit: 'flag_for_review',
        requireFullscreen: true,
        detectTabSwitch: true,
        requireCamera: true,
        requireRetinaTracking: true,
      },
    });

    const netQuestions = [];
    const netQData = [
      {
        title: 'Transport Layer Protocol with Guaranteed Delivery',
        desc: 'Which Transport Layer protocol guarantees reliable, ordered, and error-checked delivery of a stream of octets?',
        marks: 5,
        opts: [
          { id: 'o1', text: 'UDP (User Datagram Protocol)', isCorrect: false },
          { id: 'o2', text: 'TCP (Transmission Control Protocol)', isCorrect: true },
          { id: 'o3', text: 'ICMP', isCorrect: false },
          { id: 'o4', text: 'IP (Internet Protocol)', isCorrect: false },
        ],
      },
      {
        title: 'Process Scheduling: Starvation Prevention',
        desc: 'Which scheduling technique prevents process starvation by gradually increasing the priority of processes waiting in the ready queue?',
        marks: 5,
        opts: [
          { id: 'o1', text: 'Aging', isCorrect: true },
          { id: 'o2', text: 'Context Switching', isCorrect: false },
          { id: 'o3', text: 'Preemption', isCorrect: false },
          { id: 'o4', text: 'Belady\'s Anomaly', isCorrect: false },
        ],
      },
      {
        title: 'Default Port for Secure HTTPS',
        desc: 'Which standard TCP port is assigned for HTTPS (Hypertext Transfer Protocol Secure)?',
        marks: 5,
        opts: [
          { id: 'o1', text: '80', isCorrect: false },
          { id: 'o2', text: '8080', isCorrect: false },
          { id: 'o3', text: '443', isCorrect: true },
          { id: 'o4', text: '22', isCorrect: false },
        ],
      },
      {
        title: 'Banker\'s Algorithm Purpose',
        desc: 'In operating systems, Dijkstra\'s Banker\'s Algorithm is specifically used for:',
        marks: 5,
        opts: [
          { id: 'o1', text: 'Deadlock Detection', isCorrect: false },
          { id: 'o2', text: 'Deadlock Avoidance', isCorrect: true },
          { id: 'o3', text: 'Memory Paging', isCorrect: false },
          { id: 'o4', text: 'Disk Scheduling', isCorrect: false },
        ],
      },
      {
        title: 'DNS Resolution Protocol',
        desc: 'DNS query resolution between client and server typically uses which transport layer protocol for standard lookups?',
        marks: 5,
        opts: [
          { id: 'o1', text: 'UDP Port 53', isCorrect: true },
          { id: 'o2', text: 'TCP Port 25', isCorrect: false },
          { id: 'o3', text: 'HTTP Port 80', isCorrect: false },
          { id: 'o4', text: 'FTP Port 21', isCorrect: false },
        ],
      },
    ];

    for (let i = 0; i < netQData.length; i++) {
      const q = await Question.create({
        testId: test2._id,
        type: 'mcq',
        title: netQData[i].title,
        description: netQData[i].desc,
        marks: netQData[i].marks,
        difficulty: 'medium',
        order: i + 1,
        mcqData: {
          negativeMarks: 1,
          options: netQData[i].opts,
        },
      });
      netQuestions.push(q._id);
    }

    test2.questions = netQuestions;
    test2.totalMarks = 25;
    test2.questionCount = 5;
    await test2.save();

    // 5. Create Test 3: Draft Test with 3 questions (to test validation)
    const test3 = await Test.create({
      title: 'Python Workshop Skills Challenge (Draft)',
      description: 'Hands-on practical python coding challenge under development by instructors.',
      subject: 'Python Programming',
      instructions: 'Complete all assigned coding tasks.',
      duration: 60,
      startTime: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      endTime: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      testType: 'coding',
      status: 'draft',
      isPublished: false,
      createdBy: teacher1._id,
      assignedTeacher: teacher1._id,
      totalMarks: 30,
      questionCount: 3,
    });

    const draftQ1 = await Question.create({
      testId: test3._id,
      type: 'coding',
      title: 'Fibonacci Generator',
      description: 'Print the $N$-th Fibonacci number.',
      marks: 10,
      codingData: {
        allowedLanguages: ['python'],
        starterCode: { python: 'def fib(): pass' },
        sampleTestCases: [{ input: '5', expectedOutput: '5' }],
      },
    });

    const draftQ2 = await Question.create({
      testId: test3._id,
      type: 'coding',
      title: 'Prime Number Sieve',
      description: 'Print all primes up to $N$.',
      marks: 10,
      codingData: {
        allowedLanguages: ['python'],
        starterCode: { python: 'def primes(): pass' },
        sampleTestCases: [{ input: '10', expectedOutput: '2 3 5 7' }],
      },
    });

    const draftQ3 = await Question.create({
      testId: test3._id,
      type: 'coding',
      title: 'Matrix Transpose',
      description: 'Compute transpose of $N \\times M$ matrix.',
      marks: 10,
      codingData: {
        allowedLanguages: ['python'],
        starterCode: { python: 'def transpose(): pass' },
        sampleTestCases: [{ input: '1 2\n3 4', expectedOutput: '1 3\n2 4' }],
      },
    });

    test3.questions = [draftQ1._id, draftQ2._id, draftQ3._id];
    await test3.save();

    console.log('Seed completed successfully!');
    console.log(`- Created ${await User.countDocuments()} users`);
    console.log(`- Created ${await Test.countDocuments()} tests`);
    console.log(`- Created ${await Question.countDocuments()} questions`);
    console.log(`- Created ${await TestAttempt.countDocuments()} sample attempts`);
    console.log(`- Created ${await Result.countDocuments()} sample results`);

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
};

seedData();
