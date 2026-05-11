import { Earth } from './earth.js';
import { initCamera, isFPSLow, CameraError } from './camera.js';
import { classify } from './gesture.js';
import { init as initMap, step, adj, rst, getSens } from './mapper.js';
import * as UI from './ui.js';
import { init as initCard, updatePlaceCards, showDetail, navigateCard } from './card.js';
import { initConsole } from './console.js';

let _earth=null, _run=false;

function fatal(msg){
  _run=false; UI.hideLoad();
  UI.err(msg,'fatal');
  const ov=document.getElementById('loading-overlay');
  ov.textContent = '';
  const wrap = document.createElement('div');
  wrap.style.textAlign = 'center';
  const p = document.createElement('p');
  p.style.cssText = 'color:#e55;font-size:1.2rem';
  p.textContent = msg;
  wrap.appendChild(p);
  const btn = document.createElement('button');
  btn.textContent = '刷新重试';
  btn.style.cssText = 'margin-top:1rem;padding:0.5rem 1.5rem;background:#333;color:#fff;border:1px solid #555;border-radius:0.25rem;cursor:pointer';
  btn.addEventListener('click', () => location.reload());
  wrap.appendChild(btn);
  ov.appendChild(wrap);
  ov.style.display = 'flex';
  ov.style.opacity = '1';
}

let _fc=0, _cardLocked=false;
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

  // 卡片翻页去抖：锁在动作层，不碰手势分类
  // 捏合松手恢复期 → 抑制卡片翻页（防松手误判成食指）
  if (_earth._pinchRecovery > 0) {
    _earth._pinchRecovery--;
  }
  // 手势离开食指 → 解锁，允许下次翻页
  if (cls.gesture !== 'pointUp' && cls.gesture !== 'pointDown') {
    _cardLocked = false;
  }
  // 卡片翻页：只在未锁 + 非恢复期 + 有翻页信号时触发
  if (!_cardLocked && _earth._pinchRecovery === 0) {
    if (_earth._gestureCardNext) {
      navigateCard(+1); _earth._gestureCardNext = false; _cardLocked = true;
    } else if (_earth._gestureCardPrev) {
      navigateCard(-1); _earth._gestureCardPrev = false; _cardLocked = true;
    }
  }
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
    // 卡片系统初始化
    initCard(_earth);
    _earth.onPlaceClick = (id) => {
      const place = _earth._places[id];
      if (!place) return;
      _earth._focusedPlaceId = id;
      _earth.highlightFill(id);
      _earth.focusOnPlace(place.lat, place.lng, () => showDetail(id));
    };

    // 卡片管理控制台（内部处理 localStorage 加载 / demo 初始化）
    initConsole(_earth);

    // 地图分层后台加载
    _earth.loadCoastlines().catch(()=>{});
    _earth.loadAdminBoundaries().catch(()=>{}); // 省界
    _earth.loadCities().catch(()=>{});          // 市界（省级加载完成后缩放即可见）

    // 每帧更新卡片屏幕位置
    _earth.onFrame(() => updatePlaceCards());
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
    if(e.key==='='||e.key==='+'){ adj(1); UI.updSens(getSens()); }
    else if(e.key==='-'){ adj(-1); UI.updSens(getSens()); }
    else if(e.key==='r'||e.key==='R'){ rst(); UI.updSens(getSens()); }
  });

  UI.hideLoad(); UI.updSens(getSens()); _run=true; requestAnimationFrame(loop);
}

init();
