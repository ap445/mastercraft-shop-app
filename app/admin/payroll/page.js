'use client';
import '../../globals.css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import BrandMark from '../../components/BrandMark';
import RoleNav from '../../components/RoleNav';

const ENTRY_TYPES = ['direct', 'indirect', 'break', 'training', 'pto', 'holiday'];
const ENTRY_LABEL = { direct: 'Direct (job)', indirect: 'Indirect / shop', break: 'Break', training: 'Training', pto: 'PTO', holiday: 'Holiday' };

function hoursFmt(h) { return (Math.round((h || 0) * 100) / 100).toFixed(2); }
function money(n) { return '$' + (Math.round((n || 0) * 100) / 100).toFixed(2); }
function fmtDateTime(s) { if (!s) return '—'; const d = new Date(s); return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); }
function toLocalInput(iso) { if (!iso) return ''; const d = new Date(iso); const pad = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function fromLocalInput(v) { if (!v) return null; return new Date(v).toISOString(); }
function todayStr() { const d = new Date(); const pad = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function daysAgoStr(n) { const d = new Date(); d.setDate(d.getDate() - n); const pad = x => String(x).padStart(2, '0'); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
function localYmd(iso) { if (!iso) return null; const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function startOfWeek(d) { const x = new Date(d); x.setDate(x.getDate() - x.getDay()); x.setHours(0, 0, 0, 0); return x; }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function ymdKey(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
const WORK_TYPES = ['direct', 'indirect', 'training', 'break'];
function dayStatus(employeeId, dateKey, timeEntries) {
  const entries = timeEntries.filter(t => String(t.employee_id) === String(employeeId) && localYmd(t.started_at) === dateKey);
  const hours = entries.reduce((s, t) => s + Number(t.hours || 0), 0);
  const types = new Set(entries.map(t => t.entry_type));
  let status = 'none';
  if (WORK_TYPES.some(t => types.has(t))) status = 'worked';
  else if (types.has('pto')) status = 'pto';
  else if (types.has('holiday')) status = 'holiday';
  return { status, hours };
}
function csvValue(value) { const text = String(value ?? ''); return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; }
function downloadCsv(filename, rows) {
  const blob = new Blob([rows.map(r => r.map(csvValue).join(',')).join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const blankTimeEntry = { id: '', employeeId: '', jobId: '', operationId: '', entryType: 'direct', startedAt: '', stoppedAt: '', notes: '' };
const blankMaterialTx = { id: '', jobId: '', operationId: '', materialId: '', employeeId: '', transactionType: 'issue', quantity: '', unitCost: '', occurredAt: '', notes: '' };

export default function PayrollPage() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [teForm, setTeForm] = useState(blankTimeEntry);
  const [teFilterEmployee, setTeFilterEmployee] = useState('');
  const [mtForm, setMtForm] = useState(blankMaterialTx);
  const [mtFilterEmployee, setMtFilterEmployee] = useState('');
  const [payStart, setPayStart] = useState(() => daysAgoStr(6));
  const [payEnd, setPayEnd] = useState(() => todayStr());
  const [attView, setAttView] = useState('daily');
  const [attDate, setAttDate] = useState(() => todayStr());
  const [attWeekAnchor, setAttWeekAnchor] = useState(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; });

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/setup', { cache: 'no-store' });
    if (res.status === 401 || res.status === 403) { router.push('/login'); return null; }
    const json = await res.json();
    if (!res.ok) { setError(json.error); return null; }
    setData(json);
    return json;
  }, [router]);
  useEffect(() => { load(); }, [load]);

  async function logout() { await fetch('/api/auth/logout', { method: 'POST' }); router.push('/login'); router.refresh(); }

  function teChange(key, value) { setTeForm(f => ({ ...f, [key]: value })); }
  function mtChange(key, value) { setMtForm(f => ({ ...f, [key]: value })); }

  function editTimeEntry(te) {
    setTeForm({ id: te.id, employeeId: String(te.employee_id), jobId: te.job_id ? String(te.job_id) : '', operationId: te.operation_id ? String(te.operation_id) : '', entryType: te.entry_type, startedAt: toLocalInput(te.started_at), stoppedAt: toLocalInput(te.stopped_at), notes: te.notes || '' });
    document.getElementById('time-entries')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function editMaterialTx(mt) {
    setMtForm({ id: mt.id, jobId: String(mt.job_id), operationId: mt.operation_id ? String(mt.operation_id) : '', materialId: mt.material_id ? String(mt.material_id) : '', employeeId: String(mt.employee_id), transactionType: mt.transaction_type, quantity: String(mt.quantity), unitCost: mt.unit_cost ?? '', occurredAt: toLocalInput(mt.occurred_at), notes: mt.notes || (mt.custom_material_name ? `Originally logged as "${mt.custom_material_name}"` : '') });
    document.getElementById('material-log')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function saveTimeEntry(e) {
    e.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const body = { type: 'timeEntry', id: teForm.id || undefined, employeeId: Number(teForm.employeeId), jobId: teForm.jobId ? Number(teForm.jobId) : null, operationId: teForm.operationId ? Number(teForm.operationId) : null, entryType: teForm.entryType, startedAt: fromLocalInput(teForm.startedAt), stoppedAt: fromLocalInput(teForm.stoppedAt), notes: teForm.notes };
      const res = await fetch('/api/admin/setup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      await load();
      setTeForm(blankTimeEntry);
      setNotice(teForm.id ? 'Time entry updated.' : 'Time entry added.');
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  async function removeTimeEntry(id) {
    if (!confirm('Remove this time entry? This cannot be undone.')) return;
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/admin/setup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'timeEntryDelete', id }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      await load();
      setNotice('Time entry removed.');
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  async function saveMaterialTx(e) {
    e.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const body = { type: 'materialTransaction', id: mtForm.id || undefined, jobId: Number(mtForm.jobId), operationId: mtForm.operationId ? Number(mtForm.operationId) : null, materialId: Number(mtForm.materialId), employeeId: Number(mtForm.employeeId), transactionType: mtForm.transactionType, quantity: mtForm.quantity, unitCost: mtForm.unitCost, occurredAt: fromLocalInput(mtForm.occurredAt), notes: mtForm.notes };
      const res = await fetch('/api/admin/setup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      await load();
      setMtForm(blankMaterialTx);
      setNotice(mtForm.id ? 'Material log entry updated.' : 'Material log entry added.');
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  async function removeMaterialTx(id) {
    if (!confirm('Remove this material log entry? This cannot be undone.')) return;
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/admin/setup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'materialTransactionDelete', id }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      await load();
      setNotice('Material log entry removed.');
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  const timeEntryRows = useMemo(() => {
    if (!data) return [];
    let rows = data.timeEntries;
    if (teFilterEmployee) rows = rows.filter(t => String(t.employee_id) === String(teFilterEmployee));
    return rows.slice(0, 300);
  }, [data, teFilterEmployee]);

  const materialTxRows = useMemo(() => {
    if (!data) return [];
    let rows = data.materialTransactions;
    if (mtFilterEmployee) rows = rows.filter(m => String(m.employee_id) === String(mtFilterEmployee));
    return rows.slice(0, 300);
  }, [data, mtFilterEmployee]);

  const operationsForJob = (jobId) => (data?.operations || []).filter(o => String(o.job_id) === String(jobId));

  const payrollRows = useMemo(() => {
    if (!data || !payStart || !payEnd) return [];
    const start = new Date(payStart + 'T00:00:00');
    const end = new Date(payEnd + 'T00:00:00'); end.setDate(end.getDate() + 1);
    const byEmployee = {};
    data.timeEntries.forEach(te => {
      const started = new Date(te.started_at);
      if (started < start || started >= end) return;
      const key = te.employee_id;
      if (!byEmployee[key]) byEmployee[key] = { employeeId: key, employeeName: te.employee_name, byType: {}, total: 0 };
      const hrs = Number(te.hours || 0);
      byEmployee[key].byType[te.entry_type] = (byEmployee[key].byType[te.entry_type] || 0) + hrs;
      byEmployee[key].total += hrs;
    });
    return Object.values(byEmployee).sort((a, b) => a.employeeName.localeCompare(b.employeeName));
  }, [data, payStart, payEnd]);

  const activeEmployees = useMemo(() => (data?.employees || []).filter(e => e.active !== false).sort((a, b) => a.full_name.localeCompare(b.full_name)), [data]);

  const dailyAttendance = useMemo(() => {
    if (!data) return [];
    const rows = activeEmployees.map(e => ({ employee: e, ...dayStatus(e.id, attDate, data.timeEntries) }));
    return rows.sort((a, b) => (a.status === 'none' ? 0 : 1) - (b.status === 'none' ? 0 : 1) || a.employee.full_name.localeCompare(b.employee.full_name));
  }, [data, activeEmployees, attDate]);
  const missingToday = dailyAttendance.filter(r => r.status === 'none').length;

  const weekDays = useMemo(() => { const ws = startOfWeek(attWeekAnchor); return Array.from({ length: 7 }, (_, i) => addDays(ws, i)); }, [attWeekAnchor]);
  const weeklyAttendance = useMemo(() => {
    if (!data) return [];
    return activeEmployees.map(e => {
      const days = weekDays.map((d, i) => ({ date: d, i, ...dayStatus(e.id, ymdKey(d), data.timeEntries) }));
      const missedWeekdays = days.filter(d => d.i >= 1 && d.i <= 5 && d.status === 'none').length;
      return { employee: e, days, missedWeekdays };
    });
  }, [data, activeEmployees, weekDays]);

  function exportPayrollCsv() {
    const rows = [
      ['Employee', ...ENTRY_TYPES.map(t => ENTRY_LABEL[t]), 'Total Hours', 'Period Start', 'Period End'],
      ...payrollRows.map(r => [r.employeeName, ...ENTRY_TYPES.map(t => hoursFmt(r.byType[t] || 0)), hoursFmt(r.total), payStart, payEnd])
    ];
    downloadCsv(`mastercraft-payroll-${payStart}-to-${payEnd}.csv`, rows);
  }

  if (!data) return <main className="shell"><div className="container">{error ? <div className="card"><div className="alert error">{error}</div></div> : <div className="card">Loading payroll data...</div>}</div></main>;

  return <main className="shell">
    <div className="topbar">
      <a className="brand" href="/admin"><BrandMark />MASTERCRAFT ADMIN</a>
      <div className="navlinks">
        <a className="navlink" href="/admin">Setup</a>
        <a className="navlink" href="#attendance">Attendance</a>
        <a className="navlink" href="/admin/costing">Job Costing</a>
        <RoleNav current="admin" />
        <button className="toplink" onClick={logout}>Sign out</button>
      </div>
    </div>
    <div className="container">
      <div className="card">
        <div className="kicker">Administration</div>
        <h1>Payroll &amp; time corrections</h1>
        <p className="muted">Fix a missed clock-in/out or material log here, then pull total hours per employee for payroll below. Nothing here changes what employees see — it just corrects or adds to the same record they log to.</p>
        {error && <div className="alert error">{error}</div>}
        {notice && <div className="alert success">{notice}</div>}
      </div>

      <section id="time-entries" className="card">
        <div className="kicker">Time entries</div>
        <h2>{teForm.id ? 'Edit a time entry' : 'Add a missed time entry'}</h2>
        <p className="muted">Use this when someone forgot to clock in, forgot to clock out, or needs PTO/holiday/indirect time logged on their behalf.</p>
        <form onSubmit={saveTimeEntry}>
          <div className="grid two">
            <div className="field"><label>Employee</label><select value={teForm.employeeId} onChange={e => teChange('employeeId', e.target.value)}><option value="">Select employee</option>{data.employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}</select></div>
            <div className="field"><label>Type</label><select value={teForm.entryType} onChange={e => teChange('entryType', e.target.value)}>{ENTRY_TYPES.map(t => <option key={t} value={t}>{ENTRY_LABEL[t]}</option>)}</select></div>
          </div>
          <div className="grid two">
            <div className="field"><label>Job (optional)</label><select value={teForm.jobId} onChange={e => teChange('jobId', e.target.value)}><option value="">No job</option>{data.jobs.map(j => <option key={j.id} value={j.id}>{j.job_number} — {j.description}</option>)}</select></div>
            <div className="field"><label>Operation (optional)</label><select value={teForm.operationId} onChange={e => teChange('operationId', e.target.value)} disabled={!teForm.jobId}><option value="">No operation</option>{operationsForJob(teForm.jobId).map(o => <option key={o.id} value={o.id}>#{o.sequence_no} {o.operation_name}</option>)}</select></div>
          </div>
          <div className="grid two">
            <div className="field"><label>Started</label><input type="datetime-local" value={teForm.startedAt} onChange={e => teChange('startedAt', e.target.value)} /></div>
            <div className="field"><label>Stopped (blank = still running)</label><input type="datetime-local" value={teForm.stoppedAt} onChange={e => teChange('stoppedAt', e.target.value)} /></div>
          </div>
          <div className="field"><label>Notes (optional)</label><input value={teForm.notes} onChange={e => teChange('notes', e.target.value)} placeholder="e.g. forgot to clock out, corrected from timesheet" /></div>
          <button disabled={busy} className="btn primary">{teForm.id ? 'SAVE' : 'ADD TIME ENTRY'}</button>
          {teForm.id ? <button type="button" className="btn secondary" onClick={() => setTeForm(blankTimeEntry)}>CANCEL EDIT</button> : null}
        </form>

        <div className="kicker" style={{ marginTop: '20px' }}>Recent time entries</div>
        <div className="field" style={{ maxWidth: '280px' }}><label>Filter by employee</label><select value={teFilterEmployee} onChange={e => setTeFilterEmployee(e.target.value)}><option value="">All employees</option>{data.employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}</select></div>
        <div className="table-wrap">
          <table className="table compact-table">
            <thead><tr><th>Employee</th><th>Type</th><th>Job</th><th>Started</th><th>Stopped</th><th>Hours</th><th>Notes</th><th></th></tr></thead>
            <tbody>
              {timeEntryRows.length === 0 ? <tr><td colSpan="8" className="muted">No time entries yet.</td></tr> : timeEntryRows.map(te => (
                <tr key={te.id}>
                  <td>{te.employee_name}</td>
                  <td><span className="badge">{ENTRY_LABEL[te.entry_type] || te.entry_type}</span></td>
                  <td>{te.job_number || '—'}</td>
                  <td>{fmtDateTime(te.started_at)}</td>
                  <td>{te.stopped_at ? fmtDateTime(te.stopped_at) : <span className="badge active">still running</span>}</td>
                  <td>{hoursFmt(te.hours)}</td>
                  <td>{te.notes || (te.adjusted_by_name ? <span className="muted">corrected by {te.adjusted_by_name}</span> : '—')}</td>
                  <td><button type="button" className="xref" onClick={() => editTimeEntry(te)}>Edit</button> · <button type="button" className="xref" onClick={() => removeTimeEntry(te.id)}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.timeEntries.length > 300 ? <p className="hint">Showing the 300 most recent. Filter by employee to narrow it down.</p> : null}
      </section>

      <section id="material-log" className="card">
        <div className="kicker">Material log</div>
        <h2>{mtForm.id ? 'Edit a material log entry' : 'Add a missed material entry'}</h2>
        <p className="muted">Use this when someone forgot to log material they issued or returned on a job.</p>
        <form onSubmit={saveMaterialTx}>
          <div className="grid two">
            <div className="field"><label>Job</label><select value={mtForm.jobId} onChange={e => mtChange('jobId', e.target.value)}><option value="">Select job</option>{data.jobs.map(j => <option key={j.id} value={j.id}>{j.job_number} — {j.description}</option>)}</select></div>
            <div className="field"><label>Operation (optional)</label><select value={mtForm.operationId} onChange={e => mtChange('operationId', e.target.value)} disabled={!mtForm.jobId}><option value="">No operation</option>{operationsForJob(mtForm.jobId).map(o => <option key={o.id} value={o.id}>#{o.sequence_no} {o.operation_name}</option>)}</select></div>
          </div>
          <div className="grid two">
            <div className="field"><label>Material</label><select value={mtForm.materialId} onChange={e => mtChange('materialId', e.target.value)}><option value="">Select material</option>{data.materials.filter(m => m.active).map(m => <option key={m.id} value={m.id}>{m.item_code} — {m.description} ({m.unit_of_measure})</option>)}</select></div>
            <div className="field"><label>Employee</label><select value={mtForm.employeeId} onChange={e => mtChange('employeeId', e.target.value)}><option value="">Select employee</option>{data.employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}</select></div>
          </div>
          <div className="grid two">
            <div className="field"><label>Type</label><select value={mtForm.transactionType} onChange={e => mtChange('transactionType', e.target.value)}><option value="issue">Issue / Use</option><option value="return">Return</option></select></div>
            <div className="field"><label>Quantity</label><input inputMode="decimal" value={mtForm.quantity} onChange={e => mtChange('quantity', e.target.value)} placeholder="10" /></div>
          </div>
          <div className="grid two">
            <div className="field"><label>Unit cost (optional — defaults to standard cost)</label><input inputMode="decimal" value={mtForm.unitCost} onChange={e => mtChange('unitCost', e.target.value)} placeholder="e.g. 12.50" /></div>
            <div className="field"><label>Occurred (blank = now)</label><input type="datetime-local" value={mtForm.occurredAt} onChange={e => mtChange('occurredAt', e.target.value)} /></div>
          </div>
          <div className="field"><label>Notes (optional)</label><input value={mtForm.notes} onChange={e => mtChange('notes', e.target.value)} placeholder="e.g. forgot to log at the time" /></div>
          <button disabled={busy} className="btn primary">{mtForm.id ? 'SAVE' : 'ADD MATERIAL ENTRY'}</button>
          {mtForm.id ? <button type="button" className="btn secondary" onClick={() => setMtForm(blankMaterialTx)}>CANCEL EDIT</button> : null}
        </form>

        <div className="kicker" style={{ marginTop: '20px' }}>Recent material log</div>
        <div className="field" style={{ maxWidth: '280px' }}><label>Filter by employee</label><select value={mtFilterEmployee} onChange={e => setMtFilterEmployee(e.target.value)}><option value="">All employees</option>{data.employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}</select></div>
        <div className="table-wrap">
          <table className="table compact-table">
            <thead><tr><th>Job</th><th>Material</th><th>Type</th><th>Qty</th><th>Total</th><th>Employee</th><th>Date</th><th></th></tr></thead>
            <tbody>
              {materialTxRows.length === 0 ? <tr><td colSpan="8" className="muted">No material log entries yet.</td></tr> : materialTxRows.map(mt => (
                <tr key={mt.id}>
                  <td>{mt.job_number || '—'}</td>
                  <td><strong>{mt.item_code}</strong> {mt.material_description}</td>
                  <td><span className="badge">{mt.transaction_type}</span></td>
                  <td>{mt.quantity} {mt.unit_of_measure}</td>
                  <td>{money(Number(mt.quantity) * Number(mt.unit_cost || 0))}</td>
                  <td>{mt.employee_name}</td>
                  <td>{fmtDateTime(mt.occurred_at)}</td>
                  <td><button type="button" className="xref" onClick={() => editMaterialTx(mt)}>Edit</button> · <button type="button" className="xref" onClick={() => removeMaterialTx(mt.id)}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.materialTransactions.length > 300 ? <p className="hint">Showing the 300 most recent. Filter by employee to narrow it down.</p> : null}
      </section>

      <section id="attendance" className="card">
        <div className="kicker">Attendance</div>
        <h2>Who clocked in?</h2>
        <p className="muted">See who logged time on a given day or across a week, and spot anyone who didn't right away.</p>
        <div className="cal-toolbar-right" style={{ marginBottom: '14px' }}>
          <button type="button" className={"cal-nav-btn" + (attView === 'daily' ? ' active' : '')} onClick={() => setAttView('daily')}>Daily</button>
          <button type="button" className={"cal-nav-btn" + (attView === 'weekly' ? ' active' : '')} onClick={() => setAttView('weekly')}>Weekly</button>
        </div>
        {attView === 'daily' ? <>
          <div className="field" style={{ maxWidth: '220px' }}><label>Date</label><input type="date" value={attDate} onChange={e => setAttDate(e.target.value)} /></div>
          {missingToday > 0 ? <div className="alert error">{missingToday} of {activeEmployees.length} employees did not clock in on {attDate}.</div> : <div className="alert success">Everyone clocked in on {attDate}.</div>}
          <div className="table-wrap"><table className="table compact-table">
            <thead><tr><th>Employee</th><th>Department</th><th>Status</th><th>Hours</th></tr></thead>
            <tbody>
              {dailyAttendance.length === 0 ? <tr><td colSpan="4" className="muted">No active employees.</td></tr> : dailyAttendance.map(r => (
                <tr key={r.employee.id}>
                  <td>{r.employee.full_name}</td>
                  <td>{r.employee.department_name || '—'}</td>
                  <td>{r.status === 'none' ? <span className="badge" style={{ background: '#fee2e2', color: '#991b1b' }}>No clock-in</span> : r.status === 'worked' ? <span className="badge active">Worked</span> : <span className="badge">{cap(r.status)}</span>}</td>
                  <td>{r.hours ? hoursFmt(r.hours) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </> : <>
          <div className="cal-toolbar-left" style={{ marginBottom: '10px' }}>
            <button type="button" className="cal-nav-btn" onClick={() => setAttWeekAnchor(a => addDays(a, -7))}>‹</button>
            <button type="button" className="cal-nav-btn" onClick={() => { const d = new Date(); d.setHours(0, 0, 0, 0); setAttWeekAnchor(d); }}>This week</button>
            <button type="button" className="cal-nav-btn" onClick={() => setAttWeekAnchor(a => addDays(a, 7))}>›</button>
            <strong className="cal-label" style={{ marginLeft: '8px' }}>{weekDays[0].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – {weekDays[6].toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</strong>
          </div>
          <div className="table-wrap"><table className="table compact-table">
            <thead><tr><th>Employee</th>{weekDays.map(d => <th key={ymdKey(d)}>{d.toLocaleDateString(undefined, { weekday: 'short' })}<br />{d.getMonth() + 1}/{d.getDate()}</th>)}<th>Missed weekdays</th></tr></thead>
            <tbody>
              {weeklyAttendance.length === 0 ? <tr><td colSpan="9" className="muted">No active employees.</td></tr> : weeklyAttendance.map(r => (
                <tr key={r.employee.id}>
                  <td>{r.employee.full_name}</td>
                  {r.days.map(d => <td key={ymdKey(d.date)} style={d.status === 'none' && d.i >= 1 && d.i <= 5 ? { background: '#fee2e2' } : undefined}>{d.status === 'none' ? '—' : d.status === 'worked' ? hoursFmt(d.hours) : cap(d.status)}</td>)}
                  <td>{r.missedWeekdays > 0 ? <strong style={{ color: '#991b1b' }}>{r.missedWeekdays}</strong> : '0'}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
          <p className="hint">Weekend cells aren't flagged as missed — only Monday through Friday.</p>
        </>}
      </section>

      <section id="payroll-report" className="card">
        <div className="kicker">Payroll report</div>
        <h2>Hours by employee</h2>
        <p className="muted">Pick a date range (your pay period) to see total hours per employee, broken out by type. This adds up every clock-in/out in that range, including anything corrected above.</p>
        <div className="grid two">
          <div className="field"><label>Start date</label><input type="date" value={payStart} onChange={e => setPayStart(e.target.value)} /></div>
          <div className="field"><label>End date</label><input type="date" value={payEnd} onChange={e => setPayEnd(e.target.value)} /></div>
        </div>
        <button type="button" className="btn secondary compact" onClick={exportPayrollCsv}>EXPORT CSV</button>
        <div className="table-wrap" style={{ marginTop: '14px' }}>
          <table className="table compact-table">
            <thead><tr><th>Employee</th>{ENTRY_TYPES.map(t => <th key={t}>{ENTRY_LABEL[t]}</th>)}<th>Total</th></tr></thead>
            <tbody>
              {payrollRows.length === 0 ? <tr><td colSpan={ENTRY_TYPES.length + 2} className="muted">No time logged in this range.</td></tr> : payrollRows.map(r => (
                <tr key={r.employeeId}>
                  <td><strong>{r.employeeName}</strong></td>
                  {ENTRY_TYPES.map(t => <td key={t}>{hoursFmt(r.byType[t] || 0)}</td>)}
                  <td><strong>{hoursFmt(r.total)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="hint">A still-running timer counts up through right now. If someone's on the clock when you run this, stop their timer first (or correct it above) for a final number.</p>
      </section>
    </div>
  </main>;
}
