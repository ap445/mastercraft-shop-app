'use client';
import '../../globals.css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

const blankJob = { id:'', jobNumber:'', customerName:'', description:'', dueDate:'', priority:'3', status:'not_started' };
const blankOperation = { id:'', jobId:'', departmentId:'', operationName:'', sequenceNo:'1', estimatedHours:'', plannedStart:'', plannedFinish:'', status:'queued' };
const blankJobMaterial = { id:'', jobId:'', materialId:'', plannedQuantity:'', notes:'' };
const blankGuidance = { id:'', scopeType:'job', jobId:'', departmentId:'', title:'', instructions:'', dailyGoal:'' };
function nextSequenceFor(jobId,ops){const nums=(ops||[]).filter(o=>String(o.job_id)===String(jobId)).map(o=>Number(o.sequence_no)||0);return nums.length?Math.max(...nums)+1:1;}

export default function JobSetupPage(){
  const router=useRouter();
  const [data,setData]=useState(null);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [busy,setBusy]=useState(false);
  const [jobId,setJobId]=useState('');
  const [jobForm,setJobForm]=useState(blankJob);
  const [operationForm,setOperationForm]=useState(blankOperation);
  const [jobMaterialForm,setJobMaterialForm]=useState(blankJobMaterial);
  const [guidanceForm,setGuidanceForm]=useState(blankGuidance);

  const load=useCallback(async()=>{const res=await fetch('/api/admin/setup',{cache:'no-store'});if(res.status===401||res.status===403){router.push('/login');return null;}const json=await res.json();if(!res.ok){setError(json.error);return null;}setData(json);return json;},[router]);
  useEffect(()=>{load();},[load]);
  useEffect(()=>{try{const params=new URLSearchParams(window.location.search);const j=params.get('job');if(j)selectJob(j);}catch{}},[]); // eslint-disable-line react-hooks/exhaustive-deps

  function selectJob(id){
    const nid=id?String(id):'';
    setJobId(nid);
    setJobForm(blankJob);
    if(nid){
      setOperationForm(f=>({...blankOperation,jobId:nid,sequenceNo:String(nextSequenceFor(nid,data?.operations||[]))}));
      setJobMaterialForm({...blankJobMaterial,jobId:nid});
      setGuidanceForm({...blankGuidance,jobId:nid,departmentId:''});
    }
  }

  function editJob(job){setJobForm({id:job.id,jobNumber:job.job_number,customerName:job.customer_name||'',description:job.description||'',dueDate:job.due_date?String(job.due_date).slice(0,10):'',priority:String(job.priority||3),status:job.status||'not_started'});}
  function editOperation(o){setOperationForm({id:o.id,jobId:String(o.job_id),departmentId:String(o.department_id),operationName:o.operation_name,sequenceNo:String(o.sequence_no),estimatedHours:o.estimated_hours??'',plannedStart:o.planned_start?String(o.planned_start).slice(0,10):'',plannedFinish:o.planned_finish?String(o.planned_finish).slice(0,10):'',status:o.status||'queued'});}
  function editJobMaterial(jm){setJobMaterialForm({id:jm.id,jobId:String(jm.job_id),materialId:String(jm.material_id),plannedQuantity:String(jm.planned_quantity),notes:jm.notes||''});}
  function editGuidance(g){setGuidanceForm({id:g.id,scopeType:'job',jobId:String(g.job_id),departmentId:g.department_id||'',title:g.title,instructions:g.instructions||'',dailyGoal:g.daily_goal||''});}

  function changeOperationDept(deptId){setOperationForm(f=>{const dept=data.departments.find(d=>String(d.id)===String(deptId));const nameWasAuto=!f.operationName||data.departments.some(d=>d.name===f.operationName);return{...f,departmentId:deptId,operationName:(nameWasAuto&&dept)?dept.name:f.operationName};});}

  async function saveJob(e){
    e.preventDefault();setBusy(true);setError('');setNotice('');
    try{
      const res=await fetch('/api/admin/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'job',...jobForm})});
      const json=await res.json();
      if(!res.ok)throw new Error(json.error);
      const fresh=await load();
      const wasEdit=!!jobForm.id;
      const created=wasEdit?fresh.jobs.find(j=>String(j.id)===String(jobForm.id)):fresh.jobs.find(j=>j.job_number===String(jobForm.jobNumber).trim().toUpperCase());
      if(created)selectJob(created.id);
      setNotice(wasEdit?'Job saved.':'Job created — add its schedule, materials, and expectations below.');
    }catch(err){setError(err.message)}finally{setBusy(false)}
  }
  async function saveOperation(e){
    e.preventDefault();setBusy(true);setError('');setNotice('');
    try{
      const wasEdit=!!operationForm.id;
      const res=await fetch('/api/admin/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'operation',...operationForm})});
      const json=await res.json();
      if(!res.ok)throw new Error(json.error);
      const fresh=await load();
      setOperationForm({...blankOperation,jobId,sequenceNo:String(nextSequenceFor(jobId,fresh.operations))});
      setNotice(wasEdit?'Operation saved.':'Operation added — add the next step below, or move on.');
    }catch(err){setError(err.message)}finally{setBusy(false)}
  }
  async function saveJobMaterial(e){
    e.preventDefault();setBusy(true);setError('');setNotice('');
    try{
      const wasEdit=!!jobMaterialForm.id;
      const res=await fetch('/api/admin/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'jobMaterial',...jobMaterialForm})});
      const json=await res.json();
      if(!res.ok)throw new Error(json.error);
      await load();
      setJobMaterialForm({...blankJobMaterial,jobId});
      setNotice(wasEdit?'Material line saved.':'Material planned for this job — add another, or move on.');
    }catch(err){setError(err.message)}finally{setBusy(false)}
  }
  async function removeJobMaterial(id){
    if(!confirm('Remove this planned material from the job?'))return;
    setBusy(true);setError('');
    try{const res=await fetch('/api/admin/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'jobMaterialDelete',id})});const json=await res.json();if(!res.ok)throw new Error(json.error);await load();setNotice('Removed.');}catch(err){setError(err.message)}finally{setBusy(false)}
  }
  async function saveGuidance(e){
    e.preventDefault();setBusy(true);setError('');setNotice('');
    try{
      const res=await fetch('/api/admin/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'guidance',...guidanceForm})});
      const json=await res.json();
      if(!res.ok)throw new Error(json.error);
      const fresh=await load();
      const savedId=json.id||guidanceForm.id;
      const saved=fresh.guidance.find(g=>String(g.id)===String(savedId));
      setGuidanceForm(saved?{id:saved.id,scopeType:'job',jobId:saved.job_id,departmentId:saved.department_id||'',title:saved.title,instructions:saved.instructions||'',dailyGoal:saved.daily_goal||''}:{...blankGuidance,jobId});
      setNotice('Expectation saved — attach documents below if needed, or add another.');
    }catch(err){setError(err.message)}finally{setBusy(false)}
  }
  async function removeGuidance(id){
    if(!confirm('Delete this daily expectation? This cannot be undone.'))return;
    setBusy(true);setError('');
    try{const res=await fetch('/api/admin/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'guidanceDelete',id})});const json=await res.json();if(!res.ok)throw new Error(json.error);setGuidanceForm({...blankGuidance,jobId});await load();setNotice('Deleted.');}catch(err){setError(err.message)}finally{setBusy(false)}
  }
  async function uploadGuidanceAttachment(e){
    const file=e.target.files?.[0];e.target.value='';if(!file)return;
    if(!guidanceForm.id){setError('Save this expectation before attaching documents.');return;}
    setBusy(true);setError('');setNotice('');
    try{const fd=new FormData();fd.append('guidanceId',guidanceForm.id);fd.append('file',file);const res=await fetch('/api/admin/guidance-attachments',{method:'POST',body:fd});const json=await res.json();if(!res.ok)throw new Error(json.error);await load();setNotice('Document attached.');}catch(err){setError(err.message)}finally{setBusy(false)}
  }
  async function removeGuidanceAttachment(id){
    if(!confirm('Remove this attachment?'))return;
    setBusy(true);setError('');
    try{const res=await fetch('/api/admin/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'guidanceAttachmentDelete',id})});const json=await res.json();if(!res.ok)throw new Error(json.error);await load();setNotice('Removed.');}catch(err){setError(err.message)}finally{setBusy(false)}
  }
  async function logout(){await fetch('/api/auth/logout',{method:'POST'});router.push('/login');router.refresh();}

  const job=useMemo(()=>data?.jobs.find(j=>String(j.id)===String(jobId))||null,[data,jobId]);
  const ops=useMemo(()=>job?(data.operations.filter(o=>String(o.job_id)===String(jobId)).sort((a,b)=>a.sequence_no-b.sequence_no)):[],[data,job,jobId]);
  const materialsForJob=useMemo(()=>job?data.jobMaterials.filter(jm=>String(jm.job_id)===String(jobId)):[],[data,job,jobId]);
  const guidanceForJob=useMemo(()=>job?data.guidance.filter(g=>g.scope_type==='job'&&String(g.job_id)===String(jobId)):[],[data,job,jobId]);
  const currentGuidanceAttachments=useMemo(()=>{if(!data||!guidanceForm.id)return[];const g=data.guidance.find(x=>String(x.id)===String(guidanceForm.id));return g?.attachments||[];},[data,guidanceForm.id]);

  if(!data)return <main className="shell"><div className="container"><div className="card">{error?<div className="alert error">{error}</div>:'Loading job setup...'}</div></div></main>;

  return <main className="shell">
    <div className="topbar">
      <a className="brand" href="/admin">MASTERCRAFT ADMIN</a>
      <div className="navlinks">
        <a className="navlink" href="/admin">Setup</a>
        <a className="navlink" href="/admin#records">Records</a>
        <a className="navlink" href="/supervisor">Supervisor Board</a>
        <a className="navlink" href="/admin/costing">Job Costing</a>
        <a className="navlink" href="/admin/payroll">Payroll</a>
        <button className="toplink" onClick={logout}>Sign out</button>
      </div>
    </div>
    <div className="container">
      <div className="card">
        <div className="kicker">Job Setup</div>
        <h1>Set up a job</h1>
        <p className="muted">Pick an existing job, or add a new one — then handle its schedule, planned materials, and daily expectations together, all on this one page.</p>
        {error&&<div className="alert error">{error}</div>}
        {notice&&<div className="alert success">{notice}</div>}
      </div>

      <div className="card">
        <div className="field"><label>Existing job</label><select value={jobId} onChange={e=>selectJob(e.target.value)}><option value="">— Select a job —</option>{data.jobs.map(j=><option key={j.id} value={j.id}>{j.job_number} — {j.description}</option>)}</select></div>
        <form onSubmit={saveJob}>
          <div className="kicker" style={{marginTop:'16px'}}>{jobForm.id?'Edit job details':'Or add a new job'}</div>
          <div className="field"><label>Job number</label><input value={jobForm.jobNumber} onChange={e=>setJobForm(f=>({...f,jobNumber:e.target.value}))} placeholder="MC-26052" /></div>
          <div className="field"><label>Customer</label><input value={jobForm.customerName} onChange={e=>setJobForm(f=>({...f,customerName:e.target.value}))} /></div>
          <div className="field"><label>Description</label><input value={jobForm.description} onChange={e=>setJobForm(f=>({...f,description:e.target.value}))} /></div>
          <div className="grid two"><div className="field"><label>Due date</label><input type="date" value={jobForm.dueDate} onChange={e=>setJobForm(f=>({...f,dueDate:e.target.value}))} /></div><div className="field"><label>Priority</label><select value={jobForm.priority} onChange={e=>setJobForm(f=>({...f,priority:e.target.value}))}>{[1,2,3,4,5].map(p=><option key={p} value={p}>{p}</option>)}</select></div></div>
          {jobForm.id?<div className="field"><label>Status</label><select value={jobForm.status} onChange={e=>setJobForm(f=>({...f,status:e.target.value}))}><option value="not_started">Not started</option><option value="in_progress">In progress</option><option value="on_hold">On hold</option><option value="complete">Complete</option><option value="closed">Closed (hides from live boards)</option></select></div>:null}
          <button disabled={busy} className="btn primary">{jobForm.id?'SAVE JOB':'ADD JOB'}</button>{jobForm.id?<button type="button" className="btn secondary" onClick={()=>setJobForm(blankJob)}>CANCEL EDIT</button>:null}
        </form>
      </div>

      {!job?<div className="card"><p className="muted">Select or add a job above to manage its schedule, materials, and expectations.</p></div>:<>
        <div className="card">
          <div className="alert" style={{background:'#f4f4f4'}}><strong>{job.job_number}</strong> — {job.description} · {job.customer_name||'No customer'} · <span className="badge">{job.status.replaceAll('_',' ')}</span> · <button type="button" className="xref" onClick={()=>editJob(job)}>edit job details</button> · <a href={`/admin?detail=job-${job.id}#records`}>view full record</a></div>
        </div>

        <section className="card">
          <div className="kicker">Scheduling — {job.job_number}</div>
          <p className="muted">Add each department step this job needs to move through, in sequence order. Once an operation exists here, supervisors can assign an employee to it from the Supervisor board.</p>
          <div className="table-wrap"><table className="table compact-table"><thead><tr><th>#</th><th>Operation</th><th>Dept</th><th>Est.</th><th>Planned</th><th>Status</th><th></th></tr></thead><tbody>
            {ops.length===0?<tr><td colSpan="7" className="muted">No operations scheduled yet — add the first one below.</td></tr>:ops.map(o=><tr key={o.id}><td>{o.sequence_no}</td><td>{o.operation_name}</td><td>{o.department_name}</td><td>{o.estimated_hours||'—'}</td><td>{o.planned_start?String(o.planned_start).slice(0,10):'—'}</td><td><span className="badge">{String(o.status).replaceAll('_',' ')}</span></td><td><button type="button" className="xref" onClick={()=>editOperation(o)}>Edit</button></td></tr>)}
          </tbody></table></div>
          <form onSubmit={saveOperation}>
            <div className="grid two"><div className="field"><label>Department</label><select value={operationForm.departmentId} onChange={e=>changeOperationDept(e.target.value)}><option value="">Select department</option>{data.departments.filter(d=>d.active).map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></div><div className="field"><label>Operation name</label><input value={operationForm.operationName} onChange={e=>setOperationForm(f=>({...f,operationName:e.target.value}))} placeholder="Cut & Fit" /></div></div>
            <div className="grid two"><div className="field"><label>Sequence #</label><input type="number" min="1" value={operationForm.sequenceNo} onChange={e=>setOperationForm(f=>({...f,sequenceNo:e.target.value}))} /></div><div className="field"><label>Estimated hours</label><input inputMode="decimal" value={operationForm.estimatedHours} onChange={e=>setOperationForm(f=>({...f,estimatedHours:e.target.value}))} placeholder="8" /></div></div>
            <div className="grid two"><div className="field"><label>Planned start</label><input type="date" value={operationForm.plannedStart} onChange={e=>setOperationForm(f=>({...f,plannedStart:e.target.value}))} /></div><div className="field"><label>Planned finish</label><input type="date" value={operationForm.plannedFinish} onChange={e=>setOperationForm(f=>({...f,plannedFinish:e.target.value}))} /></div></div>
            {operationForm.id?<div className="field"><label>Status</label><select value={operationForm.status} onChange={e=>setOperationForm(f=>({...f,status:e.target.value}))}><option value="queued">Queued</option><option value="ready">Ready</option><option value="in_progress">In progress</option><option value="paused">Paused</option><option value="blocked">Blocked</option><option value="complete">Complete (hides from live boards)</option></select></div>:null}
            <button disabled={busy} className="btn primary">{operationForm.id?'SAVE OPERATION':'ADD OPERATION'}</button>{operationForm.id?<button type="button" className="btn secondary" onClick={()=>setOperationForm({...blankOperation,jobId,sequenceNo:String(nextSequenceFor(jobId,data.operations))})}>CANCEL EDIT</button>:null}
          </form>
          <p className="hint">Adding a step here only schedules it — it will not show up for anyone until you assign a person to it on the <a href="/supervisor">Supervisor Board</a>.</p>
        </section>

        <section className="card">
          <div className="kicker">Planned materials — {job.job_number}</div>
          <p className="muted">This is a plan, not a transaction — your team still records what's actually pulled from the Employee material screen, and Job Costing will show planned vs. actual side by side.</p>
          <div className="table-wrap"><table className="table compact-table"><thead><tr><th>Material</th><th>Planned qty</th><th>Notes</th><th></th></tr></thead><tbody>
            {materialsForJob.length===0?<tr><td colSpan="4" className="muted">Nothing planned yet — add below.</td></tr>:materialsForJob.map(jm=><tr key={jm.id}><td><strong>{jm.item_code}</strong> {jm.material_description}</td><td>{jm.planned_quantity} {jm.unit_of_measure}</td><td>{jm.notes||'—'}</td><td><button type="button" className="xref" onClick={()=>editJobMaterial(jm)}>Edit</button> · <button type="button" className="xref" onClick={()=>removeJobMaterial(jm.id)}>Remove</button></td></tr>)}
          </tbody></table></div>
          <form onSubmit={saveJobMaterial}>
            <div className="grid two"><div className="field"><label>Material</label><select value={jobMaterialForm.materialId} onChange={e=>setJobMaterialForm(f=>({...f,materialId:e.target.value}))}><option value="">Select material</option>{data.materials.filter(m=>m.active).map(m=><option key={m.id} value={m.id}>{m.item_code} — {m.description} ({m.unit_of_measure})</option>)}</select></div><div className="field"><label>Planned quantity</label><input inputMode="decimal" value={jobMaterialForm.plannedQuantity} onChange={e=>setJobMaterialForm(f=>({...f,plannedQuantity:e.target.value}))} placeholder="10" /></div></div>
            <div className="field"><label>Notes (optional)</label><input value={jobMaterialForm.notes} onChange={e=>setJobMaterialForm(f=>({...f,notes:e.target.value}))} placeholder="e.g. cut to 24 in lengths" /></div>
            <button disabled={busy} className="btn primary">{jobMaterialForm.id?'SAVE':'ADD TO JOB'}</button>{jobMaterialForm.id?<button type="button" className="btn secondary" onClick={()=>setJobMaterialForm({...blankJobMaterial,jobId})}>CANCEL EDIT</button>:null}
          </form>
          <p className="hint">Adding the same material again updates its planned quantity instead of duplicating the line.</p>
        </section>

        <section className="card">
          <div className="kicker">Daily expectations — {job.job_number}</div>
          <p className="muted">Shown to a department's employees for as long as this job has a non-complete operation in that department.</p>
          <div className="table-wrap"><table className="table compact-table"><thead><tr><th>Department</th><th>Title</th><th>Goal</th><th></th></tr></thead><tbody>
            {guidanceForJob.length===0?<tr><td colSpan="4" className="muted">No expectations set for this job yet.</td></tr>:guidanceForJob.map(g=><tr key={g.id}><td>{g.department_name}</td><td><strong>{g.title}</strong><br/><span className="muted">{g.instructions||'—'}</span>{g.attachments?.length>0?<div className="muted">{g.attachments.length} attachment{g.attachments.length===1?'':'s'}</div>:null}</td><td>{g.daily_goal||'—'}</td><td><button type="button" className="xref" onClick={()=>editGuidance(g)}>Edit</button></td></tr>)}
          </tbody></table></div>
          <form onSubmit={saveGuidance}>
            <div className="field"><label>Department</label><select value={guidanceForm.departmentId} onChange={e=>setGuidanceForm(f=>({...f,departmentId:e.target.value}))}><option value="">Select department</option>{data.departments.filter(d=>d.active).map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
            <div className="field"><label>Title</label><input value={guidanceForm.title} onChange={e=>setGuidanceForm(f=>({...f,title:e.target.value}))} placeholder="Fabrication daily standard" /></div>
            <div className="field"><label>Instructions</label><input value={guidanceForm.instructions} onChange={e=>setGuidanceForm(f=>({...f,instructions:e.target.value}))} placeholder="Review work order before starting." /></div>
            <div className="field"><label>Daily goal</label><input value={guidanceForm.dailyGoal} onChange={e=>setGuidanceForm(f=>({...f,dailyGoal:e.target.value}))} placeholder="Complete assigned operations safely and accurately." /></div>
            <button disabled={busy} className="btn secondary">{guidanceForm.id?'SAVE EXPECTATION':'ADD EXPECTATION'}</button>
            {guidanceForm.id?<button type="button" className="btn secondary" onClick={()=>setGuidanceForm({...blankGuidance,jobId})}>DONE / NEW</button>:null}
            {guidanceForm.id?<button type="button" className="btn danger" onClick={()=>removeGuidance(guidanceForm.id)}>DELETE</button>:null}
          </form>
          {guidanceForm.id?<div style={{marginTop:'10px',borderTop:'1px solid #e5e5e5',paddingTop:'10px'}}>
            <div className="kicker">Attachments</div>
            {currentGuidanceAttachments.length===0?<p className="muted" style={{margin:'4px 0 10px'}}>No documents attached yet.</p>:<ul style={{margin:'4px 0 10px 20px',padding:0}}>{currentGuidanceAttachments.map(a=><li key={a.id}><a href={`/api/attachments/${a.id}`}>{a.filename}</a> <button type="button" className="xref" onClick={()=>removeGuidanceAttachment(a.id)}>remove</button></li>)}</ul>}
            <div className="field"><label>Attach a document</label><input className="csv-input" type="file" onChange={uploadGuidanceAttachment} /></div>
          </div>:<p className="hint">Save an expectation first, then you can attach documents to it.</p>}
        </section>
      </>}
    </div>
  </main>;
}
