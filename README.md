# KAIROS TEST &mdash; Kairos Club Online Examination & Assessment Platform

> A production-minded, responsive, and secure online examination and coding assessment platform engineered for **Kairos Club**, college workshops, hackathons, MCQ sprint exams, and competitive programming assessments.

---

## 🚀 Key Features

### 1. Robust Role-Based Access Control (RBAC)
- **Admin**:
  - Global dashboard with platform KPIs (students, faculty, tests, attempts, integrity alerts).
  - Manage faculty and teachers (create, edit, deactivate).
  - Manage student accounts (enrollment, batch assignment, account status).
  - Create, schedule, edit, and delete tests.
  - Review timestamped integrity violation audit logs.
  - Export test performance reports as CSV.
- **Teacher / Faculty**:
  - Assigned tests management (drafts and published tests).
  - Test Builder supporting MCQ, Coding, or Mixed formats.
  - **Strict 5 to 20 Question Validation**: Both backend and frontend enforce that tests must contain between 5 and 20 questions inclusive to be published.
  - **Independent Question Marks**: Instructors assign custom marks per question (different marks for different questions). Maximum test marks are auto-calculated from the sum of question marks.
  - Full Test Preview before publishing.
  - Submissions & grading review with manual mark overrides and feedback.
  - Toggle result publication (immediate vs. manual release).
- **Student**:
  - Focused examination environment with full-screen enforcement.
  - Filter tests by Available Now, Upcoming, and Completed Scorecards.
  - Touch-friendly MCQ option cards optimized for mobile screens.
  - Monaco Code Editor supporting Python, Java, C, and C++.
  - Real-time public test case runner and console execution.
  - Persistent server-synchronized countdown timer that survives page reloads.
  - Periodic background autosave (25s) + question-switch autosave.

---

### 2. Monaco Editor & Isolated Code Execution
- Integrated `@monaco-editor/react` with VS Dark theme and Fira Code typography.
- Initial multi-language support:
  - **Python 3**
  - **Java (OpenJDK 21)**
  - **C (GCC)**
  - **C++ (G++)**
- **Sandboxed Security**:
  - Student code is never executed inside the main Express process.
  - **Judge0 API Support**: Simply set `JUDGE0_API_URL` and `JUDGE0_API_KEY` in `backend/.env` for self-hosted or RapidAPI Judge0 instances.
  - **Resilient Isolated Local Sandbox**: When external Judge0 is unconfigured, the system spawns sandboxed runner child processes in ephemeral temporary directories with memory limits, strict CPU timeouts, stdin/stdout piping, and immediate cleanup.
- **Data Protection**: Students never receive correct MCQ answers or private hidden test cases before results are officially released.

---

### 3. Practical Anti-Cheating & Integrity Monitoring
- **Fullscreen Enforcement**: Requests browser fullscreen upon entering the test.
- **Tab & Window Blur Monitoring**: Detects `document.hidden` and window blur events.
- **Configurable Integrity Policies**:
  - Warning counter with deterrence modal (e.g. 3 warnings allowed).
  - Configurable actions on limit: `warn_only`, `flag_for_review`, or `auto_submit`.
  - Timestamped centralized logging in `ActivityLog`.
- **Honest Deterrence**: Clear and transparent communication regarding browser-based deterrence capabilities without overreaching privacy intrusions.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, Vite, Tailwind CSS, Lucide React, Monaco Editor, Canvas Confetti |
| **Backend** | Node.js (v24), Express.js, JWT, BcryptJS, Helmet, Morgan, Express-Rate-Limit |
| **Database** | MongoDB with Mongoose |
| **Code Runner** | Judge0 Integration + Isolated Sandboxed Child-Process Engine |
| **Testing** | Node.js Native Test Runner (`node:test`, `node:assert`) |

---

## 📋 Default Seed Accounts

The platform includes pre-configured seed data for instant testing:

| Role | Email | Password | Name | Description |
|---|---|---|---|---|
| **Admin** | `admin@kairos.edu` | `Admin@12345` | Kairos Club Admin | Full administrative access |
| **Teacher** | `teacher@kairos.edu` | `Teacher@12345` | Prof. Alan Turing | CSE Faculty / Test Creator |
| **Teacher 2** | `dr.sharma@kairos.edu` | `Teacher@12345` | Dr. Neha Sharma | IT Faculty |
| **Student 1** | `student1@kairos.edu` | `Student@12345` | Alex Mercer | CSE-2024-001 (Available test ready) |
| **Student 2** | `student2@kairos.edu` | `Student@12345` | Sophia Chen | CSE-2024-042 (Pre-completed sample attempt) |

