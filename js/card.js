// ===== 地点卡片系统 =====
// 三类卡片：
//   1. place-card — 3D 地点上悬浮的小卡片（屏幕空间定位）
//   2. place-card-stacked — 多张卡片距离过近时折叠为代表卡片
//   3. detail-card — 右下滑出的地点详情大卡片
//
// 依赖：earth.js 的 getFacing / projectToScreen / getEarthCenterScreen / onFrame

import { renderStars } from './utils.js';

const IS_TOUCH = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
const DOUBLE_TAP_MS = IS_TOUCH ? 250 : 350;

let _earth = null;

// ===== 初始化 =====

export function init(earth) {
  _earth = earth;
  _bindEvents();
}

// ===== 地点列表管理 =====

/** 从 earth._places 重建全部悬浮卡片 */
export function syncPlaceCards() {
  removeAllPlaceCards();
  const places = Object.values(_earth._places);
  // 过滤：跳过父级行政区、跳过重名
  const seen = new Set();
  const visible = places.filter(p => {
    if (seen.has(p.name)) return false;
    const fn = p.fullName || '';
    const isParent = places.some(other => other !== p && (other.fullName || '').startsWith(fn + '·'));
    if (!isParent) seen.add(p.name);
    return !isParent;
  });
  for (const p of visible) createPlaceCard(p);
}

// ===== 悬浮卡片 =====

function createPlaceCard(place) {
  const svg = document.getElementById('connector-lines');
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.dataset.placeId = place.id;
  svg.appendChild(line);

  const stars = renderStars(place.rating);
  const thumb = place.photos && place.photos.length > 0
    ? `<img class="place-card-thumb" src="${place.photos[0].dataUrl}" alt="">` : '';
  const card = document.createElement('div');
  card.className = 'place-card';
  card.dataset.placeId = place.id;
  card.innerHTML = `<div class="place-card-name">${place.name}</div>
    <div class="place-card-meta">${stars}</div>${thumb}`;

  card.addEventListener('click', () => {
    // 折叠代表卡片：先飞过去，再展开
    if (card.classList.contains('place-card-stacked')) {
      const ck = card.dataset.clusterKey;
      _earth._focusedPlaceId = place.id;
      _earth.highlightFill(place.id);
      _earth.focusOnPlace(place.lat, place.lng, () => {
        if (ck && updatePlaceCards._clusters && updatePlaceCards._clusters[ck]) {
          const st = updatePlaceCards._clusters[ck];
          st.expanded = true;
          clearTimeout(st._timer);
          st._timer = setTimeout(() => { st.expanded = false; }, 5000);
        }
      });
      return;
    }

    const now = Date.now();
    if (card._lastTap && now - card._lastTap < DOUBLE_TAP_MS) {
      card._lastTap = 0;
      _earth._focusedPlaceId = place.id;
      _earth.highlightFill(place.id);
      _earth.focusOnPlace(place.lat, place.lng, () => showDetail(place.id));
    } else {
      card._lastTap = now;
      if (_earth._focusedPlaceId === place.id) {
        showDetail(place.id);
        return;
      }
      setTimeout(() => {
        if (card._lastTap !== now) return;
        _earth._focusedPlaceId = place.id;
        _earth.highlightFill(place.id);
        _earth.focusOnPlace(place.lat, place.lng);
      }, DOUBLE_TAP_MS);
    }
  });

  document.getElementById('place-cards').appendChild(card);
}

function removeAllPlaceCards() {
  document.getElementById('connector-lines').innerHTML = '';
  document.getElementById('place-cards').innerHTML = '';
}

// ===== 每帧更新卡片屏幕位置 + 聚类 =====

