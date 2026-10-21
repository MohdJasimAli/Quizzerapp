const User = require('../models/User');
const Test = require('../models/Test');
const TestAttempt = require('../models/TestAttempt');
const ActivityLog = require('../models/ActivityLog');
const Result = require('../models/Result');

// @desc    Get system-wide analytics & stats for Admin dashboard
// @route   GET /api/admin/stats
// @access  Admin
const getDashboardStats = async (req, res) => {
  try {
    const totalStudents = await User.countDocuments({ role: 'student' });
    const totalTeachers = await User.countDocuments({ role: 'teacher' });
    const totalTests = await Test.countDocuments();
    const publishedTests = await Test.countDocuments({ isPublished: true });
    const draftTests = await Test.countDocuments({ isPublished: false });
    const totalAttempts = await TestAttempt.countDocuments();
    const flaggedAttempts = await TestAttempt.countDocuments({ isFlaggedForReview: true });
    const violationEventsCount = await ActivityLog.countDocuments({
      eventType: { $in: ['tab_switch', 'fullscreen_exit', 'window_blur', 'auto_submitted_violation'] },
    });

    const recentTests = await Test.find()
      .populate('assignedTeacher', 'name email')
      .populate('createdBy', 'name email role')
      .sort({ createdAt: -1 })
      .limit(6);

    const recentViolations = await ActivityLog.find({
      eventType: { $in: ['tab_switch', 'fullscreen_exit', 'window_blur', 'auto_submitted_violation'] },
    })
      .populate('studentId', 'name email rollNumber')
      .populate('testId', 'title')
      .sort({ timestamp: -1 })
      .limit(8);

    return res.status(200).json({
      success: true,
      stats: {
        totalStudents,
        totalTeachers,
        totalTests,
        publishedTests,
        draftTests,
        totalAttempts,
        flaggedAttempts,
        violationEventsCount,
      },
      recentTests,
      recentViolations,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard stats.',
      error: error.message,
    });
  }
};

// @desc    Get users list with role filter and search
// @route   GET /api/admin/users
// @access  Admin, Teacher (students only)
const getUsers = async (req, res) => {
  try {
    const { role, search, page = 1, limit = 50 } = req.query;
    let query = {};

    // Teacher can only view student lists
    if (req.user.role === 'teacher') {
      query.role = 'student';
    } else if (role && role !== 'all') {
      query.role = role;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { rollNumber: { $regex: search, $options: 'i' } },
        { department: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const total = await User.countDocuments(query);
    const users = await User.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    return res.status(200).json({
      success: true,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      users,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch users.',
      error: error.message,
    });
  }
};

// @desc    Admin creates a user (teacher or student)
// @route   POST /api/admin/users
// @access  Admin
const createUser = async (req, res) => {
  try {
    const { name, email, password, role, department, rollNumber, batch } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, password, and role are required.',
      });
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists.',
      });
    }

    const user = await User.create({
      name,
      email: email.toLowerCase().trim(),
      password,
      role,
      department: department || 'Computer Science & Engineering',
      rollNumber: rollNumber || '',
      batch: batch || '2024-2028',
      isActive: true,
    });

    return res.status(201).json({
      success: true,
      message: `${role.charAt(0).toUpperCase() + role.slice(1)} account created successfully.`,
      user,
      createdCredentials: {
        name: user.name,
        email: user.email,
        password, // Provided plain text password for sharing with the teacher
        role: user.role,
        department: user.department,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to create user.',
      error: error.message,
    });
  }
};

// @desc    Admin updates a user account
// @route   PUT /api/admin/users/:id
// @access  Admin
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, department, rollNumber, batch, isActive, role, password } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (name) user.name = name;
    if (department) user.department = department;
    if (rollNumber) user.rollNumber = rollNumber;
    if (batch) user.batch = batch;
    if (isActive !== undefined) user.isActive = Boolean(isActive);
    if (role && ['admin', 'teacher', 'student'].includes(role)) user.role = role;
    if (password) user.password = password; // Will trigger pre-save bcrypt hash

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'User updated successfully.',
      user,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update user.',
      error: error.message,
    });
  }
};

// @desc    Admin deletes a user
// @route   DELETE /api/admin/users/:id
// @access  Admin
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (req.user._id.toString() === id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own admin account.',
      });
    }

    await User.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: 'User deleted successfully.',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to delete user.',
      error: error.message,
    });
  }
};

// @desc    Get activity & integrity logs
// @route   GET /api/admin/activity-logs
// @access  Admin, Teacher
const getActivityLogs = async (req, res) => {
  try {
    const { testId, studentId, eventType, severity, page = 1, limit = 50 } = req.query;
    let query = {};

    if (testId) query.testId = testId;
    if (studentId) query.studentId = studentId;
    if (eventType) query.eventType = eventType;
    if (severity) query.severity = severity;

    const skip = (Number(page) - 1) * Number(limit);
    const total = await ActivityLog.countDocuments(query);
    const logs = await ActivityLog.find(query)
      .populate('studentId', 'name email rollNumber department')
      .populate('testId', 'title subject')
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(Number(limit));

    return res.status(200).json({
      success: true,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      logs,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch activity logs.',
      error: error.message,
    });
  }
};

// @desc    Admin resets password and returns shareable credentials
// @route   POST /api/admin/users/:id/reset-password
// @access  Admin
const resetUserPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const tempPassword = newPassword || `Kairos@${Math.floor(100000 + Math.random() * 900000)}`;
    user.password = tempPassword;
    await user.save();

    return res.status(200).json({
      success: true,
      message: `Password updated for ${user.name}.`,
      credentials: {
        name: user.name,
        email: user.email,
        password: tempPassword,
        role: user.role,
        department: user.department,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to reset password.',
      error: error.message,
    });
  }
};

module.exports = {
  getDashboardStats,
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  resetUserPassword,
  getActivityLogs,
};
