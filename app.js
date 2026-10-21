import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.118.0';

const SUPABASE_URL = 'https://kmmnblqwxapuxxrwfljp.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_VCAbdq3tHOPJyeAoSLIr6Q_Ow5-cBPS';
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const legacyKey = 'ure-sumare-simulados-v1';
let records = [], editing = null, currentUser = null, recoveryMode = false, isAdmin = false;

function esc(v = '') { return String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function n(v) { if (typeof v === 'string' && v.includes(',')) v = v.replace(/\./g,'').replace(',','.'); return Number(v) || 0; }
function fmt(v) { return Math.round(v).toLocaleString('pt-BR'); }
function pct(v) { return `${(Math.round((v || 0) * 10) / 10).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})}%`; }
function dateLabel(v) { if (!v) return '—'; let [y,m,d] = v.split('-'); return `${d}/${m}/${y}`; }
function allowedDomain(email = '') { return ['@educacao.sp.gov.br','@professor.educacao.sp.gov.br','@fde.sp.gov.br'].some(d => email.toLowerCase().endsWith(d)); }
function toRecord(r) { return { id:r.id,date:r.test_date,responsible:r.respondent,school:r.school,exam:r.exam_name,grade:r.grade,classroom:r.classroom,subject:r.subject,format:r.format,questions:r.question_count,enrolled:r.enrolled,present:r.present,absent:r.absent,attendance:r.enrolled ? (r.present/r.enrolled*100).toFixed(1) : '0.0',average:r.average_correct,below50:r.under_50,range50_70:r.from_50_to_70,range70_90:r.from_70_to_90,range90_100:r.from_90_to_100,strengths:r.strengths,needs:r.difficulties,analysis:r.analysis_performed,factors:r.difficulty_factors,actions:r.planned_actions,actionOwner:r.action_owner,notes:r.notes,createdBy:r.created_by,savedAt:r.created_at}; }
function toRow(d) { return {test_date:d.date,respondent:d.responsible.trim(),school:d.school.trim(),exam_name:d.exam.trim(),grade:d.grade,classroom:d.classroom.trim(),subject:d.subject,format:d.format,question_count:n(d.questions),enrolled:n(d.enrolled),present:n(d.present),average_correct:n(d.average),under_50:n(d.below50),from_50_to_70:n(d.range50_70),from_70_to_90:n(d.range70_90),from_90_to_100:n(d.range90_100),strengths:d.strengths||null,difficulties:d.needs||null,analysis_performed:d.analysis||null,difficulty_factors:d.factors||null,planned_actions:d.actions||null,action_owner:d.actionOwner||null,notes:d.notes||null}; }

async function refreshRecords() {
  let all = [], from = 0, size = 1000;
  while (true) {
    const {data,error} = await supabase.from('simulado_results').select('*').order('created_at',{ascending:false}).range(from,from+size-1);
    if (error) throw error;
    all = all.concat(data || []);
    if (!data || data.length < size) break;
    from += size;
  }
  records = all.map(toRecord); render();
}
function showAuth(message = '') {
  currentUser = null; isAdmin = false; records = [];
  $('#appShell').classList.add('hidden'); $('#authScreen').classList.remove('hidden');
  if (!recoveryMode) { $('#loginForm').classList.remove('hidden'); $('#resetPanel').classList.add('hidden'); }
  $('#authError').textContent = message;
}
async function handleSession(session) {
  if (recoveryMode) return;
  if (!session?.user) { showAuth(); return; }
  if (!allowedDomain(session.user.email || '')) {
    await supabase.auth.signOut(); showAuth('Este e-mail não pertence a um domínio institucional autorizado.'); return;
  }
  currentUser = session.user;
  const {data:roleRow,error:roleError}=await supabase.from('user_roles').select('role').eq('user_id',currentUser.id).maybeSingle();
  if(roleError){showAuth(`Não foi possível verificar o perfil da conta: ${roleError.message}`);return;}
  isAdmin=roleRow?.role==='admin';
  $('#profileRole').textContent=isAdmin?'Administrador':'Usuário';
  $('#profileEmail').textContent = currentUser.email || 'Conta institucional';
  $('#authScreen').classList.add('hidden'); $('#appShell').classList.remove('hidden');
  try { await refreshRecords(); }
  catch (error) { toast(`Não foi possível carregar os registros: ${error.message}`); }
}
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'PASSWORD_RECOVERY') {
    recoveryMode = true; $('#loginForm').classList.add('hidden'); $('#resetPanel').classList.remove('hidden');
    $('#authError').textContent = 'Digite e confirme sua nova senha.'; $('#authScreen').classList.remove('hidden'); $('#appShell').classList.add('hidden');
  } else if (event === 'SIGNED_OUT') { recoveryMode = false; showAuth(); }
  else if (session) setTimeout(() => handleSession(session), 0);
});

