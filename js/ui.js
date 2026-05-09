const LB={i:'—',r:'🖐 张开手掌',pu:'☝ 食指朝上',pd:'👇 食指朝下',f:'✊ 握拳'};

export function upd(st){
  if(!st)return;
  const n=document.getElementById('gesture-status');
  const a=document.getElementById('gesture-action');
  if(n)n.textContent=LB[st.s]||'—';
  if(a)a.textContent=st.a||'';
}

export function showLoad(){const e=document.getElementById('loading-overlay');if(e)e.style.display='flex';}
export function hideLoad(){const e=document.getElementById('loading-overlay');if(e){e.style.opacity='0';setTimeout(()=>{e.style.display='none'},300);}}

export function camOn(){const e=document.getElementById('camera-indicator');if(e){e.textContent='🟢 活跃';e.style.color='#0a0';}}
export function camOff(){const e=document.getElementById('camera-indicator');if(e){e.textContent='🔴 未激活';e.style.color='#e55';}}

export function err(msg,sev){
  const e=document.getElementById('error-msg');if(!e)return;
  e.textContent=msg;e.style.display='';e.style.color=sev==='fatal'?'#e55':'#cc0';
  if(sev==='warn'){clearTimeout(e._t);e._t=setTimeout(()=>{e.style.display='none'},3000);}
}
export function errClr(){const e=document.getElementById('error-msg');if(e)e.style.display='none';}

export function updSens(val){
  const e=document.getElementById('sensitivity-display');
  if(e)e.textContent='灵敏度 '+(val||0).toFixed(4);
}
