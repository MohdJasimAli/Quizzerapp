import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getUsers, createUser, updateUser, deleteUser, resetUserPassword } from '../services/adminService';
import {
  GraduationCap,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Edit2,
  Trash2,
  X,
  Mail,
  Shield,
  Share2,
  Copy,
  Key,
  Download,
  Sparkles,
  Lock,
} from 'lucide-react';

export const TeacherManagementPage = () => {
  const { user } = useAuth();
  const toast = useToast();

  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState(null);

  // Credential Sharing Modal State
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareData, setShareData] = useState(null);
  const [copiedType, setCopiedType] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    department: 'Computer Science & Engineering',
    batch: 'Faculty Lecturer',
    isActive: true,
  });

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let p = 'Kairos@';
    for (let i = 0; i < 4; i++) {
      p += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    p += '!';
    setFormData((prev) => ({ ...prev, password: p }));
    toast.info('Generated secure temporary password.');
  };

  const fetchTeachers = async () => {
    try {
      setLoading(true);
      const res = await getUsers({ role: 'teacher' });
      if (res.success) setTeachers(res.users || []);
    } catch (err) {
      toast.error('Failed to load teachers.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeachers();
  }, []);

  const handleOpenAdd = () => {
    setEditingTeacher(null);
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let defaultPass = 'Teacher@';
    for (let i = 0; i < 4; i++) defaultPass += chars.charAt(Math.floor(Math.random() * chars.length));
    defaultPass += '!';

    setFormData({
      name: '',
      email: '',
      password: defaultPass,
      department: 'Computer Science & Engineering',
      batch: 'Faculty Lecturer',
      isActive: true,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (tch) => {
    setEditingTeacher(tch);
    setFormData({
      name: tch.name || '',
      email: tch.email || '',
      password: '',
      department: tch.department || '',
      batch: tch.batch || '',
      isActive: tch.isActive !== undefined ? tch.isActive : true,
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (editingTeacher) {
        const payload = { ...formData };
        if (!payload.password) delete payload.password;
        const res = await updateUser(editingTeacher._id, payload);
        if (res.success) {
          toast.success('Teacher account updated.');
          setIsModalOpen(false);
          fetchTeachers();
        }
      } else {
        const res = await createUser({ ...formData, role: 'teacher' });
        if (res.success) {
          toast.success('Teacher account created successfully!');
          setIsModalOpen(false);
          fetchTeachers();

          // Immediately prompt credentials sharing modal
          setShareData({
            name: formData.name,
            email: formData.email,
            password: formData.password,
            department: formData.department,
          });
          setShareModalOpen(true);
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save teacher.');
    }
  };

  const handleResetAndShare = async (tch) => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let newPass = 'Kairos@';
    for (let i = 0; i < 4; i++) newPass += chars.charAt(Math.floor(Math.random() * chars.length));
    newPass += '!';

    try {
      const res = await resetUserPassword(tch._id, newPass);
      if (res.success) {
        toast.success(`Generated new credentials for ${tch.name}.`);
        setShareData({
          name: tch.name,
          email: tch.email,
          password: newPass,
          department: tch.department,
        });
        setShareModalOpen(true);
      }
    } catch (err) {
      toast.error('Failed to generate credentials.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this teacher account?')) return;
    try {
      const res = await deleteUser(id);
      if (res.success) {
        toast.success('Teacher account deleted.');
        fetchTeachers();
      }
    } catch (err) {
      toast.error('Failed to delete teacher.');
    }
  };

  const getShareableText = () => {
    if (!shareData) return '';
    const portalUrl = `${window.location.origin}/login`;
    return `🎓 Kairos Test Platform — Faculty Examiner Credentials
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Hello Prof. ${shareData.name},

Your teacher/faculty account has been created on the Kairos Online Examination Platform. You can now log in to prepare, manage, and evaluate student assessments.

Portal Login URL: ${portalUrl}
Email Address:    ${shareData.email}
Password:         ${shareData.password}
Department:       ${shareData.department || 'Computer Science & Engineering'}

Instructions:
1. Log in using the credentials above.
2. Visit "Manage Tests" on your faculty dashboard to create tests and add questions (5–20 questions per test).
3. Monaco Editor and real-time retina eye-gaze proctoring are automatically integrated.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Kairos Technical Club`;
  };

  const copyFullMessage = () => {
    navigator.clipboard.writeText(getShareableText());
    setCopiedType('full');
    toast.success('Complete credential message copied to clipboard!');
    setTimeout(() => setCopiedType(null), 2500);
  };

  const copyPasswordOnly = () => {
    if (!shareData?.password) return;
    navigator.clipboard.writeText(shareData.password);
    setCopiedType('pass');
    toast.success('Password copied to clipboard!');
    setTimeout(() => setCopiedType(null), 2500);
  };

  const downloadCredentialsTxt = () => {
    if (!shareData) return;
    const element = document.createElement('a');
    const file = new Blob([getShareableText()], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `Kairos_Teacher_${shareData.name.replace(/\s+/g, '_')}_Credentials.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    toast.success('Credentials file downloaded.');
  };

  const filtered = teachers.filter(
    (t) =>
      t.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.department?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-indigo-400" />
            <span>Faculty & Teacher Management</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Create instructor accounts, generate & share faculty login credentials, and assign test preparation rights.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-1.5 transition shadow-lg shadow-indigo-600/30"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Teacher</span>
        </button>
      </div>

      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between gap-4">
          <span className="text-xs font-semibold text-slate-300">
            Registered Teachers ({filtered.length})
          </span>
          <div className="relative w-64">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search faculty..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl py-1.5 pl-9 pr-3 text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900 text-slate-400 font-semibold uppercase text-[10px] border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Faculty Name</th>
                <th className="py-3 px-4">Department & Designation</th>
                <th className="py-3 px-4">Account Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.map((tch) => (
                <tr key={tch._id} className="hover:bg-slate-900/50 transition">
                  <td className="py-3 px-4 font-semibold text-white">
                    {tch.name}
                    <div className="text-[11px] text-slate-500 font-normal">{tch.email}</div>
                  </td>
                  <td className="py-3 px-4 text-slate-300">
                    {tch.department}
                    <div className="text-[11px] text-slate-500">{tch.batch}</div>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        tch.isActive
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-rose-500/20 text-rose-300'
                      }`}
                    >
                      {tch.isActive ? 'Active' : 'Deactivated'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right space-x-1.5">
                    {/* Share Credentials Button */}
                    <button
                      onClick={() => handleResetAndShare(tch)}
                      className="py-1 px-2.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 text-[11px] font-semibold transition inline-flex items-center gap-1.5"
                      title="Generate & Share Credentials"
                    >
                      <Share2 className="w-3 h-3" />
                      <span>Share Credentials</span>
                    </button>

                    <button
                      onClick={() => handleOpenEdit(tch)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                      title="Edit Teacher"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(tch._id)}
                      className="p-1.5 rounded-lg bg-rose-950/30 hover:bg-rose-950/50 text-rose-400 transition"
                      title="Delete Teacher"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Teacher Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-indigo-400" />
                <span>{editingTeacher ? 'Edit Teacher Details' : 'Create Teacher Account'}</span>
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="e.g. Prof. Alan Turing"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 px-3 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address</label>
                <input
                  type="email"
                  value={formData.email}
                  disabled={Boolean(editingTeacher)}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  placeholder="teacher@kairos.edu"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 px-3 text-xs text-white disabled:opacity-50"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-300">
                    Password {editingTeacher && '(Leave blank to keep unchanged)'}
                  </label>
                  {!editingTeacher && (
                    <button
                      type="button"
                      onClick={generateRandomPassword}
                      className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Generate</span>
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required={!editingTeacher}
                  placeholder="e.g. Teacher@2026!"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 px-3 text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Department</label>
                <input
                  type="text"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 px-3 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Designation</label>
                <input
                  type="text"
                  value={formData.batch}
                  onChange={(e) => setFormData({ ...formData, batch: e.target.value })}
                  placeholder="e.g. Senior Lecturer"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 px-3 text-xs text-white"
                />
              </div>

              {editingTeacher && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="tActive"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-4 h-4 rounded text-indigo-600 bg-slate-950 border-slate-700"
                  />
                  <label htmlFor="tActive" className="text-xs text-slate-300 cursor-pointer">
                    Account is Active
                  </label>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="py-2 px-4 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="py-2 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
                >
                  {editingTeacher ? 'Update Teacher' : 'Create & Generate Credentials'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Share Credentials Modal */}
      {shareModalOpen && shareData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-indigo-500/40 rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl relative overflow-hidden space-y-4">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 via-cyan-400 to-emerald-500"></div>

            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <Share2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Teacher Credentials Ready to Share
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Send these login credentials directly to the instructor.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShareModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Credential Card Display */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between border-b border-slate-900 pb-2">
                <span className="text-slate-400">Faculty Name:</span>
                <span className="text-white font-bold">{shareData.name}</span>
              </div>

              <div className="flex items-center justify-between border-b border-slate-900 pb-2">
                <span className="text-slate-400">Portal URL:</span>
                <span className="text-indigo-400 underline">{window.location.origin}/login</span>
              </div>

              <div className="flex items-center justify-between border-b border-slate-900 pb-2">
                <span className="text-slate-400">Login Email:</span>
                <span className="text-cyan-300 font-semibold">{shareData.email}</span>
              </div>

              <div className="flex items-center justify-between bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                <div className="flex items-center gap-1.5 text-slate-400">
                  <Key className="w-3.5 h-3.5 text-amber-400" />
                  <span>Password:</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400 font-bold text-sm tracking-wider">
                    {shareData.password}
                  </span>
                  <button
                    onClick={copyPasswordOnly}
                    className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                    title="Copy Password"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
              <button
                onClick={copyFullMessage}
                className="py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center justify-center gap-2 transition shadow-lg shadow-indigo-600/30"
              >
                {copiedType === 'full' ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                    <span>Copied Message!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy Full Message</span>
                  </>
                )}
              </button>

              <button
                onClick={downloadCredentialsTxt}
                className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center justify-center gap-2 transition border border-slate-700"
              >
                <Download className="w-4 h-4" />
                <span>Download .txt Card</span>
              </button>
            </div>

            <p className="text-[10px] text-slate-500 text-center">
              The teacher can use these credentials to log in, create tests, and manage evaluations.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