const $period = () => $('#periodFilter');
const filterFields=[['schoolFilter','school','Todas as escolas'],['gradeFilter','grade','Todos os anos/séries'],['subjectFilter','subject','Todos os componentes'],['examFilter','exam','Todos os simulados'],['classFilter','classroom','Todas as turmas']];
function active() {
  let period=$period().value;
  return records.filter(r=>(period==='all'||(r.date||'').slice(0,7)===period)&&filterFields.every(([id,key])=>{let value=$(`#${id}`).value;return value==='all'||String(r[key]??'')===value;}));
}
function renderPeriod() {
  let el=$period(), selected=el.value;
  let months=[...new Set(records.map(r=>(r.date||'').slice(0,7)).filter(Boolean))].sort().reverse();
  el.innerHTML='<option value="all">Todas as aplicações</option>'+months.map(m=>{let [y,mo]=m.split('-');return `<option value="${m}">${new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric'}).format(new Date(+y,+mo-1,1))}</option>`}).join('');
  el.value=months.includes(selected)?selected:'all';
}
function renderFilters() {
  for(const [id,key,placeholder] of filterFields){
    const el=$(`#${id}`),selected=el.value;
    const values=[...new Set(records.map(r=>String(r[key]??'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR',{sensitivity:'base'}));
    el.innerHTML=`<option value="all">${placeholder}</option>`+values.map(value=>`<option value="${esc(value)}">${esc(value)}</option>`).join('');
    el.value=values.includes(selected)?selected:'all';
  }
}
function render() {
  renderPeriod(); renderFilters(); let data=active(); $('#side-count').textContent=records.length;
  let schools=new Set(data.map(r=>r.school.trim().toLowerCase()).filter(Boolean)).size;
  let enrolled=data.reduce((s,r)=>s+n(r.enrolled),0),present=data.reduce((s,r)=>s+n(r.present),0);
  let avgValues=data.filter(r=>r.average!==''&&r.average!=null).map(r=>n(r.average));
  let average=avgValues.length?avgValues.reduce((a,b)=>a+b,0)/avgValues.length:null;
  $('#kSchools').textContent=fmt(schools); $('#kPresent').textContent=fmt(present); $('#kEnrolled').textContent=fmt(enrolled);
  let attendance=enrolled?present/enrolled*100:null;
  $('#kAttendance').innerHTML=attendance===null?'—<small>%</small>':`${pct(attendance).replace('%','')}<small>%</small>`;
  $('#attendanceProgress').style.width=`${Math.min(attendance||0,100)}%`;
  $('#kAverage').innerHTML=average===null?'—<small>%</small>':`${pct(average).replace('%','')}<small>%</small>`;
  renderGrade(data); renderSubjects(data); renderRanges(data); renderRecent(data); renderRecords();
}
function renderGrade(data) {
  let grades=[['5º Ano EF','5º EF'],['6º Ano EF','6º EF'],['7º Ano EF','7º EF'],['8º Ano EF','8º EF'],['9º Ano EF','9º EF'],['1ª Série EM','1ª EM'],['2ª Série EM','2ª EM']];
  $('#gradeChart').innerHTML=grades.map(([g,label])=>{let rows=data.filter(r=>r.grade===g),e=rows.reduce((a,r)=>a+n(r.enrolled),0),p=rows.reduce((a,r)=>a+n(r.present),0),v=e?p/e*100:0;return `<div class="bar-group"><div class="bar" style="height:${Math.max(v,1)}%"><span class="bar-value">${rows.length?pct(v):'—'}</span></div><span class="bar-label">${label}</span></div>`}).join('');
}
function renderSubjects(data) {
  let names=['Língua Portuguesa','Inglês','Matemática','Ciências','Biologia','Física','Química','História','Geografia','Filosofia','Sociologia','Outro'];
  let rows=names.map(name=>{let a=data.filter(r=>r.subject===name&&r.average!==''&&r.average!=null),v=a.length?a.reduce((s,r)=>s+n(r.average),0)/a.length:null;return {name,v,count:a.length}}).filter(x=>x.count).sort((a,b)=>b.v-a.v);
  $('#subjectChart').innerHTML=rows.length?rows.map(x=>`<div class="subject-row"><span class="subject-name" title="${esc(x.name)}">${esc(x.name)}</span><div class="track"><div class="fill" style="width:${Math.max(0,Math.min(100,x.v))}%"></div></div><span class="subject-score">${pct(x.v)}</span></div>`).join(''):'<div class="empty"><p>Ainda não há médias por componente.</p></div>';
}
function renderRanges(data) {
  let labels=['Abaixo de 50%','50% a 69,9%','70% a 79,9%','80% a 100%'],keys=['below50','range50_70','range70_90','range90_100'],colors=['r1','r2','r3','r4'],values=keys.map(k=>data.reduce((s,r)=>s+n(r[k]),0)),total=values.reduce((a,b)=>a+b,0);
  $('#rangeChart').innerHTML=total?`<div class="range-chart">${values.map((v,i)=>`<div class="range-segment ${colors[i]}" style="width:${v/total*100}%" title="${labels[i].replace('&lt;','<')}: ${fmt(v)}"></div>`).join('')}</div><div class="range-labels">${values.map((v,i)=>`<div class="range-item"><i class="${colors[i]}"></i>${labels[i]}<b>${fmt(v)}</b></div>`).join('')}</div>`:'<div class="range-chart"></div><div class="range-labels">'+values.map((v,i)=>`<div class="range-item"><i class="${colors[i]}"></i>${labels[i]}<b>0</b></div>`).join('')+'</div>';
}
function renderRecent(data) {
  let rows=[...data].sort((a,b)=>(b.savedAt||'').localeCompare(a.savedAt||'')).slice(0,4);
  $('#recentList').innerHTML=rows.length?rows.map(r=>`<div class="recent-row"><div><div class="recent-school">${esc(r.school)} · ${esc(r.classroom)}</div><div class="recent-meta">${esc(r.grade)} &nbsp;·&nbsp; ${esc(r.subject)}</div></div><div><div class="recent-score">${pct(n(r.average))}</div><div class="recent-date">${dateLabel(r.date)}</div></div></div>`).join(''):'<div class="empty"><p>As coletas adicionadas aparecerão aqui.</p></div>';
}
function renderRecords() {
  let q=($('#searchInput')?.value||'').toLowerCase();
  let period=$period().value;
  let data=records.filter(r=>period==='all'||(r.date||'').slice(0,7)===period).filter(r=>[r.school,r.classroom,r.subject,r.grade,r.exam,r.responsible].join(' ').toLowerCase().includes(q)).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  $('#recordTotal').textContent=`${data.length} ${data.length===1?'registro':'registros'}`;
  $('#recordsBody').innerHTML=data.map(r=>{let canEdit=isAdmin||r.createdBy===currentUser?.id;return `<tr><td>${esc(r.school)}<small>Turma ${esc(r.classroom)} · ${dateLabel(r.date)}${isAdmin?` · Registrado por ${esc(r.responsible||'—')}`:''}</small></td><td>${esc(r.exam||'—')}</td><td>${esc(r.grade||'—')}</td><td>${esc(r.subject||'—')}</td><td>${fmt(n(r.present))} / ${fmt(n(r.enrolled))}</td><td><span class="attendance-pill">${r.enrolled?pct(n(r.present)/n(r.enrolled)*100):'—'}</span></td><td><span class="score-pill">${pct(n(r.average))}</span></td><td class="action-cell">${canEdit?`<button title="Editar" data-edit="${r.id}">✎</button><button title="Excluir" data-delete="${r.id}">×</button>`:'<span class="muted">Somente leitura</span>'}</td></tr>`}).join('');
  $('#emptyRecords').classList.toggle('hidden',data.length>0);
}
function navigate(view) {
  $$('.view').forEach(x=>x.classList.add('hidden')); $(`#${view}View`).classList.remove('hidden');
  $$('.nav').forEach(x=>x.classList.toggle('active',x.dataset.view===view));
  $('#crumb-title').textContent={dashboard:'Visão geral',records:'Registros',collection:editing?'Editar coleta':'Nova coleta'}[view];
  if(view==='records')renderRecords(); window.scrollTo(0,0);
}
function toast(msg) { let el=$('#toast'); el.textContent=msg; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),3200); }
function newForm(r=null) {
  editing=r?.id||null; $('#recordForm').reset(); $('#recordForm').elements.date.value=new Date().toISOString().slice(0,10);
  $('#recordForm').elements.format.value='Impresso'; $('#recordForm').elements.analysis.value='Não';
  if(r) for(let [k,v] of Object.entries(r)){let field=$('#recordForm').elements[k];if(field)field.value=v??'';}
  $('#formTitle').textContent=editing?'Editar coleta':'Registrar resultado'; calcAttendance(); navigate('collection');
}
function calcAttendance() {
  let f=$('#recordForm'),e=n(f.elements.enrolled.value),p=n(f.elements.present.value);
  f.elements.absent.value=Math.max(e-p,0); f.elements.attendance.value=e?((p/e)*100).toFixed(1):'0.0';
  let sums=['below50','range50_70','range70_90','range90_100'].reduce((s,k)=>s+n(f.elements[k].value),0),v=$('#rangeValidation');
  v.textContent=sums&&p&&sums!==p?`Faixas somam ${sums} estudantes; ${p} presentes foram informados.`:'';
}
$('#recordForm').addEventListener('input',calcAttendance); $('#recordForm').addEventListener('change',calcAttendance);
$('#recordForm').addEventListener('submit',async e=>{
  e.preventDefault(); let f=e.currentTarget; if(!f.reportValidity())return;
  let d=Object.fromEntries(new FormData(f));
  if(n(d.present)>n(d.enrolled)){toast('Presentes não pode exceder matriculados.');return;}
  let sums=['below50','range50_70','range70_90','range90_100'].reduce((s,k)=>s+n(d[k]),0);
  if(sums&&sums!==n(d.present)&&!confirm(`As faixas somam ${sums}, mas há ${d.present} presentes. Deseja salvar mesmo assim?`))return;
  const payload=toRow(d);
  const {error}=editing
    ?await supabase.from('simulado_results').update(payload).eq('id',editing)
    :await supabase.from('simulado_results').insert({...payload,created_by:currentUser.id});
  if(error){toast(`Não foi possível salvar: ${error.message}`);return;}
  try{await refreshRecords();}catch(err){toast(`Salvo, mas falhou a atualização: ${err.message}`);}
  navigate('dashboard'); toast(editing?'Coleta atualizada.':'Coleta salva para toda a URE.'); editing=null;
});

