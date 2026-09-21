'use client';
import '../../globals.css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

function hoursFmt(h) { return (Math.round((h || 0) * 100) / 100).toFixed(2); }
function money(n) { return '$' + (Math.round((n || 0) * 100) / 100).toFixed(2); }
function fmtDateTime(s) { if (!s) return '—'; const d = new Date(s); return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); }
function csvValue(value) { const text = String(value ?? ''); return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; }
function Xref({ type, id, children }) { if (!id) return children ?? '—'; return <a className="xref" href={`/admin?detail=${type}-${id}#records`}>{children}</a>; }
function downloadCsv(filename, rows) {
  const blob = new Blob([rows.map(r => r.map(csvValue).join(',')).join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function JobCostingPage() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [selectedJobId, setSelectedJobId] = useState(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/costing', { cache: 'no-store' });
    if (res.status === 401 || res.status === 403) { router.push('/login'); return; }
    const json = await res.json();
    if (!res.ok) setError(json.error);
    else setData(json);
  }, [router]);
  useEffect(() => { load(); }, [load]);

  async function logout() { await fetch('/api/auth/logout', { method: 'POST' }); router.push('/login'); router.refresh(); }

  const jobRows = useMemo(() => {
    if (!data) return [];
    const actualHoursByJob = {};
    const openCountByJob = {};
    data.timeEntries.forEach(te => {
      if (!te.job_id) return;
      actualHoursByJob[te.job_id] = (actualHoursByJob[te.job_id] || 0) + Number(te.hours || 0);
      if (!te.stopped_at) openCountByJob[te.job_id] = (openCountByJob[te.job_id] || 0) + 1;
    });
    const materialCostByJob = {};
    data.materialTransactions.forEach(mt => {
      if (!mt.job_id) return;
      const amt = Number(mt.quantity || 0) * Number(mt.unit_cost || 0) * (mt.transaction_type === 'return' ? -1 : 1);
      materialCostByJob[mt.job_id] = (materialCostByJob[mt.job_id] || 0) + amt;
    });
    const plannedMaterialCostByJob = {};
    (data.jobMaterials || []).forEach(jm => {
      const amt = Number(jm.planned_quantity || 0) * Number(jm.standard_cost || 0);
      plannedMaterialCostByJob[jm.job_id] = (plannedMaterialCostByJob[jm.job_id] || 0) + amt;
    });
    return data.jobs.map(j => {
      const estimated = Number(j.estimated_hours || 0);
      const actual = actualHoursByJob[j.id] || 0;
      const plannedMaterialCost = plannedMaterialCostByJob[j.id] || 0;
      const materialCost = materialCostByJob[j.id] || 0;
      return {
        ...j,
        estimatedHours: estimated,
        actualHours: actual,
        variance: actual - estimated,
        materialCost,
        plannedMaterialCost,
        materialVariance: materialCost - plannedMaterialCost,
        opsTotal: Number(j.operations_total || 0),
        opsComplete: Number(j.operations_complete || 0),
        activeNow: openCountByJob[j.id] || 0
      };
    });
  }, [data]);

  const selectedJob = jobRows.find(j => String(j.id) === String(selectedJobId)) || null;
  const selectedTimeEntries = data && selectedJobId ? data.timeEntries.filter(te => String(te.job_id) === String(selectedJobId)) : [];
  const selectedMaterialTx = data && selectedJobId ? data.materialTransactions.filter(mt => String(mt.job_id) === String(selectedJobId)) : [];
  const selectedPlannedMaterials = data && selectedJobId ? (data.jobMaterials || []).filter(jm => String(jm.job_id) === String(selectedJobId)) : [];

  function exportJobCsv(job) {
    const te = data.timeEntries.filter(t => String(t.job_id) === String(job.id));
    const mt = data.materialTransactions.filter(m => String(m.job_id) === String(job.id));
    const jm = (data.jobMaterials || []).filter(m => String(m.job_id) === String(job.id));
    const rows = [
      ['Job', 'Customer', 'Description', 'Status', 'Estimated Hours', 'Actual Hours', 'Variance (Actual - Estimated)', 'Planned Material Cost', 'Actual Material Cost', 'Material Variance (Actual - Planned)'],
      [job.job_number, job.customer_name || '', job.description || '', job.status, hoursFmt(job.estimatedHours), hoursFmt(job.actualHours), hoursFmt(job.variance), job.plannedMaterialCost.toFixed(2), job.materialCost.toFixed(2), job.materialVariance.toFixed(2)],
      [],
      ['Time Entries'],
      ['Employee', 'Operation', 'Started', 'Stopped', 'Hours'],
      ...te.map(t => [t.employee_name, t.operation_name || '', t.started_at, t.stopped_at || 'still running', hoursFmt(t.hours)]),
      [],
      ['Planned Materials'],
      ['Material', 'Planned Quantity', 'Standard Cost', 'Planned Total', 'Notes'],
      ...jm.map(m => [`${m.item_code} — ${m.material_description}`, m.planned_quantity, m.standard_cost ?? '', (Number(m.planned_quantity) * Number(m.standard_cost || 0)).toFixed(2), m.notes || '']),
      [],
      ['Material Transactions (Actual)'],
      ['Material', 'Type', 'Quantity', 'Unit Cost', 'Total', 'Employee', 'Date'],
      ...mt.map(m => [`${m.item_code} — ${m.material_description}`, m.transaction_type, m.quantity, m.unit_cost ?? '', (Number(m.quantity) * Number(m.unit_cost || 0)).toFixed(2), m.employee_name, m.occurred_at])
    ];
    downloadCsv(`${job.job_number}-cost-detail.csv`, rows);
  }

  function exportSummaryCsv() {
    const rows = [
      ['Job', 'Customer', 'Status', 'Operations Complete', 'Operations Total', 'Estimated Hours', 'Actual Hours', 'Variance', 'Planned Material Cost', 'Actual Material Cost', 'Material Variance'],
      ...jobRows.map(j => [j.job_number, j.customer_name || '', j.status, j.opsComplete, j.opsTotal, hoursFmt(j.estimatedHours), hoursFmt(j.actualHours), hoursFmt(j.variance), j.plannedMaterialCost.toFixed(2), j.materialCost.toFixed(2), j.materialVariance.toFixed(2)])
    ];
    downloadCsv('mastercraft-job-costing-summary.csv', rows);
  }

  if (!data) return <main className="shell"><div className="container">{error ? <div className="card"><div className="alert error">{error}</div></div> : <div className="card">Loading job costing...</div>}</div></main>;

  return <main className="shell">
    <div className="topbar">
      <a className="brand" href="/admin">MASTERCRAFT ADMIN</a>
      <div className="navlinks">
        <a className="navlink" href="/admin">Setup</a>
        <a className="navlink" href="/supervisor">Supervisor Board</a>
        <button className="toplink" onClick={logout}>Sign out</button>
      </div>
    </div>
    <div className="container">
      <div className="card">
        <div className="kicker">Administration</div>
        <h1>Job costing</h1>
        <p className="muted">Actual labor hours and material cost for every job, drawn from the timers and material log your team enters on the shop floor. Nothing here is entered by hand.</p>
        <button type="button" className="btn secondary compact" onClick={exportSummaryCsv}>EXPORT ALL JOBS (CSV)</button>
        <p className="hint">A downloaded CSV opens directly in Excel, or in Google Sheets via File → Import → Upload.</p>
      </div>

      <div className="card">
        <div className="kicker">All jobs</div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Job</th><th>Status</th><th>Progress</th><th>Est. hrs</th><th>Actual hrs</th><th>Variance</th><th>Planned materials</th><th>Actual materials</th><th>Material variance</th><th></th></tr></thead>
            <tbody>
              {jobRows.length === 0 ? <tr><td colSpan="10" className="muted">No jobs yet.</td></tr> : jobRows.map(j => (
                <tr key={j.id} style={{ cursor: 'pointer', background: String(j.id) === String(selectedJobId) ? '#f3f4f6' : undefined }} onClick={() => setSelectedJobId(j.id)}>
                  <td><strong>{j.job_number}</strong><br /><span className="muted">{j.customer_name || '—'}</span></td>
                  <td><span className="badge">{String(j.status).replaceAll('_', ' ')}</span>{j.activeNow > 0 ? <span className="badge active"> {j.activeNow} active</span> : null}</td>
                  <td>{j.opsComplete}/{j.opsTotal} ops</td>
                  <td>{hoursFmt(j.estimatedHours)}</td>
                  <td>{hoursFmt(j.actualHours)}</td>
                  <td style={{ color: j.variance > 0 ? '#991b1b' : j.variance < 0 ? '#166534' : undefined, fontWeight: 800 }}>{j.variance > 0 ? '+' : ''}{hoursFmt(j.variance)}</td>
                  <td>{money(j.plannedMaterialCost)}</td>
                  <td>{money(j.materialCost)}</td>
                  <td style={{ color: j.materialVariance > 0 ? '#991b1b' : j.materialVariance < 0 ? '#166534' : undefined, fontWeight: 800 }}>{j.materialVariance > 0 ? '+' : ''}{money(j.materialVariance)}</td>
                  <td><button type="button" className="btn secondary compact" style={{ marginTop: 0, padding: '6px 10px', fontSize: '12px' }} onClick={(e) => { e.stopPropagation(); exportJobCsv(j); }}>CSV</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedJob ? <div className="card">
        <div className="kicker">Detail</div>
        <h2>{selectedJob.job_number} — {selectedJob.description}</h2>
        <p className="muted">{selectedJob.customer_name || 'No customer on file'} · {hoursFmt(selectedJob.actualHours)} of {hoursFmt(selectedJob.estimatedHours)} estimated hours logged · {money(selectedJob.materialCost)} actual vs {money(selectedJob.plannedMaterialCost)} planned in materials · <a href={`/admin?detail=job-${selectedJob.id}#records`}>View full job record (schedule &amp; assignments) →</a></p>

        <div className="kicker" style={{ marginTop: '14px' }}>Planned materials</div>
        <div className="table-wrap">
          <table className="table compact-table">
            <thead><tr><th>Material</th><th>Planned qty</th><th>Planned cost</th><th>Notes</th></tr></thead>
            <tbody>
              {selectedPlannedMaterials.length === 0 ? <tr><td colSpan="4" className="muted">No materials planned for this job yet.</td></tr> : selectedPlannedMaterials.map(jm => (
                <tr key={jm.id}>
                  <td><Xref type="material" id={jm.material_id}><strong>{jm.item_code}</strong> {jm.material_description}</Xref></td>
                  <td>{jm.planned_quantity} {jm.unit_of_measure}</td>
                  <td>{money(Number(jm.planned_quantity) * Number(jm.standard_cost || 0))}</td>
                  <td>{jm.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="kicker" style={{ marginTop: '14px' }}>Time entries</div>
        <div className="table-wrap">
          <table className="table compact-table">
            <thead><tr><th>Employee</th><th>Operation</th><th>Started</th><th>Stopped</th><th>Hours</th></tr></thead>
            <tbody>
              {selectedTimeEntries.length === 0 ? <tr><td colSpan="5" className="muted">No time logged on this job yet.</td></tr> : selectedTimeEntries.map(te => (
                <tr key={te.id}>
                  <td><Xref type="employee" id={te.employee_id}>{te.employee_name}</Xref></td>
                  <td><Xref type="operation" id={te.operation_id}>{te.operation_name || '—'}</Xref></td>
                  <td>{fmtDateTime(te.started_at)}</td>
                  <td>{te.stopped_at ? fmtDateTime(te.stopped_at) : <span className="badge active">still running</span>}</td>
                  <td>{hoursFmt(te.hours)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="kicker" style={{ marginTop: '14px' }}>Material transactions (actual)</div>
        <div className="table-wrap">
          <table className="table compact-table">
            <thead><tr><th>Material</th><th>Type</th><th>Qty</th><th>Total</th><th>Employee</th><th>Date</th></tr></thead>
            <tbody>
              {selectedMaterialTx.length === 0 ? <tr><td colSpan="6" className="muted">No materials logged on this job yet.</td></tr> : selectedMaterialTx.map(mt => (
                <tr key={mt.id}>
                  <td><Xref type="material" id={mt.material_id}><strong>{mt.item_code}</strong> {mt.material_description}</Xref></td>
                  <td><span className="badge">{mt.transaction_type}</span></td>
                  <td>{mt.quantity} {mt.unit_of_measure}</td>
                  <td>{money(Number(mt.quantity) * Number(mt.unit_cost || 0))}</td>
                  <td><Xref type="employee" id={mt.employee_id}>{mt.employee_name}</Xref></td>
                  <td>{fmtDateTime(mt.occurred_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div> : <div className="card empty">Click a job above to see its full time and material log.</div>}
    </div>
  </main>;
}