export function updatePlaceCards() {
  if (!_earth) return;
  const svg = document.getElementById('connector-lines');
  const w = window.innerWidth, h = window.innerHeight;
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  const center = _earth.getEarthCenterScreen();

  if (!updatePlaceCards._cache) updatePlaceCards._cache = {};
  if (!updatePlaceCards._clusters) updatePlaceCards._clusters = {};

  const places = Object.values(_earth._places);

  // 第一遍：计算所有卡片屏幕坐标
  const cardData = [];
  for (const place of places) {
    const line = svg.querySelector(`line[data-place-id="${place.id}"]`);
    const card = document.querySelector(`#place-cards .place-card[data-place-id="${place.id}"]`);
    if (!line || !card) continue;

    const facing = _earth.getFacing(place.lat, place.lng);
    const pt = _earth.projectToScreen(place.lat, place.lng, _earth.earthRadius * 1.02);
    if (!pt.visible) {
      line.style.display = 'none'; card.style.display = 'none'; continue;
    }

    const scale = Math.max(0.2, Math.min(1, 1 + facing));
    const off = 150 * scale;
    const opacity = Math.max(0.05, 0.5 + facing * 0.5).toFixed(2);

    const dx = pt.x - center.x;
    const dy = pt.y - center.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    const nx = d > 0.01 ? dx / d : 0;
    const ny = d > 0.01 ? dy / d : 0;

    let tx = pt.x + nx * off;
    let ty = pt.y + ny * off;

    const cache = updatePlaceCards._cache;
    const key = place.id;
    if (!cache[key]) cache[key] = { x: tx, y: ty };
    cache[key].x += (tx - cache[key].x) * 0.15;
    cache[key].y += (ty - cache[key].y) * 0.15;
    if (Math.abs(cache[key].x - tx) < 0.6) cache[key].x = tx;
    if (Math.abs(cache[key].y - ty) < 0.6) cache[key].y = ty;

    const cx = cache[key].x, cy = cache[key].y;
    cardData.push({ place, line, card, pt, cx, cy, sx: cx, sy: cy, scale, opacity, facing });
  }

  // 第二遍：距离聚类
  if (!updatePlaceCards._lastCluster) updatePlaceCards._lastCluster = {};
  const screenW = window.innerWidth;
  const clusterScale = Math.min(1, Math.max(0.35, screenW / 768));
  const joinThresh = Math.round(120 * clusterScale);
  const splitThresh = Math.round(180 * clusterScale);
  const clustered = new Set();
  const clusters = [];
  for (let i = 0; i < cardData.length; i++) {
    if (clustered.has(i)) continue;
    const group = [i];
    clustered.add(i);
    for (let j = i + 1; j < cardData.length; j++) {
      if (clustered.has(j)) continue;
      const a = cardData[i], b = cardData[j];
      const dist = Math.sqrt((a.sx - b.sx) ** 2 + (a.sy - b.sy) ** 2);
      const sameLast = updatePlaceCards._lastCluster[a.place.id]
        && updatePlaceCards._lastCluster[a.place.id] === updatePlaceCards._lastCluster[b.place.id];
      const threshold = sameLast ? splitThresh : joinThresh;
      if (dist < threshold) { group.push(j); clustered.add(j); }
    }
    clusters.push(group);
  }
  const newLast = {};
  for (let ci = 0; ci < clusters.length; ci++) {
    for (const idx of clusters[ci]) {
      newLast[cardData[idx].place.id] = ci;
    }
  }
  updatePlaceCards._lastCluster = newLast;

  // 第三遍：渲染
  for (const group of clusters) {
    if (group.length === 1) {
      const d = cardData[group[0]];
      d.card.classList.remove('place-card-stacked');
      d.card.dataset.clusterKey = '';
      d.line.style.display = '';
      d.line.setAttribute('x1', d.pt.x); d.line.setAttribute('y1', d.pt.y);
      d.line.setAttribute('x2', d.cx); d.line.setAttribute('y2', d.cy);
      d.line.style.opacity = d.opacity;
      d.card.style.display = '';
      d.card.style.left = d.cx + 'px';
      d.card.style.top = d.cy + 'px';
      d.card.style.transform = `translate(-50%, -100%) scale(${d.scale})`;
      d.card.style.opacity = d.opacity;
    } else {
      const clusterKey = group.map(i => cardData[i].place.id).sort().join(',');
      if (!updatePlaceCards._memberState) updatePlaceCards._memberState = {};
      const memberSet = group.map(i => cardData[i].place.id).sort().join(',');
      const savedExpanded = updatePlaceCards._memberState[memberSet];
      const state = updatePlaceCards._clusters[clusterKey] || { expanded: savedExpanded || false };
      updatePlaceCards._clusters[clusterKey] = state;
      updatePlaceCards._memberState[memberSet] = state.expanded;

      let sumX = 0, sumY = 0;
      for (const idx of group) { sumX += cardData[idx].sx; sumY += cardData[idx].sy; }
      const bx = sumX / group.length, by = sumY / group.length;

      let bestIdx = group[0], bestScore = -Infinity;
      for (const idx of group) {
        const d = cardData[idx];
        const dist = (d.sx - bx) ** 2 + (d.sy - by) ** 2;
        let lvl = 0;
        const dots = ((d.place.fullName || '').match(/·/g) || []).length;
        if (dots >= 2) lvl = 2; else if (dots === 1) lvl = 1;
        const score = lvl * 10000 - dist;
        if (score > bestScore) { bestScore = score; bestIdx = idx; }
      }
      if (state._repIdx !== undefined && group.includes(state._repIdx)) {
        const d = cardData[state._repIdx];
        const oldDist = (d.sx - bx) ** 2 + (d.sy - by) ** 2;
        let oldLvl = 0;
        const od = ((d.place.fullName || '').match(/·/g) || []).length;
        if (od >= 2) oldLvl = 2; else if (od === 1) oldLvl = 1;
        const oldScore = oldLvl * 10000 - oldDist;
        if (bestScore - oldScore < 5000) bestIdx = state._repIdx;
      }
      state._repIdx = bestIdx;

      const spreadR = Math.round(140 * clusterScale);
      const targets = [];
      for (const idx of group) {
        const d = cardData[idx];
        let dirX = d.cx - bx, dirY = d.cy - by;
        const mag = Math.sqrt(dirX * dirX + dirY * dirY);
        if (mag < 1) {
          const ang = (targets.length / group.length) * Math.PI * 2;
          dirX = Math.cos(ang); dirY = Math.sin(ang);
        } else {
          dirX /= mag; dirY /= mag;
        }
        targets.push({ idx, tx: bx + dirX * spreadR, ty: by + dirY * spreadR });
      }

      const justExpanded = state.expanded && !state._wasExpanded;
      const justCollapsed = !state.expanded && state._wasExpanded;
      state._wasExpanded = state.expanded;

      if (justExpanded) {
        state._animating = true;
        for (const t of targets) {
          const d = cardData[t.idx];
          d.card.style.transition = 'none';
          d.card.style.display = '';
          d.card.style.left = bx + 'px';
          d.card.style.top = by + 'px';
          d.card.classList.remove('place-card-stacked');
          d.card.dataset.clusterKey = '';
          d.line.style.display = 'none';
        }
        requestAnimationFrame(() => {
          for (const idx of group) { cardData[idx].card.offsetHeight; }
          for (const t of targets) {
            const d = cardData[t.idx];
            d.card.style.transition = 'left 0.4s cubic-bezier(0.34,1.56,0.64,1), top 0.4s cubic-bezier(0.34,1.56,0.64,1)';
            d.card.style.left = t.tx + 'px';
            d.card.style.top = t.ty + 'px';
            d.card.style.transform = `translate(-50%, -100%) scale(${d.scale})`;
            d.card.style.opacity = d.opacity;
            d.line.style.display = '';
            d.line.setAttribute('x1', d.pt.x); d.line.setAttribute('y1', d.pt.y);
            d.line.setAttribute('x2', t.tx); d.line.setAttribute('y2', t.ty);
            d.line.style.opacity = d.opacity;
          }
          clearTimeout(state._doneTimer);
          state._doneTimer = setTimeout(() => { state._animating = false; }, 450);
        });
      }

      if (justCollapsed) {
        state._animating = true;
        for (const idx of group) {
          const d = cardData[idx];
          d.card.style.transition = 'none';
          d.card.classList.remove('place-card-stacked');
          d.card.dataset.clusterKey = '';
          if (idx !== bestIdx) {
            d.card.style.display = '';
            const ti = targets.find(t => t.idx === idx);
            d.card.style.left = (ti || { tx: bx }).tx + 'px';
            d.card.style.top = (ti || { ty: by }).ty + 'px';
            d.line.style.display = '';
          }
        }
        requestAnimationFrame(() => {
          for (const idx of group) { cardData[idx].card.offsetHeight; }
          for (const idx of group) {
            const d = cardData[idx];
            d.card.style.transition = 'left 0.35s ease-in, top 0.35s ease-in, opacity 0.25s';
            d.card.style.left = bx + 'px';
            d.card.style.top = by + 'px';
            d.card.style.transform = `translate(-50%, -100%) scale(${d.scale})`;
            d.card.style.opacity = '0';
            d.line.style.display = 'none';
          }
          clearTimeout(state._doneTimer);
          state._doneTimer = setTimeout(() => {
            for (const idx of group) {
              const d = cardData[idx];
              if (idx === bestIdx) {
                d.card.style.transition = 'opacity 0.2s';
                d.card.classList.add('place-card-stacked');
                d.card.dataset.clusterKey = clusterKey;
                d.card.style.opacity = d.opacity;
                d.card.style.left = bx + 'px';
                d.card.style.top = by + 'px';
                d.line.style.display = '';
                d.line.setAttribute('x1', d.pt.x); d.line.setAttribute('y1', d.pt.y);
                d.line.setAttribute('x2', bx); d.line.setAttribute('y2', by);
                d.line.style.opacity = d.opacity;
              } else {
                d.card.style.display = 'none';
              }
            }
            state._animating = false;
          }, 400);
        });
      }

      if (!state._animating) {
        if (state.expanded) {
          for (const t of targets) {
            const d = cardData[t.idx];
            d.card.style.transition = '';
            d.card.style.display = '';
            d.card.style.left = t.tx + 'px';
            d.card.style.top = t.ty + 'px';
            d.card.style.transform = `translate(-50%, -100%) scale(${d.scale})`;
            d.card.style.opacity = d.opacity;
            d.line.style.display = '';
            d.line.setAttribute('x1', d.pt.x); d.line.setAttribute('y1', d.pt.y);
            d.line.setAttribute('x2', t.tx); d.line.setAttribute('y2', t.ty);
            d.line.style.opacity = d.opacity;
          }
        } else {
          for (const idx of group) {
            const d = cardData[idx];
            d.card.style.transition = '';
            d.card.classList.remove('place-card-stacked');
            if (idx === bestIdx) {
              d.card.dataset.clusterKey = clusterKey;
              d.card.classList.add('place-card-stacked');
              d.line.style.display = '';
              d.line.setAttribute('x1', d.pt.x); d.line.setAttribute('y1', d.pt.y);
              d.line.setAttribute('x2', bx); d.line.setAttribute('y2', by);
              d.line.style.opacity = d.opacity;
              d.card.style.display = '';
              d.card.style.left = bx + 'px';
              d.card.style.top = by + 'px';
              d.card.style.transform = `translate(-50%, -100%) scale(${d.scale})`;
              d.card.style.opacity = d.opacity;
            } else {
              d.card.dataset.clusterKey = '';
              d.line.style.display = 'none';
              d.card.style.display = 'none';
            }
          }
        }
      }
    }
  }
}