const csvHeaders=['Data do simulado','Responsável pelo preenchimento','Escola','Identificação do simulado','Ano/Série','Turma','Componente curricular','Formato','Nº de questões','Estudantes matriculados','Estudantes presentes','Estudantes ausentes','Taxa de participação (%)','Média de acertos (%)','Estudantes abaixo de 50%','Estudantes de 50% a 69,9%','Estudantes de 70% a 79,9%','Estudantes de 80% a 100%','Habilidades/conteúdos com melhores resultados','Habilidades/conteúdos com maiores dificuldades','Análise por questão/habilidade realizada?','Fatores associados às dificuldades','Ações pedagógicas previstas','Responsável pelas ações','Observações'];
const csvKeys=['date','responsible','school','exam','grade','classroom','subject','format','questions','enrolled','present','absent','attendance','average','below50','range50_70','range70_90','range90_100','strengths','needs','analysis','factors','actions','actionOwner','notes'];
function csv() {
  if(!records.length){toast('Ainda não há registros para exportar.');return;}
  let quote=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
  let rows=[csvHeaders,...records.map(r=>csvKeys.map(k=>r[k]??''))].map(row=>row.map(quote).join(';')).join('\r\n');
  let a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\ufeff'+rows],{type:'text/csv;charset=utf-8'}));a.download='coletas-ure-sumare.csv';a.click();URL.revokeObjectURL(a.href);
}
function parseCsv(text) {
  text=text.replace(/^\uFEFF/,''); let first=text.split(/\r?\n/,1)[0]||'',delimiter=(first.match(/;/g)||[]).length>=(first.match(/,/g)||[]).length?';':',';
  let rows=[],row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++){let c=text[i];if(c==='"'&&quoted&&text[i+1]==='"'){cell+='"';i++;}else if(c==='"'){quoted=!quoted;}else if(c===delimiter&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell='';}else cell+=c;}
  if(cell||row.length){row.push(cell);if(row.some(x=>x.trim()))rows.push(row);}return rows;
}
async function importCsv(file) {
  const rows=parseCsv(await file.text()); if(rows.length<2)throw new Error('O arquivo não contém registros.');
  let payload=rows.slice(1).map(row=>{let d=Object.fromEntries(csvKeys.map((k,i)=>[k,row[i]??'']));return toRow(d);}).filter(r=>r.test_date&&r.school&&r.question_count>0&&r.enrolled>=0&&r.present>=0&&r.average_correct>=0);
  if(!payload.length)throw new Error('Não encontrei linhas compatíveis com o CSV de coletas.');
  payload=payload.map(r=>({...r,created_by:currentUser.id}));
  const {error}=await supabase.from('simulado_results').insert(payload); if(error)throw error;
  await refreshRecords(); toast(`${payload.length} ${payload.length===1?'registro importado':'registros importados'} para a base compartilhada.`);
}

