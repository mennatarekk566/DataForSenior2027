const $=id=>document.getElementById(id);
const ADMIN_USER='admin',ADMIN_PASS='1963';
let data={items:[]},isAdmin=sessionStorage.getItem('adm')==='1';
const host=location.hostname.endsWith('github.io');
const get=k=>{try{return localStorage.getItem(k)||''}catch(e){return ''}};
const set=(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}};

function say(t,bad){const m=$('msg');m.textContent=t;m.style.color=bad?'#c62828':'#0c2a8f'}
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,6)}
function cfg(){return{owner:get('gh_owner'),repo:get('gh_repo'),branch:get('gh_branch')||'main',token:get('gh_token')}}

async function load(){
  try{const r=await fetch('data.json?t='+Date.now());data=await r.json()}catch(e){data={items:[]}}
  render();
}
function ext(n){return n.includes('.')?n.split('.').pop().slice(0,4).toUpperCase():'FILE'}
function fileRow(f){
  const d=document.createElement('div');d.className='item';
  const e=document.createElement('span');e.className='ext';e.textContent=ext(f.name);
  const a=document.createElement('a');a.href=f.path;a.target='_blank';a.rel='noopener';a.textContent=f.name;
  d.append(e,a);
  if(isAdmin){const b=document.createElement('button');b.className='del';b.textContent='Delete';b.onclick=()=>removeItem(f.id);d.append(b)}
  return d;
}
function count(items,c={nf:0,nfi:0}){items.forEach(x=>{if(x.type==='folder'){c.nf++;count(x.files,c)}else c.nfi++});return c}
function find(items,id){for(let i=0;i<items.length;i++){const x=items[i];if(x.id===id)return{arr:items,i,x};if(x.type==='folder'){const r=find(x.files,id);if(r)return r}}return null}
function paths(x,out=[]){if(x.type==='folder')x.files.forEach(y=>paths(y,out));else out.push(x.path);return out}
function options(items,sel,prefix=''){items.forEach(x=>{if(x.type==='folder'){const o=document.createElement('option');o.value=x.id;o.textContent=prefix+x.name;sel.append(o);options(x.files,sel,prefix+x.name+' / ')}})}
function render(){
  const L=$('list');L.innerHTML='';
  ['target','folderParent'].forEach(id=>{const s=$(id),v=s.value;s.innerHTML='<option value="">Main page</option>';options(data.items,s);s.value=v})
  const q=($('q').value||'').trim().toLowerCase();
  const hit=f=>!q||f.name.toLowerCase().includes(q);
  const any=x=>x.type==='folder'?x.files.some(any):hit(x);
  function build(items,box){
    const grid=document.createElement('div');grid.className='files';
    items.forEach(it=>{
      if(it.type==='folder'){
        if(q&&!any(it))return;
        const d=document.createElement('details');d.className='folder';d.open=true;
        const s=document.createElement('summary');
        const ic=document.createElement('span');ic.className='fi';
        const nm=document.createElement('span');nm.className='fn';nm.textContent=it.name;
        const ct=document.createElement('span');ct.className='pill';ct.textContent=it.files.length;
        s.append(ic,nm,ct);
        if(isAdmin){const b=document.createElement('button');b.className='del';b.textContent='Delete folder';b.onclick=e=>{e.preventDefault();removeItem(it.id)};s.append(b)}
        const inner=document.createElement('div');inner.className='inner';
        if(!it.files.length)inner.innerHTML='<p class="empty">This folder is empty.</p>';
        else build(it.files,inner);
        d.append(s,inner);box.append(d);
      }else if(hit(it))grid.append(fileRow(it));
    });
    if(grid.children.length)box.prepend(grid);
  }
  build(data.items,L);
  if(!L.children.length)L.innerHTML='<p class="empty">'+(q?'No files match your search.':'No files yet. Check back soon.')+'</p>';
  const c=count(data.items);$('sFolders').textContent=c.nf;$('sFiles').textContent=c.nfi;
  $('panel').hidden=!isAdmin;$('adminBtn').hidden=isAdmin;
}
$('q').oninput=render;

