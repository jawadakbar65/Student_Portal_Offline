import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity, ArrowDownUp, BookOpen, CalendarCheck, ChartNoAxesColumnIncreasing, Check, ChevronDown, ChevronLeft,
  ChevronRight, ClipboardList, Download, Eye, FileDown, FileText, GraduationCap, LayoutDashboard, LogOut,
  Menu, Pencil, Plus, Printer, Search, Settings, ShieldCheck, Trash2, Upload, Users, X, EyeOff,
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { deleteRecord, getAll, getSettings, putRecord, replaceBackup, saveSettings } from './storage.js';

const SESSION_KEY = 'sms-admin-session';
const PASSWORD_HASH = '62d2eadb2bc03097bb46bc74e390f1449a7449357f4639a94aa36e915362cfbb';
const NAVIGATION = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'students', label: 'Students', icon: Users },
  { id: 'classes', label: 'Classes & Sections', icon: BookOpen },
  { id: 'attendance', label: 'Attendance', icon: CalendarCheck },
  { id: 'reports', label: 'Student Reports', icon: ChartNoAxesColumnIncreasing },
  { id: 'backup', label: 'Backup & Restore', icon: FileDown },
  { id: 'settings', label: 'Settings', icon: Settings },
];
const EMPTY_STUDENT = {
  fullName: '', fatherName: '', dateOfBirth: '', gender: '', className: '', section: '', rollNumber: '',
  phone: '', guardianPhone: '', email: '', address: '', admissionDate: new Date().toISOString().slice(0, 10),
  photo: '', status: 'Active',
};
const today = () => new Date().toISOString().slice(0, 10);
const makeId = () => `STU-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

async function passwordDigest(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const digest = await passwordDigest(password);
      if (username.trim() !== 'jawad' || digest !== PASSWORD_HASH) {
        setError('That username or password is incorrect.');
        return;
      }
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ username: 'jawad', expiresAt: Date.now() + 8 * 60 * 60 * 1000 }));
      onLogin();
    } catch {
      setError('Secure browser authentication is unavailable. Open this app through localhost in a modern browser.');
    } finally {
      setBusy(false);
    }
  }

  return <main className="login-page">
    <div className="login-art" aria-hidden="true"><div className="art-grid" /><div className="art-mark"><GraduationCap size={34} /></div><span className="art-index">SCHOOL ADMINISTRATION / 01</span><div className="art-copy"><p>STUDENT SERVICES</p><h2>A clear view of<br />every student.</h2><span>Records, attendance, and reports in one private workspace.</span></div><div className="art-foot"><span>LOCAL FIRST</span><span>EST. 2026</span></div></div>
    <section className="login-panel">
      <div className="login-brand"><span className="brand-symbol"><GraduationCap size={21} /></span><span>Student Management System</span></div>
      <form className="login-form" onSubmit={submit}>
        <div className="login-heading"><span className="eyebrow">ADMINISTRATOR ACCESS</span><h1>Welcome back</h1><p>Sign in to continue to your school workspace.</p></div>
        <label className="field-label" htmlFor="username">Username</label>
        <input id="username" autoComplete="username" autoFocus value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Enter your username" required />
        <label className="field-label" htmlFor="password">Password</label>
        <div className="password-field"><input id="password" autoComplete="current-password" type={visible ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" required /><button className="icon-button password-toggle" type="button" onClick={() => setVisible(!visible)} aria-label={visible ? 'Hide password' : 'Show password'}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button button-primary login-submit" type="submit" disabled={busy}>{busy ? 'Checking…' : 'Sign in'}<ChevronRight size={17} /></button>
        <div className="login-note"><ShieldCheck size={16} /><span>Private to this browser · Works offline</span></div>
      </form>
      <p className="login-disclaimer">Browser-only protection is intended for local access control, not as a substitute for server-enforced security.</p>
    </section>
  </main>;
}

function App() {
  const [authenticated, setAuthenticated] = useState(() => {
    try {
      const session = JSON.parse(sessionStorage.getItem(SESSION_KEY));
      if (session?.username === 'jawad' && session.expiresAt > Date.now()) return true;
      sessionStorage.removeItem(SESSION_KEY);
    } catch { sessionStorage.removeItem(SESSION_KEY); }
    return false;
  });
  const [page, setPage] = useState('dashboard');
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [settings, setSettings] = useState({ schoolName: 'Student Management System', classes: [] });
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [modal, setModal] = useState(null);
  const [query, setQuery] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterSection, setFilterSection] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [currentPage, setCurrentPage] = useState(1);
  const [attendanceDate, setAttendanceDate] = useState(today());
  const [attendanceClass, setAttendanceClass] = useState('');
  const [attendanceSearch, setAttendanceSearch] = useState('');
  const [reportClass, setReportClass] = useState('');
  const [settingsDraft, setSettingsDraft] = useState(settings);
  const perPage = 8;

  function toast(message, kind = 'success') {
    setNotice({ message, kind });
    window.setTimeout(() => setNotice(null), 3600);
  }

  async function refreshData() {
    setLoadError('');
    try {
      const [savedStudents, savedAttendance, savedSettings] = await Promise.all([getAll('students'), getAll('attendance'), getSettings()]);
      setStudents(savedStudents);
      setAttendance(savedAttendance);
      const mergedSettings = { schoolName: 'Student Management System', classes: [], ...savedSettings };
      setSettings(mergedSettings);
      setSettingsDraft(mergedSettings);
      setLoaded(true);
    } catch (error) {
      setLoadError(`${error.message} Check that browser storage is enabled and open the app through localhost.`);
      setLoaded(true);
    }
  }

  useEffect(() => {
    if (authenticated) refreshData();
    else { setLoaded(false); setStudents([]); setAttendance([]); }
  }, [authenticated]);

  const classNames = useMemo(() => [...new Set([...(settings.classes || []).map((item) => item.name), ...students.map((student) => student.className).filter(Boolean)])].sort(), [settings.classes, students]);
  const sections = useMemo(() => [...new Set(students.filter((student) => !filterClass || student.className === filterClass).map((student) => student.section).filter(Boolean))].sort(), [students, filterClass]);
  const filteredStudents = useMemo(() => students.filter((student) => {
    const search = query.trim().toLowerCase();
    const matches = !search || [student.fullName, student.id, student.rollNumber].some((value) => String(value || '').toLowerCase().includes(search));
    return matches && (!filterClass || student.className === filterClass) && (!filterSection || student.section === filterSection) && (!filterStatus || student.status === filterStatus);
  }).sort((a, b) => sortBy === 'class' ? (a.className || '').localeCompare(b.className || '') : sortBy === 'newest' ? (b.createdAt || '').localeCompare(a.createdAt || '') : a.fullName.localeCompare(b.fullName)), [students, query, filterClass, filterSection, filterStatus, sortBy]);
  const pageCount = Math.max(1, Math.ceil(filteredStudents.length / perPage));
  const visibleStudents = filteredStudents.slice((currentPage - 1) * perPage, currentPage * perPage);
  const todayRecords = attendance.filter((record) => record.date === today());
  const activeCount = students.filter((student) => student.status === 'Active').length;
  const recentStudents = [...students].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 5);
  const chartData = classNames.map((name) => ({ name, Students: students.filter((student) => student.className === name).length }));

  async function saveStudent(form) {
    const normalizedRoll = form.rollNumber.trim().toLowerCase();
    if (students.some((student) => student.id !== form.id && student.rollNumber.trim().toLowerCase() === normalizedRoll && student.className === form.className && student.section === form.section)) {
      throw new Error('That roll number is already used in this class and section.');
    }
    const existing = students.find((student) => student.id === form.id);
    const student = { ...form, fullName: form.fullName.trim(), rollNumber: form.rollNumber.trim(), updatedAt: new Date().toISOString(), createdAt: existing?.createdAt || new Date().toISOString() };
    await putRecord('students', student);
    setStudents((current) => existing ? current.map((item) => item.id === student.id ? student : item) : [student, ...current]);
    setModal(null);
    toast(existing ? 'Student record updated.' : 'Student saved to this device.');
  }

  function printStudent(student) {
    setModal({ type: 'view', student });
    window.setTimeout(() => window.print(), 150);
  }

  async function removeStudent(student) {
    if (!window.confirm(`Delete ${student.fullName} (${student.id})? This cannot be undone.`)) return;
    try {
      await deleteRecord('students', student.id);
      setStudents((current) => current.filter((item) => item.id !== student.id));
      setAttendance((current) => current.filter((item) => item.studentId !== student.id));
      const records = await getAll('attendance');
      await Promise.all(records.filter((item) => item.studentId === student.id).map((item) => deleteRecord('attendance', item.key)));
      toast('Student and linked attendance records deleted.');
    } catch (error) { toast(error.message, 'error'); }
  }

  async function saveAttendance(studentId, status) {
    const key = `${attendanceDate}:${studentId}`;
    const record = { key, date: attendanceDate, studentId, status, updatedAt: new Date().toISOString() };
    try {
      await putRecord('attendance', record);
      setAttendance((current) => [...current.filter((item) => item.key !== key), record]);
      toast('Attendance saved.');
    } catch (error) { toast(error.message, 'error'); }
  }

  async function saveSchoolSettings(event) {
    event.preventDefault();
    try {
      await saveSettings(settingsDraft);
      setSettings(settingsDraft);
      toast('School settings saved on this device.');
    } catch (error) { toast(error.message, 'error'); }
  }

  function downloadBackup() {
    const file = new Blob([JSON.stringify({ format: 'student-management-backup', version: 1, exportedAt: new Date().toISOString(), students, attendance, settings }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(file);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `student-records-${today()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast('Backup file exported.');
  }

  async function importBackup(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const backup = JSON.parse(await file.text());
      if (!window.confirm(`Restore ${backup.students?.length || 0} students from this backup? Current records will be replaced.`)) return;
      await replaceBackup(backup);
      await refreshData();
      toast('Backup restored successfully.');
    } catch (error) { toast(error.message || 'Could not read this backup file.', 'error'); }
    finally { event.target.value = ''; }
  }

  async function savePhoto(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast('Choose an image file for the school logo.', 'error'); return; }
    if (file.size > 2_000_000) { toast('Logo images must be smaller than 2 MB.', 'error'); return; }
    const reader = new FileReader();
    reader.onload = () => setSettingsDraft((current) => ({ ...current, logo: reader.result }));
    reader.readAsDataURL(file);
  }

  function exportStudentsPdf(studentsToExport = filteredStudents, title = 'Student Register') {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(18);
    doc.text(settings.schoolName || 'Student Management System', 14, 16);
    doc.setFontSize(11);
    doc.text(title, 14, 24);
    doc.setFontSize(9);
    doc.text(`Generated ${new Date().toLocaleDateString()}`, 14, 30);
    autoTable(doc, {
      startY: 36,
      head: [['Student ID', 'Full name', 'Class', 'Section', 'Roll no.', 'Phone', 'Status']],
      body: studentsToExport.map((student) => [student.id, student.fullName, student.className || '-', student.section || '-', student.rollNumber || '-', student.phone || '-', student.status]),
      styles: { fontSize: 8, cellPadding: 2.5 }, headStyles: { fillColor: [36, 92, 78] },
      didDrawPage: () => { doc.setFontSize(8); doc.text(`Page ${doc.internal.getNumberOfPages()}`, 275, 200, { align: 'right' }); },
    });
    doc.save('student-register.pdf');
  }

  function exportStudentPdf(student) {
    const doc = new jsPDF();
    doc.setFontSize(18); doc.text(settings.schoolName || 'Student Management System', 14, 18);
    doc.setFontSize(12); doc.text('Student profile', 14, 27);
    autoTable(doc, { startY: 34, theme: 'grid', styles: { fontSize: 10, cellPadding: 4 }, body: [
      ['Student ID', student.id], ['Full name', student.fullName], ["Father's name", student.fatherName || '-'], ['Date of birth', student.dateOfBirth || '-'], ['Gender', student.gender || '-'], ['Class / section', `${student.className || '-'} / ${student.section || '-'}`], ['Roll number', student.rollNumber || '-'], ['Phone', student.phone || '-'], ['Parent / guardian phone', student.guardianPhone || '-'], ['Email', student.email || '-'], ['Address', student.address || '-'], ['Admission date', student.admissionDate || '-'], ['Status', student.status],
    ] });
    doc.save(`${student.id}-profile.pdf`);
  }

  async function saveClass(event) {
    event.preventDefault();
    const name = event.currentTarget.elements.className.value.trim();
    if (!name) return;
    if (classNames.some((item) => item.toLowerCase() === name.toLowerCase())) { toast('That class already exists.', 'error'); return; }
    const next = { ...settings, classes: [...(settings.classes || []), { id: crypto.randomUUID(), name, sections: event.currentTarget.elements.sections.value.split(',').map((item) => item.trim()).filter(Boolean) }] };
    try { await saveSettings(next); setSettings(next); setSettingsDraft(next); event.currentTarget.reset(); toast('Class and sections saved.'); }
    catch (error) { toast(error.message, 'error'); }
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    setAuthenticated(false);
    setPage('dashboard');
    setModal(null);
  }

  if (!authenticated) return <Login onLogin={() => setAuthenticated(true)} />;
  if (!loaded) return <div className="loading-screen"><span className="loader" />Opening your local school records…</div>;

  const pageTitle = NAVIGATION.find((item) => item.id === page)?.label || 'Dashboard';
  const switchPage = (id) => { setPage(id); setMenuOpen(false); setCurrentPage(1); };
  const filteredAttendanceStudents = students.filter((student) => (!attendanceClass || student.className === attendanceClass) && (!attendanceSearch || `${student.fullName} ${student.id} ${student.rollNumber}`.toLowerCase().includes(attendanceSearch.toLowerCase())));
  const recentForReport = students.filter((student) => !reportClass || student.className === reportClass);

  return <div className="app-shell">
    <div className={`mobile-scrim ${menuOpen ? 'shown' : ''}`} onClick={() => setMenuOpen(false)} />
    <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
      <div className="sidebar-brand"><span className="brand-symbol"><GraduationCap size={21} /></span><div><strong>Student Office</strong><small>MANAGEMENT SYSTEM</small></div><button className="icon-button mobile-close" onClick={() => setMenuOpen(false)} aria-label="Close menu"><X size={19} /></button></div>
      <div className="school-label">WORKSPACE</div>
      <nav className="side-nav">{NAVIGATION.map(({ id, label, icon: Icon }) => <button key={id} className={`nav-link ${page === id ? 'selected' : ''}`} onClick={() => switchPage(id)}><Icon size={18} /><span>{label}</span>{id === 'students' && <span className="nav-count">{students.length}</span>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="local-status"><span className="status-dot" /><span>Local database ready</span></div><p>Records stay in this browser profile.</p></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div className="topbar-leading"><button className="icon-button menu-toggle" onClick={() => setMenuOpen(true)} aria-label="Open menu"><Menu size={20} /></button><div><span className="breadcrumb-root">School office</span><ChevronRight size={14} /><strong>{pageTitle}</strong></div></div><div className="topbar-actions"><span className="offline-pill"><span className="status-dot" /> Offline ready</span><button className="admin-chip" title="Administrator"><span className="admin-avatar">J</span><span>Jawad</span><ChevronDown size={14} /></button><button className="logout-button" onClick={logout}><LogOut size={17} /><span>Log out</span></button></div></header>
      {loadError && <div className="storage-error" role="alert">{loadError}</div>}
      <div className="page-content">
        {page === 'dashboard' && <Dashboard students={students} activeCount={activeCount} todayRecords={todayRecords} recent={recentStudents} chartData={chartData} settings={settings} onNavigate={switchPage} onAdd={() => setModal({ type: 'form', student: { ...EMPTY_STUDENT, id: makeId() } })} onView={(student) => setModal({ type: 'view', student })} />}
        {page === 'students' && <section>
          <div className="page-heading"><div><span className="eyebrow">DIRECTORY</span><h1>Students</h1><p>Manage student profiles and school records.</p></div><div className="heading-actions"><button className="button button-secondary" onClick={() => exportStudentsPdf()}><Download size={16} />Export PDF</button><button className="button button-primary" onClick={() => setModal({ type: 'form', student: { ...EMPTY_STUDENT, id: makeId() } })}><Plus size={17} />Add student</button></div></div>
          <div className="toolbar"><label className="search-box"><Search size={17} /><input value={query} onChange={(event) => { setQuery(event.target.value); setCurrentPage(1); }} placeholder="Search name, student ID, roll number" /></label><select aria-label="Filter by class" value={filterClass} onChange={(event) => { setFilterClass(event.target.value); setFilterSection(''); }}><option value="">All classes</option>{classNames.map((name) => <option key={name}>{name}</option>)}</select><select aria-label="Filter by section" value={filterSection} onChange={(event) => setFilterSection(event.target.value)}><option value="">All sections</option>{sections.map((section) => <option key={section}>{section}</option>)}</select><select aria-label="Filter by status" value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)}><option value="">All statuses</option><option>Active</option><option>Inactive</option></select><select aria-label="Sort students" value={sortBy} onChange={(event) => setSortBy(event.target.value)}><option value="name">Name A–Z</option><option value="newest">Recently added</option><option value="class">Class</option></select></div>
          <div className="table-wrap"><table><thead><tr><th>Student</th><th>Student ID</th><th>Class / section</th><th>Roll no.</th><th>Contact</th><th>Status</th><th>Actions</th></tr></thead><tbody>{visibleStudents.map((student) => <tr key={student.id}><td><div className="student-cell">{student.photo ? <img className="avatar photo" src={student.photo} alt="" /> : <span className="avatar">{student.fullName.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</span>}<span><strong>{student.fullName}</strong><small>Admitted {student.admissionDate || '—'}</small></span></div></td><td className="id-text">{student.id}</td><td>{student.className || '—'}<span className="sub-cell">{student.section || 'No section'}</span></td><td>{student.rollNumber || '—'}</td><td>{student.phone || '—'}</td><td><span className={`status-badge ${student.status.toLowerCase()}`}><i />{student.status}</span></td><td><div className="row-actions"><button className="icon-button" aria-label={`View ${student.fullName}`} title="View" onClick={() => setModal({ type: 'view', student })}><Eye size={16} /></button><button className="icon-button" aria-label={`Edit ${student.fullName}`} title="Edit" onClick={() => setModal({ type: 'form', student })}><Pencil size={16} /></button><button className="icon-button" aria-label={`ID card for ${student.fullName}`} title="ID card" onClick={() => setModal({ type: 'card', student })}><CreditIcon /></button><button className="icon-button" aria-label={`Print ${student.fullName}`} title="Print profile" onClick={() => printStudent(student)}><Printer size={16} /></button><button className="icon-button danger-icon" aria-label={`Delete ${student.fullName}`} title="Delete" onClick={() => removeStudent(student)}><Trash2 size={16} /></button></div></td></tr>)}</tbody></table>{visibleStudents.length === 0 && <EmptyState icon={Users} title="No students found" message={students.length ? 'Try changing your search or filters.' : 'Add your first student to begin building your directory.'} />}</div>
          <div className="table-footer"><span>Showing {filteredStudents.length ? (currentPage - 1) * perPage + 1 : 0}–{Math.min(currentPage * perPage, filteredStudents.length)} of {filteredStudents.length} students</span><div className="pagination"><button className="icon-button" disabled={currentPage <= 1} onClick={() => setCurrentPage((value) => value - 1)} aria-label="Previous page"><ChevronLeft size={17} /></button><span>Page {currentPage} of {pageCount}</span><button className="icon-button" disabled={currentPage >= pageCount} onClick={() => setCurrentPage((value) => value + 1)} aria-label="Next page"><ChevronRight size={17} /></button></div></div>
        </section>}
        {page === 'classes' && <section><div className="page-heading"><div><span className="eyebrow">ACADEMIC STRUCTURE</span><h1>Classes & Sections</h1><p>Maintain the classes used throughout the student directory.</p></div></div><form className="inline-form class-create" onSubmit={saveClass}><label>Class name<input name="className" placeholder="e.g. Grade 8" required /></label><label>Sections<input name="sections" placeholder="A, B, C" /><small>Separate section names with commas.</small></label><button className="button button-primary"><Plus size={16} />Add class</button></form><div className="class-grid">{classNames.map((name) => { const configured = settings.classes?.find((item) => item.name === name); const count = students.filter((item) => item.className === name).length; const classSections = configured?.sections?.length ? configured.sections : [...new Set(students.filter((item) => item.className === name).map((item) => item.section).filter(Boolean))]; return <article className="class-card" key={name}><div className="class-card-icon"><BookOpen size={19} /></div><div><h3>{name}</h3><p>{count} {count === 1 ? 'student' : 'students'}</p></div><div className="section-tags">{classSections.length ? classSections.map((item) => <span key={item}>{item}</span>) : <span>No sections</span>}</div></article>; })}{!classNames.length && <EmptyState icon={BookOpen} title="No classes yet" message="Add a class above or assign a class to a student." />}</div></section>}
        {page === 'attendance' && <section><div className="page-heading"><div><span className="eyebrow">DAILY REGISTER</span><h1>Attendance</h1><p>Record and review attendance by student and date.</p></div><div className="heading-actions"><label className="date-control">Date<input type="date" value={attendanceDate} onChange={(event) => setAttendanceDate(event.target.value)} /></label></div></div><div className="toolbar"><label className="search-box"><Search size={17} /><input value={attendanceSearch} onChange={(event) => setAttendanceSearch(event.target.value)} placeholder="Find a student" /></label><select value={attendanceClass} onChange={(event) => setAttendanceClass(event.target.value)}><option value="">All classes</option>{classNames.map((name) => <option key={name}>{name}</option>)}</select><span className="toolbar-count">{attendance.filter((item) => item.date === attendanceDate).length} marked for this date</span></div><div className="table-wrap"><table><thead><tr><th>Student</th><th>Class / section</th><th>Roll no.</th><th>Attendance</th></tr></thead><tbody>{filteredAttendanceStudents.map((student) => { const current = attendance.find((item) => item.key === `${attendanceDate}:${student.id}`)?.status || ''; return <tr key={student.id}><td><div className="student-cell"><span className="avatar">{student.fullName.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</span><span><strong>{student.fullName}</strong><small>{student.id}</small></span></div></td><td>{student.className || '—'} / {student.section || '—'}</td><td>{student.rollNumber || '—'}</td><td><div className="attendance-options">{['Present', 'Absent', 'Late', 'Leave'].map((status) => <button key={status} className={`attendance-choice ${current === status ? `chosen ${status.toLowerCase()}` : ''}`} onClick={() => saveAttendance(student.id, status)}>{status}</button>)}</div></td></tr>; })}</tbody></table>{!filteredAttendanceStudents.length && <EmptyState icon={CalendarCheck} title="No students to mark" message="Add student records to start taking attendance." />}</div></section>}
        {page === 'reports' && <section><div className="page-heading"><div><span className="eyebrow">RECORDS & INSIGHTS</span><h1>Student Reports</h1><p>Review enrollment records and export a printable register.</p></div><button className="button button-primary" onClick={() => exportStudentsPdf(recentForReport, 'Student Report')}><Download size={16} />Download report PDF</button></div><div className="report-summary"><div><span>Total student records</span><strong>{recentForReport.length}</strong></div><div><span>Active</span><strong>{recentForReport.filter((item) => item.status === 'Active').length}</strong></div><div><span>Inactive</span><strong>{recentForReport.filter((item) => item.status === 'Inactive').length}</strong></div><label>Class<select value={reportClass} onChange={(event) => setReportClass(event.target.value)}><option value="">All classes</option>{classNames.map((name) => <option key={name}>{name}</option>)}</select></label></div><div className="table-wrap"><table><thead><tr><th>Student</th><th>Class / section</th><th>Roll no.</th><th>Admission date</th><th>Status</th><th>PDF</th></tr></thead><tbody>{recentForReport.map((student) => <tr key={student.id}><td><strong>{student.fullName}</strong><span className="sub-cell">{student.id}</span></td><td>{student.className || '—'} / {student.section || '—'}</td><td>{student.rollNumber || '—'}</td><td>{student.admissionDate || '—'}</td><td><span className={`status-badge ${student.status.toLowerCase()}`}><i />{student.status}</span></td><td><button className="icon-button" title="Download student PDF" aria-label={`Download ${student.fullName} PDF`} onClick={() => exportStudentPdf(student)}><FileText size={17} /></button></td></tr>)}</tbody></table>{!recentForReport.length && <EmptyState icon={FileText} title="No report records" message="Your student report will appear here." />}</div></section>}
        {page === 'backup' && <section><div className="page-heading"><div><span className="eyebrow">DATA SAFETY</span><h1>Backup & Restore</h1><p>Export a portable copy or restore a previous backup.</p></div></div><div className="backup-layout"><article className="backup-panel"><div className="backup-icon"><Download size={21} /></div><span className="eyebrow">EXPORT</span><h2>Keep a copy of your records</h2><p>Export students, attendance, and school settings together as a JSON backup file.</p><div className="backup-metrics"><span><strong>{students.length}</strong> students</span><span><strong>{attendance.length}</strong> attendance entries</span></div><button className="button button-primary" onClick={downloadBackup}><Download size={16} />Download JSON backup</button></article><article className="backup-panel restore-panel"><div className="backup-icon coral"><Upload size={21} /></div><span className="eyebrow">RESTORE</span><h2>Recover from a backup</h2><p>Restoring replaces the records currently saved in this browser. A confirmation is shown before changes are made.</p><label className="button button-secondary file-picker"><Upload size={16} />Choose backup file<input type="file" accept="application/json,.json" onChange={importBackup} /></label></article></div><div className="data-warning"><ShieldCheck size={19} /><p><strong>Keep your backup somewhere safe.</strong> Browser storage survives restarts, but can be erased if site data is manually cleared or the browser profile is deleted. This app cannot recover cleared browser data without a backup.</p></div></section>}
        {page === 'settings' && <section><div className="page-heading"><div><span className="eyebrow">WORKSPACE CONFIGURATION</span><h1>Settings</h1><p>School details appear on student ID cards and reports.</p></div></div><form className="settings-form" onSubmit={saveSchoolSettings}><div className="settings-section"><div className="settings-section-title"><h2>School profile</h2><p>Used in printed student documents.</p></div><div className="settings-fields"><label>School name<input value={settingsDraft.schoolName || ''} onChange={(event) => setSettingsDraft({ ...settingsDraft, schoolName: event.target.value })} required /></label><label>School phone<input value={settingsDraft.phone || ''} onChange={(event) => setSettingsDraft({ ...settingsDraft, phone: event.target.value })} /></label><label>School email<input type="email" value={settingsDraft.email || ''} onChange={(event) => setSettingsDraft({ ...settingsDraft, email: event.target.value })} /></label><label className="field-wide">School address<textarea rows="3" value={settingsDraft.address || ''} onChange={(event) => setSettingsDraft({ ...settingsDraft, address: event.target.value })} /></label><div className="field-wide logo-setting"><div>{settingsDraft.logo ? <img src={settingsDraft.logo} alt="School logo" /> : <span className="logo-placeholder"><GraduationCap size={23} /></span>}<span><strong>School logo</strong><small>Local image, up to 2 MB</small></span></div><label className="button button-secondary file-picker">Choose image<input type="file" accept="image/*" onChange={savePhoto} /></label></div></div></div><div className="settings-foot"><span>Changes are saved only when you select Save settings.</span><button className="button button-primary"><Check size={16} />Save settings</button></div></form></section>}
      </div>
      <footer className="page-footer"><span>Student Management System</span><span>Offline workspace · Data stored on this device</span></footer>
    </main>
    {notice && <div className={`toast ${notice.kind}`} role="status"><span className="toast-mark">{notice.kind === 'success' ? <Check size={16} /> : <X size={16} />}</span>{notice.message}<button className="icon-button" onClick={() => setNotice(null)} aria-label="Dismiss notification"><X size={15} /></button></div>}
    {modal?.type === 'form' && <StudentForm student={modal.student} classes={settings.classes || []} existingClasses={classNames} onClose={() => setModal(null)} onSave={saveStudent} />}
    {modal?.type === 'view' && <StudentView student={modal.student} settings={settings} onClose={() => setModal(null)} onEdit={() => setModal({ type: 'form', student: modal.student })} onCard={() => setModal({ type: 'card', student: modal.student })} onPdf={() => exportStudentPdf(modal.student)} />}
    {modal?.type === 'card' && <IdCard student={modal.student} settings={settings} onClose={() => setModal(null)} />}
  </div>;
}

function CreditIcon() { return <ClipboardList size={16} />; }

function Dashboard({ students, activeCount, todayRecords, recent, chartData, settings, onNavigate, onAdd, onView }) {
  const totalAttendance = todayRecords.length;
  const present = todayRecords.filter((item) => item.status === 'Present' || item.status === 'Late').length;
  return <section><div className="page-heading dashboard-heading"><div><span className="eyebrow">OVERVIEW / {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()}</span><h1>Good morning, Jawad</h1><p>Here’s the latest from {settings.schoolName || 'your school'}.</p></div><button className="button button-primary" onClick={onAdd}><Plus size={17} />Add student</button></div><div className="stats-grid"><Stat icon={Users} label="Total students" value={students.length} detail="Across all classes" tone="mint" /><Stat icon={Activity} label="Active students" value={activeCount} detail={`${students.length ? Math.round(activeCount / students.length * 100) : 0}% of all records`} tone="blue" /><Stat icon={CalendarCheck} label="Attendance today" value={totalAttendance ? `${Math.round(present / totalAttendance * 100)}%` : '—'} detail={totalAttendance ? `${totalAttendance} records marked` : 'No records marked yet'} tone="amber" /><Stat icon={BookOpen} label="Total classes" value={chartData.length} detail="Configured class groups" tone="coral" /></div><div className="dashboard-grid"><article className="panel chart-panel"><div className="panel-heading"><div><h2>Students by class</h2><p>Enrollment overview</p></div><button className="text-button" onClick={() => onNavigate('classes')}>Manage classes <ChevronRight size={15} /></button></div>{chartData.length ? <div className="chart-area"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{ top: 10, right: 8, left: -24, bottom: 0 }}><CartesianGrid vertical={false} stroke="#e7ebe8" /><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#79827d', fontSize: 12 }} /><YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#79827d', fontSize: 11 }} /><Tooltip cursor={{ fill: '#f1f5f2' }} /><Bar dataKey="Students" fill="#3a7c66" radius={[4, 4, 0, 0]} maxBarSize={42} /></BarChart></ResponsiveContainer></div> : <EmptyState icon={ChartNoAxesColumnIncreasing} title="No enrollment data yet" message="Add students and assign them to classes to populate this chart." />}</article><article className="panel activity-panel"><div className="panel-heading"><div><h2>Recently added</h2><p>Latest student records</p></div><button className="text-button" onClick={() => onNavigate('students')}>All students <ChevronRight size={15} /></button></div>{recent.length ? <div className="recent-list">{recent.map((student) => <button className="recent-item" key={student.id} onClick={() => onView(student)}><span className="avatar">{student.fullName.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</span><span className="recent-name"><strong>{student.fullName}</strong><small>{student.className || 'Class not set'} · ID {student.id}</small></span><span className={`status-badge ${student.status.toLowerCase()}`}><i />{student.status}</span></button>)}</div> : <EmptyState icon={Users} title="No students yet" message="Your recent additions will appear here." />}</article></div><div className="dashboard-note"><div className="note-mark"><ShieldCheck size={18} /></div><div><strong>Your records stay on this device</strong><p>Export a JSON backup periodically to protect against browser data being cleared.</p></div><button className="text-button" onClick={() => onNavigate('backup')}>Backup data <ChevronRight size={15} /></button></div></section>;
}

function Stat({ icon: Icon, label, value, detail, tone }) {
  return <article className="stat-card"><span className={`stat-icon ${tone}`}><Icon size={19} /></span><span className="stat-label">{label}</span><strong className="stat-value">{value}</strong><span className="stat-detail">{detail}</span></article>;
}

function EmptyState({ icon: Icon, title, message }) {
  return <div className="empty-state"><span><Icon size={21} /></span><strong>{title}</strong><p>{message}</p></div>;
}

function StudentForm({ student, classes, existingClasses, onClose, onSave }) {
  const [form, setForm] = useState(student);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const isEdit = Boolean(student.createdAt);
  const field = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  async function submit(event) {
    event.preventDefault();
    const nextErrors = {};
    if (!form.fullName.trim()) nextErrors.fullName = 'Enter the student’s full name.';
    if (!form.className) nextErrors.className = 'Choose or enter a class.';
    if (!form.rollNumber.trim()) nextErrors.rollNumber = 'Enter a roll number.';
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) nextErrors.email = 'Enter a valid email address.';
    if (form.dateOfBirth && form.dateOfBirth > today()) nextErrors.dateOfBirth = 'Date of birth cannot be in the future.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setBusy(true);
    try { await onSave(form); }
    catch (error) { setErrors({ form: error.message }); }
    finally { setBusy(false); }
  }

  function uploadPhoto(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setPhotoError('Choose an image file.'); return; }
    if (file.size > 1_500_000) { setPhotoError('Photo must be smaller than 1.5 MB.'); return; }
    const reader = new FileReader();
    reader.onload = () => { field('photo', reader.result); setPhotoError(''); };
    reader.readAsDataURL(file);
  }

  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="modal student-form-modal" role="dialog" aria-modal="true" aria-labelledby="student-form-title"><div className="modal-header"><div><span className="eyebrow">STUDENT RECORD</span><h2 id="student-form-title">{isEdit ? 'Edit student' : 'Add student'}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={19} /></button></div><form onSubmit={submit}><div className="modal-body"><div className="student-id-row"><span>Student ID</span><strong>{form.id}</strong></div>{errors.form && <p className="form-error">{errors.form}</p>}<div className="form-grid"><FormInput label="Full name" required value={form.fullName} onChange={(value) => field('fullName', value)} error={errors.fullName} /><FormInput label="Father's name" value={form.fatherName} onChange={(value) => field('fatherName', value)} /><FormInput label="Date of birth" type="date" value={form.dateOfBirth} onChange={(value) => field('dateOfBirth', value)} error={errors.dateOfBirth} /><label>Gender<select value={form.gender} onChange={(event) => field('gender', event.target.value)}><option value="">Select gender</option><option>Female</option><option>Male</option><option>Other</option></select></label><label>Class / grade <span className="required">*</span><input list="class-options" value={form.className} onChange={(event) => field('className', event.target.value)} placeholder="e.g. Grade 8" /><datalist id="class-options">{existingClasses.map((name) => <option key={name} value={name} />)}</datalist>{errors.className && <small className="field-error">{errors.className}</small>}</label><FormInput label="Section" value={form.section} onChange={(value) => field('section', value)} /><FormInput label="Roll number" required value={form.rollNumber} onChange={(value) => field('rollNumber', value)} error={errors.rollNumber} /><FormInput label="Student phone" type="tel" value={form.phone} onChange={(value) => field('phone', value)} /><FormInput label="Parent / guardian phone" type="tel" value={form.guardianPhone} onChange={(value) => field('guardianPhone', value)} /><FormInput label="Email address" type="email" value={form.email} onChange={(value) => field('email', value)} error={errors.email} /><FormInput label="Admission date" type="date" value={form.admissionDate} onChange={(value) => field('admissionDate', value)} /><label>Status<select value={form.status} onChange={(event) => field('status', event.target.value)}><option>Active</option><option>Inactive</option></select></label><label className="field-wide">Complete address<textarea rows="2" value={form.address} onChange={(event) => field('address', event.target.value)} /></label><div className="field-wide photo-field"><div className="photo-preview">{form.photo ? <img src={form.photo} alt="Student" /> : <Users size={22} />}</div><div><strong>Student photo</strong><small>Local image, up to 1.5 MB</small>{photoError && <small className="field-error">{photoError}</small>}</div><label className="button button-secondary file-picker">Choose photo<input type="file" accept="image/*" onChange={uploadPhoto} /></label></div></div></div><div className="modal-actions"><button className="button button-secondary" type="button" onClick={onClose}>Cancel</button><button className="button button-primary" disabled={busy}>{busy ? 'Saving…' : isEdit ? 'Save changes' : 'Save student'}</button></div></form></section></div>;
}