---

## ⚙️ Quick Start & Local Setup

### Prerequisites
- Node.js (v18 or newer; v24 recommended)
- MongoDB instance running locally on `localhost:27017` or MongoDB Atlas URI

### 1. Clone the repository & Install Dependencies
```bash
# Clone
git clone <repo-url>
cd TestSite

# Install all dependencies (backend and frontend)
npm run install:all
```

### 2. Configure Environment Variables
Create `backend/.env` (a template is provided in `backend/.env.example`):
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/kairos_test_platform
JWT_SECRET=kairos_club_super_secure_jwt_secret_key_2026_test_system
JWT_EXPIRE=24h
CLIENT_URL=http://localhost:5173
NODE_ENV=development

DEFAULT_GRACE_PERIOD_SECONDS=30
MAX_VIOLATIONS_DEFAULT=3

# Optional: External Judge0 Code Execution
# JUDGE0_API_URL=https://judge0-ce.p.rapidapi.com
# JUDGE0_API_KEY=your_rapidapi_key
# JUDGE0_HOST=judge0-ce.p.rapidapi.com
```

### 3. Populate Seed Data
```bash
npm run seed
```

### 4. Run Automated Business Rule Tests
```bash
npm test
```
Verifies:
- Password hashing & bcrypt security.
- Test with 4 questions is rejected from publishing.
- Test with 5 questions publishes cleanly.
- Test with 21 questions is rejected.
- Independent marks calculation and sum verification.
- Student question view sanitization (hides answers and hidden test cases).
- Sandboxed Python execution against test cases.

### 5. Launch the Platform
In two separate terminals (or concurrently):
```bash
# Terminal 1: Start Backend Server (runs on http://localhost:5000)
npm run dev:backend

# Terminal 2: Start Frontend Dev Server (runs on http://localhost:5173)
npm run dev:frontend
```
Open **`http://localhost:5173`** in your browser to start.

---

## 📖 End-to-End Workflow Verification

1. **Teacher Test Creation**:
   - Log in as `teacher@kairos.edu` (or click the quick-login pill on `/login`).
   - Click **"Create New Test"**, enter title, subject, duration, and dates.
   - Go to **"Question Editor"**. Add 5 to 20 questions (MCQ or Coding).
   - Set different marks for different questions. Watch the total score auto-calculate.
   - Click **"Publish Test"**. Note that publishing is locked until at least 5 questions are present.
2. **Student Test Taking**:
   - Log in as `student1@kairos.edu`.
   - On the Student Dashboard, select **"Kairos Club Technical Assessment 2026"**.
   - Read instructions and check the academic integrity confirmation.
   - Click **"Enter Fullscreen & Begin Test"**.
   - Test MCQs with touch-friendly selection cards.
   - Test Coding problems: write code in Monaco Editor, click **"Run Code"** to check sample test cases.
   - Try switching tabs or exiting full screen to test the anti-cheating warning counter.
   - Click **"Finish & Submit"**.
3. **Teacher Grading & CSV Export**:
   - Log back into `teacher@kairos.edu`.
   - View test submissions, review student scores, override coding marks with feedback.
   - Click **"Export Results (CSV)"** to download the complete spreadsheet.
   - Toggle **"Release Results"** to make scorecards visible to students.

---

## 🔒 Security Architecture Summary

- **Authentication**: JWT token with expiration and user active status verification on every request.
- **Payload Sanitization**: Custom Mongoose `.toStudentView()` removes answer keys (`isCorrect`), hidden test cases, and private instructor explanations from student responses.
- **Deadline Enforcement**: Server computes `deadline = min(test.endTime, now + duration)`. Late submissions beyond grace period are automatically finalized as `timed_out`.
- **Rate Limiting**: `express-rate-limit` prevents brute-force login attempts and throttles code execution requests.
- **HTTP Security**: `helmet` headers and scoped CORS configuration.

---

## 🏛️ License & Credits

Developed for **Kairos Club**. Designed for technical collegiate assessments, hackathon screening, and coding challenges.