/* GitHub API */
async function gh(path,method='GET',body){
  const c=cfg();if(!c.owner||!c.repo||!c.token)throw new Error('Fill in and save the GitHub connection first.');
  const url=`https://api.github.com/repos/${c.owner}/${c.repo}/contents/${path}`+(method==='GET'?`?ref=${c.branch}&t=${Date.now()}`:'');
  const r=await fetch(url,{method,headers:{Authorization:'Bearer '+c.token,Accept:'application/vnd.github+json'},body:body?JSON.stringify({...body,branch:c.branch}):undefined});
  if(!r.ok){let m=r.status;try{m=(await r.json()).message}catch(e){}throw new Error('GitHub: '+m)}
  return r.json();
}
const b64=s=>btoa(unescape(encodeURIComponent(s)));
const unb64=s=>decodeURIComponent(escape(atob(s.replace(/\n/g,''))));
async function saveData(mutate,msg){
  const cur=await gh('data.json');
  const d=JSON.parse(unb64(cur.content));mutate(d);
  await gh('data.json','PUT',{message:msg,content:b64(JSON.stringify(d,null,2)),sha:cur.sha});
  data=d;render();
}
function readB64(file){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result.split(',')[1]);r.onerror=rej;r.readAsDataURL(file)})}

async function removeItem(id){
  if(!confirm('Delete this item?'))return;
  try{
    say('Deleting...');
    let ps=[];
    await saveData(d=>{const r=find(d.items,id);ps=paths(r.x);r.arr.splice(r.i,1)},'Remove item');
    for(const p of ps){try{const c=await gh(p);await gh(p,'DELETE',{message:'Delete file',sha:c.sha})}catch(e){}}
    say('Deleted.');
  }catch(e){say(e.message,1)}
}

$('addFolder').onclick=async()=>{
  const n=$('folderName').value.trim();if(!n)return say('Enter a folder name.',1);
  const pid=$('folderParent').value;
  try{say('Creating...');await saveData(d=>{const f={id:uid(),type:'folder',name:n,files:[]};if(pid)find(d.items,pid).x.files.push(f);else d.items.push(f)},'Add folder');$('folderName').value='';say('Folder created.')}
  catch(e){say(e.message,1)}
};
$('upload').onclick=async()=>{
  const files=[...$('fileInput').files];if(!files.length)return say('Choose at least one file.',1);
  const tid=$('target').value;
  try{
    const added=[];
    for(const f of files){
      say('Uploading '+f.name+'...');
      const path='files/'+Date.now()+'-'+f.name.replace(/[^\w.\-]+/g,'_');
      await gh(path,'PUT',{message:'Upload '+f.name,content:await readB64(f)});
      added.push({id:uid(),type:'file',name:f.name,path});
    }
    await saveData(d=>{if(tid)find(d.items,tid).x.files.push(...added);else d.items.push(...added)},'Add files');
    $('fileInput').value='';say('Uploaded. It is visible to everyone now.');
  }catch(e){say(e.message,1)}
};
$('saveCfg').onclick=()=>{['owner','repo','branch','token'].forEach(k=>set('gh_'+k,$(k).value.trim()));say('Connection saved.')};

/* Login */
$('adminBtn').onclick=()=>$('login').showModal();
$('cancel').onclick=()=>$('login').close();
$('loginForm').onsubmit=e=>{
  if($('u').value===ADMIN_USER&&$('p').value===ADMIN_PASS){sessionStorage.setItem('adm','1');isAdmin=true;$('login').close();render()}
  else{e.preventDefault();$('err').textContent='Wrong username or password.'}
};
$('logout').onclick=()=>{sessionStorage.removeItem('adm');isAdmin=false;render()};

/* Prefill connection */
$('owner').value=get('gh_owner')||(host?location.hostname.split('.')[0]:'');
$('repo').value=get('gh_repo')||(host?location.pathname.split('/')[1]||'':'');
$('branch').value=get('gh_branch')||'main';$('token').value=get('gh_token');
load();
