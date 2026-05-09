// ===== 手势识别 — 全量硬规则（尺度无关比例判定） =====
// 核心原理：指尖到掌心距 ÷ 手腕到掌心距 = 弯曲比例。手大手小比例不变。

// 手指定义：[指尖索引, PIP索引, MCP索引]
const FINGERS = [
  { tip:4,  pip:3,  mcp:2,  name:'thumb'  },
  { tip:8,  pip:7,  mcp:5,  name:'index'  },
  { tip:12, pip:11, mcp:9,  name:'middle' },
  { tip:16, pip:15, mcp:13, name:'ring'   },
  { tip:20, pip:19, mcp:17, name:'pinky'  },
];
const WRIST=0, PALM=9;

function d2(a,b){const dx=a.x-b.x,dy=a.y-b.y;return Math.sqrt(dx*dx+dy*dy)}
function cosVec(tip,pip,mcp){
  const a={x:tip.x-pip.x,y:tip.y-pip.y}, b={x:mcp.x-pip.x,y:mcp.y-pip.y};
  const ma=Math.hypot(a.x,a.y), mb=Math.hypot(b.x,b.y);
  if(ma<0.001||mb<0.001)return 0;
  return (a.x*b.x+a.y*b.y)/(ma*mb);
}

let _dbg=0;
export function classify(pts){
  if(!pts||pts.length<21)return {gesture:'none',data:null};

  const w=pts[WRIST], p=pts[PALM];
  const hs=d2(w,p)||0.02;

  let extend=0, curl=0, idxExt=false, idxUp=false;
  const ratios=[];

  for(const f of FINGERS){
    const tip=pts[f.tip], pip=pts[f.pip], mcp=pts[f.mcp];
    const cos=cosVec(tip,pip,mcp);
    const straight=cos<-0.7; // 伸直时a朝外b朝内，反向→cos≈-1
    const ratio=d2(tip,p)/hs;
    const curled=ratio<0.6;
    ratios.push(`${f.name}: cos=${cos.toFixed(2)} ratio=${ratio.toFixed(2)} ${straight?'直':'弯'}`);

    if(straight)extend++;
    if(curled)curl++;
    if(f.name==='index'&&straight){
      idxExt=true;
      idxUp=tip.y<mcp.y;
    }
  }

  // 捏合判定：拇指尖到食指尖距离 ÷ 手掌大小
  const pinchDist = d2(pts[4], pts[8]);
  const pinchRatio = pinchDist / hs;
  const isPinch = pinchRatio < 0.4;

  // 优先级：palm > pointUp/Down > pinch > fist > none
  let g='none';
  if(extend>=4) g='palm';
  else if(idxExt&&curl>=3) g=idxUp?'pointUp':'pointDown';
  else if(isPinch) g='pinch';
  else if(curl>=4) g='fist';

  _dbg++;
  if(_dbg%30===0){
    console.log(`[gesture] ext:${extend} curl:${curl} idx:${idxExt} pinch:${pinchRatio.toFixed(2)} → ${g}`, ratios);
  }

  return {gesture:g, data:{center:{x:p.x,y:p.y}, pinchRatio}};
}
