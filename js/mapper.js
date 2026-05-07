// ===== 手势→控制映射（带缓动） =====
import { SENS } from './constants.js';

let _earth=null, _lp=null, _sens=SENS.ROTATE;
let _rotV=0, _zoomV=0;  // 旋转和缩放的速度累积

function clamp(v,mn,mx){return Math.max(mn,Math.min(mx,v))}

export function init(e){_earth=e;try{const r=localStorage.getItem('gs3');if(r)_sens=JSON.parse(r).s||0.005}catch{}}
export function adj(d){_sens=clamp(_sens+d*0.0005,0.001,0.02);localStorage.setItem('gs3',JSON.stringify({s:_sens}));}
export function rst(){_sens=SENS.ROTATE;localStorage.setItem('gs3',JSON.stringify({s:_sens}));}

export function step(cls){
  if(!_earth||!cls.data)return null;
  const g=cls.gesture, c=cls.data.center;
  let s='i',a='';

  const mn=_earth.controls.minDistance||1.7, mx=_earth.controls.maxDistance||6;
  const cam=_earth.camera.position, cur=cam.length();

  if(g==='palm'){
    s='r'; a='旋转';
    _earth.rotating=false;
    _zoomV=0;
    if(_lp){
      const dx=c.x-_lp.x, dy=c.y-_lp.y;
      // 累积旋转速度（镜像 + 20倍率），缓动衰减
      _rotV += -dx*_sens*200;
      _rotV *= 0.85; // 每帧衰减15%
      _earth.earthGroup.rotation.y += _rotV;
      if(Math.abs(dy)>0.001){
        const dist=cur;
        const phi=clamp(Math.acos(cam.y/dist)-dy*_sens*100,0.1,Math.PI-0.1);
        cam.y=dist*Math.cos(phi);const rd=dist*Math.sin(phi),az=Math.atan2(cam.z,cam.x);
        cam.x=rd*Math.cos(az);cam.z=rd*Math.sin(az);
      }
    }
    _lp=c;
  }else{
    _rotV=0; _lp=null;
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
    // 缩放缓动：速度衰减 + 平滑移动
    if(Math.abs(_zoomV)>0.001){
      const t=clamp(cur+_zoomV,mn,mx);
      const newDist=cur+(t-cur)*0.3; // lerp 30% toward target
      const sc=clamp(newDist,mn,mx)/cur;
      cam.x*=sc;cam.y*=sc;cam.z*=sc;
      _zoomV*=0.9; // 衰减
    }
  }

  return {s,a};
}