// ===== 详情卡片 =====

export function showDetail(id) {
  const place = _earth._places[id];
  if (!place) return;

  _earth.highlightFill(id);

  const card = document.getElementById('detail-card');
  card.classList.remove('hidden');

  document.getElementById('detail-name').textContent = place.name;
  document.getElementById('detail-fullname').textContent = place.fullName || place.name;

  // 星星
  const starContainer = document.getElementById('detail-stars');
  starContainer.innerHTML = renderStars(place.rating);

  // 坐标
  document.getElementById('detail-coords').textContent =
    `${place.lat.toFixed(4)}°, ${place.lng.toFixed(4)}°`;
}

export function hideDetail() {
  document.getElementById('detail-card').classList.add('hidden');
}

// ===== 事件绑定 =====

function _bindEvents() {
  // 关闭详情按钮
  document.getElementById('btn-close-detail').addEventListener('click', hideDetail);

  // 全局点击：非交互区域关闭详情、回退视角
  document.addEventListener('click', (e) => {
    const hitCard = e.target.closest('.place-card');
    const hitDetail = e.target.closest('#detail-card');
    const hitModal = e.target.closest('.modal');
    const isInteractive = hitCard || hitDetail || hitModal ||
      e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';

    // 关闭详情卡片
    const card = document.getElementById('detail-card');
    if (!card.classList.contains('hidden') && !hitDetail && !hitModal) {
      card.classList.add('hidden');
    }

    // 非交互区域：回退视角
    if (!isInteractive && _earth._focusedPlaceId) {
      _earth.resetView();
    }
  });
}
