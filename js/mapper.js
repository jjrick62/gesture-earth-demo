// ===== 手势→控制映射（带缓动） =====
import { SENS, DECAY_CAMERA, DECAY_ZOOM, GAIN_ROTATE, GAIN_PITCH, GAIN_ZOOM, ZOOM_GAIN } from './constants.js';

let _earth=null, _lp=null, _sens=SENS.ROTATE;
let _rotV=0, _pitchV=0, _zoomV=0;  // 旋转、俯仰、缩放的速度累积

function clamp(v,mn,mx){return Math.max(mn,Math.min(mx,v))}

export function init(e){_earth=e;try{const r=localStorage.getItem('gs3');if(r)_sens=JSON.parse(r).s||0.005}catch{}}
export function adj(d){_sens=clamp(_sens+d*0.0005,0.001,0.02);localStorage.setItem('gs3',JSON.stringify({s:_sens}));}
export function rst(){_sens=SENS.ROTATE;localStorage.setItem('gs3',JSON.stringify({s:_sens}));}

export function step(cls){
  if(!_earth||!cls.data)return null;
  const g=cls.gesture, c=cls.data.center;
  let s='i',a='';

  if(g==='palm'){
    // === 手掌张开：旋转 + 俯仰 ===
    s='r'; a='旋转';
    _earth.rotating=false;
    _earth._controlsLocked = true;
    _zoomV=0;
    if(_lp){
      const dx=c.x-_lp.x, dy=c.y-_lp.y;
      _rotV += -dx*_sens*GAIN_ROTATE;
      _rotV *= DECAY_CAMERA;
      _earth._gestureRotSpeed = _rotV;
      _pitchV += -dy * _sens * GAIN_PITCH;
      _pitchV *= DECAY_CAMERA;
      _earth._gesturePitchDelta = _pitchV;
      if (++_earth._pitchDbg % 30 === 0) {
        console.log(`[mapper] dx=${dx.toFixed(4)} dy=${dy.toFixed(4)} sens=${_sens.toFixed(5)} rotSpeed=${_rotV.toFixed(6)} pitchDelta=${_earth._gesturePitchDelta.toFixed(6)}`);
      }
    }
    _lp=c;
  }else if(g==='pinch'){
    // === 捏合：缩放（追踪手部 Y 轴移动，与旋转同模式） ===
    s='pi'; a='捏合缩放';
    _earth._pinchRecovery = 5;  // 松手恢复标记（main.js 消费）
    _earth.rotating=false;
    _earth._controlsLocked = true;
    _rotV=0; _pitchV=0;
    if(_lp){
      const dy=c.y-_lp.y;
      _zoomV += -dy * _sens * ZOOM_GAIN; // 手上移→拉近
      _zoomV = clamp(_zoomV, -1.0, 1.0);
      _zoomV *= DECAY_CAMERA;
      _earth._gestureZoomSpeed = _zoomV;
    }
    _lp=c;
  }else{
    // === 其他手势 ===
    _rotV=0; _pitchV=0; _lp=null;
    _earth._controlsLocked = false;
    _earth._gestureCardNext = false;
    _earth._gestureCardPrev = false;
    if(g==='pointUp'){
      s='pu'; a='下一张';
      _earth._gestureCardNext = true;
      _zoomV=0;
    }else if(g==='pointDown'){
      s='pd'; a='上一张';
      _earth._gestureCardPrev = true;
      _zoomV=0;
    }else if(g==='fist'){
      s='f'; a='暂停'; _earth.rotating=false;
      _zoomV=0;
    }else{
      s='i'; a='—'; _earth.rotating=true;
    }
    _earth._gestureZoomSpeed = _zoomV;
    _zoomV *= DECAY_ZOOM;
  }

  return {s,a};
}

export function getSens() { return _sens; }
