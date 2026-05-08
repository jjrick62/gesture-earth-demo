// ===== 手势→控制映射（带缓动） =====
import { SENS } from './constants.js';

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
    s='r'; a='旋转';
    _earth.rotating=false;
    _earth._controlsLocked = true;
    _zoomV=0;
    if(_lp){
      const dx=c.x-_lp.x, dy=c.y-_lp.y;
      _rotV += -dx*_sens*80;
      _rotV *= 0.85;
      _earth._gestureRotSpeed = _rotV;
      _pitchV += -dy * _sens * 50;
      _pitchV *= 0.85;
      _earth._gesturePitchDelta = _pitchV;
      if (++_earth._pitchDbg % 30 === 0) {
        console.log(`[mapper] dx=${dx.toFixed(4)} dy=${dy.toFixed(4)} sens=${_sens.toFixed(5)} rotSpeed=${_rotV.toFixed(6)} pitchDelta=${_earth._gesturePitchDelta.toFixed(6)}`);
      }
    }
    _lp=c;
  }else{
    _rotV=0; _pitchV=0; _lp=null;
    // _gestureRotSpeed / _gesturePitchDelta 不清零，由 earth._animate() 自然衰减刹车
    _earth._controlsLocked = false;
    if(g==='pointUp'){
      s='pu'; a='🔍 放大';
      _zoomV += 0.02;
      _zoomV = clamp(_zoomV, -0.3, 0.3);
    }else if(g==='pointDown'){
      s='pd'; a='🔎 拉远';
      _zoomV -= 0.02;
      _zoomV = clamp(_zoomV, -0.3, 0.3);
    }else if(g==='fist'){
      s='f'; a='暂停'; _earth.rotating=false;
      _zoomV=0;
    }else{
      s='i'; a='—'; _earth.rotating=true;
    }
    _earth._gestureZoomSpeed = _zoomV;
    _zoomV *= 0.9;
  }

  return {s,a};
}