$('#loginForm').addEventListener('submit',async e=>{
  e.preventDefault();let form=e.currentTarget,data=new FormData(form),email=String(data.get('email')).trim().toLowerCase(),password=String(data.get('password'));
  $('#authError').textContent='';if(!allowedDomain(email)){ $('#authError').textContent='Use um e-mail institucional autorizado da rede estadual.';return; }
  let button=form.querySelector('button[type="submit"]');button.disabled=true;button.textContent='Entrando…';
  const {error}=await supabase.auth.signInWithPassword({email,password});
  button.disabled=false;button.innerHTML='Entrar <span>→</span>';
  if(error)$('#authError').textContent='Não foi possível entrar. Confira o e-mail e a senha ou solicite acesso à coordenação.';
});
$('#forgotPassword').addEventListener('click',async()=>{
  let email=$('#loginForm').elements.email.value.trim().toLowerCase();
  if(!email||!allowedDomain(email)){ $('#authError').textContent='Informe primeiro seu e-mail institucional autorizado.';return; }
  const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});
  $('#authError').textContent=error?'Não foi possível solicitar a redefinição. Tente novamente ou contate a coordenação.':'Se a conta existir, você receberá um e-mail com as instruções de redefinição.';
});
$('#resetForm').addEventListener('submit',async e=>{
  e.preventDefault();let password=new FormData(e.currentTarget).get('password');if(String(password).length<8){$('#authError').textContent='Use uma senha com pelo menos 8 caracteres.';return;}
  const {error}=await supabase.auth.updateUser({password});
  if(error){$('#authError').textContent=error.message;return;}
  recoveryMode=false;$('#resetPanel').classList.add('hidden');$('#loginForm').classList.remove('hidden');$('#authError').textContent='Senha atualizada. Agora entre com a nova senha.';await supabase.auth.signOut();
});
$('#logoutBtn').addEventListener('click',async()=>{const {error}=await supabase.auth.signOut();if(error)toast('Não foi possível encerrar a sessão.');});
$$('.nav').forEach(b=>b.addEventListener('click',()=>b.dataset.view==='collection'?newForm():navigate(b.dataset.view)));
['#newBtn','#newBtn2','#recordsNew'].forEach(s=>$(s).addEventListener('click',()=>newForm()));
['#cancelForm','#cancelForm2'].forEach(s=>$(s).addEventListener('click',()=>navigate('dashboard')));
$('#exportBtn').addEventListener('click',csv); $('#downloadBtn').addEventListener('click',csv);
$period().addEventListener('change',render); filterFields.forEach(([id])=>$(`#${id}`).addEventListener('change',render));
$('#clearFilters').addEventListener('click',()=>{$period().value='all';filterFields.forEach(([id])=>$(`#${id}`).value='all');render();});
$('#searchInput').addEventListener('input',renderRecords);
$$('[data-goto]').forEach(b=>b.addEventListener('click',()=>navigate('records')));
$('#importBtn').addEventListener('click',()=>$('#importCsv').click());
$('#importCsv').addEventListener('change',async e=>{let file=e.target.files?.[0];if(!file)return;try{await importCsv(file);}catch(err){toast(`Falha na importação: ${err.message}`);}finally{e.target.value='';}});
$('#recordsBody').addEventListener('click',async e=>{
  let edit=e.target.closest('[data-edit]'),del=e.target.closest('[data-delete]');
  if(edit){let r=records.find(x=>x.id===edit.dataset.edit);if(r)newForm(r);}
  if(del&&confirm('Excluir este registro compartilhado permanentemente?')){const {error}=await supabase.from('simulado_results').delete().eq('id',del.dataset.delete);if(error){toast(`Não foi possível excluir: ${error.message}`);return;}await refreshRecords();toast('Registro excluído da base compartilhada.');}
});
$('#dismissNotice').addEventListener('click',()=>$('.notice').remove());
$('#importBtn').title='Importe o CSV exportado pelo protótipo anterior.';
async function init(){
  try{const {data,error}=await supabase.auth.getSession();if(error)throw error;if(data.session)await handleSession(data.session);else showAuth();}
  catch(error){showAuth(`Não foi possível conectar ao serviço de dados. ${error.message}`);}
}
init();