function FormInput({ label, value, onChange, type = 'text', required = false, error }) {
  return <label>{label}{required && <span className="required"> *</span>}<input type={type} value={value || ''} onChange={(event) => onChange(event.target.value)} />{error && <small className="field-error">{error}</small>}</label>;
}

function StudentView({ student, settings, onClose, onEdit, onCard, onPdf }) {
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="modal details-modal" role="dialog" aria-modal="true"><div className="modal-header"><div><span className="eyebrow">STUDENT PROFILE</span><h2>Student details</h2></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={19} /></button></div><div className="profile-banner">{student.photo ? <img src={student.photo} alt="" /> : <span className="profile-avatar">{student.fullName.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</span>}<div><h3>{student.fullName}</h3><span>{student.id}</span></div><span className={`status-badge ${student.status.toLowerCase()}`}><i />{student.status}</span></div><dl className="details-grid">{[['Father’s name', student.fatherName], ['Date of birth', student.dateOfBirth], ['Gender', student.gender], ['Class / section', `${student.className || '—'} / ${student.section || '—'}`], ['Roll number', student.rollNumber], ['Admission date', student.admissionDate], ['Phone', student.phone], ['Parent / guardian phone', student.guardianPhone], ['Email', student.email], ['Address', student.address]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || '—'}</dd></div>)}</dl><div className="modal-actions detail-actions"><button className="button button-secondary" onClick={() => window.print()}><Printer size={16} />Print profile</button><button className="button button-secondary" onClick={onPdf}><Download size={16} />Download PDF</button><button className="button button-secondary" onClick={onCard}><ClipboardList size={16} />ID card</button><button className="button button-primary" onClick={onEdit}><Pencil size={16} />Edit student</button></div><div className="sr-only">{settings.schoolName}</div></section></div>;
}

