import { Earth } from './earth.js';
import { initCamera, isFPSLow, CameraError } from './camera.js';
import { classify } from './gesture.js';
import { init as initMap, step, adj, rst } from './mapper.js';
import * as UI from './ui.js';

let _earth=null, _run=false;

function fatal(msg){
  _run=false; UI.hideLoad();
  UI.err(msg,'fatal');
  const ov=document.getElementById('loading-overlay');
  ov.innerHTML=`<div style="text-align:center"><p style="color:#e55;font-size:1.2rem">${msg}</p><button onclick="location.reload()" style="margin-top:1rem;padding:0.5rem 1.5rem;background:#333;color:#fff;border:1px solid #555;border-radius:0.25rem;cursor:pointer">刷新重试</button></div>`;
  ov.style.display='flex'; ov.style.opacity='1';
}

let _fc=0;
function loop(){
  if(!_run)return;
  _fc++;
  if(_fc%30===0 && isFPSLow())UI.err('帧率偏低','warn');
  requestAnimationFrame(loop);
}

function onFrame(pts){
  if(!_run)return;
  const cls=classify(pts);
  const st=step(cls);
  if(st)UI.upd(st);
}

async function init(){
  UI.showLoad();

  // 地球
  try{
    const c=document.getElementById('globe-container');
    _earth=new Earth(c);
    const asp=window.innerWidth/window.innerHeight;
    const t=Math.max(0,Math.min(1,(1.6-asp)/1.2));
    _earth.camera.position.set(0,1.5+t*2.0,3.5+t*2.0);
    _earth.start();
    // 预置上海市示例
    _earth.setHome(31.2304, 121.4737, '上海市', '上海市');
    _earth.addPlace({id:'demo-shanghai',name:'上海市',fullName:'上海市·上海市',lat:31.2304,lng:121.4737,rating:5,photos:[]}, '#ffffff', 5);
    // 地图分层后台加载
    _earth.loadCoastlines().catch(()=>{});
    _earth.loadAdminBoundaries().catch(()=>{}); // 省界
    _earth.loadCities().catch(()=>{});          // 市界（省级加载完成后缩放即可见）
  }catch(e){fatal(e.message);return;}

  // 映射器
  initMap(_earth);

  // 摄像头
  try{
    await initCamera(onFrame);
    UI.camOn();
  }catch(e){
    if(e instanceof CameraError && e.code==='CAMERA_DENIED'){
      UI.err(e.message,'warn'); UI.camOff();
    }else{fatal(e.message);return;}
  }

  // 键盘
  document.addEventListener('keydown',e=>{
    if(e.key==='='||e.key==='+')adj(1);
    else if(e.key==='-')adj(-1);
    else if(e.key==='r'||e.key==='R')rst();
  });

  UI.hideLoad(); _run=true; requestAnimationFrame(loop);
}

init();