function IdCard({ student, settings, onClose }) {
  function printCard() { window.print(); }
  function downloadCard() {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [86, 54] });
    doc.setFillColor(36, 92, 78); doc.rect(0, 0, 86, 14, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(9);
    if (settings.logo) {
      try { doc.addImage(settings.logo, 3, 3, 8, 8); } catch { /* Unsupported local image format is omitted from this PDF. */ }
    }
    doc.text(settings.schoolName || 'School', settings.logo ? 14 : 5, 9);
    doc.setTextColor(31, 42, 37); doc.setFontSize(11); doc.text(student.fullName, 5, 23);
    doc.setFontSize(7); doc.setTextColor(92, 105, 98);
    const lines = [`ID: ${student.id}`, `Roll: ${student.rollNumber || '—'}`, `Class: ${student.className || '—'} / ${student.section || '—'}`, `Father: ${student.fatherName || '—'}`, `Admitted: ${student.admissionDate || '—'}`];
    lines.forEach((line, index) => doc.text(line, 5, 30 + index * 4));
    if (settings.phone) doc.text(String(settings.phone), 5, 51);
    if (student.photo) {
      try { doc.addImage(student.photo, 67, 18, 14, 18); } catch { /* Unsupported local image format is omitted from this PDF. */ }
    }
    doc.save(`${student.id}-id-card.pdf`);
  }
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="modal card-modal" role="dialog" aria-modal="true"><div className="modal-header no-print"><div><span className="eyebrow">IDENTIFICATION</span><h2>Student ID card</h2></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={19} /></button></div><div className="id-card print-card"><div className="id-card-top">{settings.logo ? <img src={settings.logo} alt="School logo" /> : <span className="id-logo"><GraduationCap size={20} /></span>}<div><strong>{settings.schoolName || 'School'}</strong><small>STUDENT IDENTIFICATION</small></div></div><div className="id-card-body">{student.photo ? <img className="id-photo" src={student.photo} alt="Student" /> : <div className="id-photo id-placeholder"><Users size={24} /></div>}<div className="id-info"><h3>{student.fullName}</h3><strong className="id-number">{student.id}</strong><div><span>ROLL</span><b>{student.rollNumber || '—'}</b></div><div><span>CLASS</span><b>{student.className || '—'} / {student.section || '—'}</b></div></div></div><div className="id-card-bottom"><span>Father: {student.fatherName || '—'}</span><span>Admitted: {student.admissionDate || '—'}</span></div><div className="id-card-contact">{[settings.phone, settings.email].filter(Boolean).join(' · ') || settings.address || ' '}</div></div><div className="modal-actions no-print"><button className="button button-secondary" onClick={onClose}>Close</button><button className="button button-secondary" onClick={downloadCard}><Download size={16} />Download PDF</button><button className="button button-primary" onClick={printCard}><Printer size={16} />Print ID card</button></div></section></div>;
}

export default App;