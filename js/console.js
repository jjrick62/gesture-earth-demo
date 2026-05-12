// ===== 卡片管理控制台（搬自旅行相册 app.js，API 层） =====

import { initDB, getAllPlaces, savePlace, deletePlace, uploadPhoto, isLoggedIn, login, register, logout } from './api.js';
import { syncPlaceCards, showDetail, hideDetail } from './card.js';

const RATING_COLORS = ['', '#888888', '#4b9ee0', '#e0b84b', '#e0b84b', '#ffffff'];

const DEMO_PLACES = [
  { id:'demo-shanghai', name:'上海市', fullName:'上海市·上海市', lat:31.2304, lng:121.4737, rating:5, photos:[], notes:'', visitDate:'', _color:'#ffffff', _rating:5 },
  { id:'demo-beijing',  name:'北京市', fullName:'北京市·北京市', lat:39.9042, lng:116.4074, rating:5, photos:[], notes:'', visitDate:'', _color:'#e0584b', _rating:5 },
  { id:'demo-nanjing',  name:'南京市', fullName:'江苏省·南京市', lat:32.0603, lng:118.7969, rating:4, photos:[], notes:'', visitDate:'', _color:'#e0b84b', _rating:4 },
  { id:'demo-losangeles', name:'洛杉矶', fullName:'美国·洛杉矶', lat:34.0522, lng:-118.2437, rating:4, photos:[], notes:'', visitDate:'', _color:'#4b9ee0', _rating:4 },
  { id:'demo-newyork', name:'纽约', fullName:'美国·纽约', lat:40.7128, lng:-74.0060, rating:5, photos:[], notes:'', visitDate:'', _color:'#8b4be0', _rating:5 },
];

let _earth = null;
let _citiesData = [];
let _regionsData = [];
let _worldCitiesData = [];
let _regionsLoaded = false;
let _worldCitiesLoaded = false;
let _editingId = null;
let _addRating = 0;
let _tempPhotos = [];

// ===== 异步加载国际数据 =====

async function _ensureRegions() {
  if (_regionsLoaded) return;
  try {
    const resp = await fetch('data/regions_world.json');
    if (resp.ok) {
      const raw = await resp.json();
      _regionsData = raw.map(r => ({
        name: r.zh || r.en,
        nameEn: r.en,
        province: r.ad || r.cc,
        lat: r.la,
        lng: r.lo,
        level: 'region',
      }));
      _regionsLoaded = true;
      console.log('regions_world.json 加载完成: %d 条', _regionsData.length);
    }
  } catch (e) { console.warn('国际地区数据加载失败', e); }
}

async function _ensureWorldCities() {
  if (_worldCitiesLoaded) return;
  try {
    const resp = await fetch('data/cities_world.json');
    if (resp.ok) {
      const raw = await resp.json();
      _worldCitiesData = raw.map(c => ({
        name: c.en,
        nameEn: c.en,
        province: c.cc,
        lat: c.la,
        lng: c.lo,
        level: 'city',
        pop: c.pop || 0,
      }));
      _worldCitiesLoaded = true;
      console.log('cities_world.json 加载完成: %d 条', _worldCitiesData.length);
    }
  } catch (e) { console.warn('国际城市数据加载失败', e); }
}

function _scoreMatch(item, q) {
  let score = 0;
  const name = item.name || '';
  const nameEn = (item.nameEn || '').toLowerCase();
  const province = item.province || '';
  const qLower = q.toLowerCase();

  if (name === q || nameEn === qLower) { score = 100; }
  else if (name.startsWith(q) || nameEn.startsWith(qLower)) { score = 80; }
  else if (name.includes(q) || nameEn.includes(qLower)) { score = 50; }
  else if (province.includes(q) || province.toLowerCase().includes(qLower)) { score = 20; }
  else { return 0; }

  if (item.level === 'city') score += 2;
  else if (item.level === 'province') score += 1;
  return score;
}

// ===== 认证（搬自旅行相册 bindAuthEvents + handleAuthSubmit） =====

let _authMode = 'login';

function _showAuthModal() {
  _authMode = 'login';
  document.getElementById('auth-title').textContent = '登录';
  document.getElementById('btn-auth-submit').textContent = '登录';
  document.getElementById('btn-auth-switch').textContent = '没有账号？注册';
  document.getElementById('auth-error').style.display = 'none';
  document.getElementById('auth-email').value = '';
  document.getElementById('auth-password').value = '';
  document.getElementById('auth-modal').classList.remove('hidden');
}

function _hideAuthModal() {
  document.getElementById('auth-modal').classList.add('hidden');
}

async function _handleAuthSubmit() {
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const errEl = document.getElementById('auth-error');

  if (!email || !password || password.length < 6) {
    errEl.textContent = '请输入有效邮箱和至少6位密码';
    errEl.style.display = '';
    return;
  }

  try {
    if (_authMode === 'login') {
      await login(email, password);
    } else {
      await register(email, password);
    }
    _hideAuthModal();
    await _doInit();
  } catch (err) {
    errEl.textContent = err.message || '操作失败';
    errEl.style.display = '';
  }
}

// ===== 初始化 =====

export async function initConsole(earth) {
  _earth = earth;
  _earth._persist = null; // API 模式不需要客户端持久化回调

  // 加载城市数据
  try {
    const resp = await fetch('data/cities.json');
    _citiesData = await resp.json();
  } catch (e) { console.warn('城市数据加载失败', e); }

  _bindAuthEvents();
  _bindEvents(); // 基础事件尽早绑定，不受登录态影响

  if (!isLoggedIn()) {
    _showAuthModal();
    return; // 等登录后再调 _doInit
  }

  await _doInit();
}

async function _doInit() {
  try {
    const meta = await initDB();
    const places = await getAllPlaces();

    if (places.length === 0) {
      // 首次：填充 demo 数据
      for (const p of DEMO_PLACES) {
        await savePlace({
          name: p.name, full_name: p.fullName, lat: p.lat, lng: p.lng,
          rating: p.rating, notes: p.notes || '', visit_date: p.visitDate || '',
        });
      }
      // 重新加载（获取服务端 ID）
      const reloaded = await getAllPlaces();
      _applyPlaces(reloaded);
    } else {
      _applyPlaces(places);
    }

    _earth.setHome(31.2304, 121.4737, '上海市', '上海市');
    syncPlaceCards();
    _bindEvents();
  } catch (err) {
    console.error('数据加载失败', err);
  }
}

function _applyPlaces(places) {
  for (const p of places) {
    // API 返回图片 URL（非 dataUrl），转为完整 URL
    const photos = (p.photos || []).map(ph => ({
      dataUrl: ph.url || ph.dataUrl || '',
      caption: ph.caption || '',
      id: ph.id,
    }));

    const rating = p.rating || 3;
    const color = RATING_COLORS[rating] || '#ffffff';
    const placeData = {
      id: p.id, name: p.name,
      fullName: p.full_name || p.fullName || p.name,
      lat: p.lat, lng: p.lng, rating,
      photos, notes: p.notes || '', visitDate: p.visit_date || p.visitDate || '',
    };
    _earth.addPlace(placeData, color, rating);
    _earth._places[p.id]._color = color;
    _earth._places[p.id]._rating = rating;
  }
}

// ===== 城市搜索（搬自旅行相册 createSearch） =====

function _createSearch(inputId, resultsId, onSelect) {
  const input = document.getElementById(inputId);
  const results = document.getElementById(resultsId);
  if (results.parentElement !== document.body) {
    document.body.appendChild(results);
  }

  input.addEventListener('focus', () => {
    _ensureRegions();
  });

  input.addEventListener('input', () => {
    const q = input.value.trim();
    if (!q) { results.classList.remove('active'); return; }

    // 输入非中文时，触发国际城市异步加载
    if (!/[一-鿿]/.test(q)) {
      _ensureWorldCities();
    }

    const scored = [];
    for (const c of _citiesData) {
      const s = _scoreMatch(c, q);
      if (s > 0) scored.push({ city: c, score: s });
    }
    for (const r of _regionsData) {
      const s = _scoreMatch(r, q);
      if (s > 0) scored.push({ city: r, score: s });
    }
    for (const w of _worldCitiesData) {
      const s = _scoreMatch(w, q);
      if (s > 0) scored.push({ city: w, score: s });
    }
    scored.sort((a, b) => b.score - a.score);
    const matched = scored.slice(0, 15).map(s => s.city);

    results.innerHTML = '';
    if (matched.length === 0) { results.classList.remove('active'); return; }
    results.classList.add('active');
    const rect = input.getBoundingClientRect();
    results.style.top = (rect.bottom + 4) + 'px';
    results.style.left = rect.left + 'px';
    results.style.width = rect.width + 'px';

    for (const c of matched) {
      const div = document.createElement('div');
      div.className = 'result-item';
      div.appendChild(document.createTextNode(c.name));
      const provSpan = document.createElement('span');
      provSpan.className = 'province';
      provSpan.textContent = c.province;
      div.appendChild(provSpan);
      div.addEventListener('click', () => {
        input.value = c.name;
        results.classList.remove('active');
        onSelect(c);
      });
      results.appendChild(div);
    }
  });

  input.addEventListener('blur', () => {
    setTimeout(() => results.classList.remove('active'), 200);
  });
}

// ===== 弹窗（搬自旅行相册 openEditModal） =====

let _selectedCity = null;

export function openEditModal(place) {
  _editingId = place ? place.id : null;
  _selectedCity = place ? { name: place.name, province: (place.fullName || '').split('·')[0], lat: place.lat, lng: place.lng } : null;
  _addRating = place ? (place.rating || 0) : 0;
  _tempPhotos = place && place.photos ? place.photos.map(p => ({ dataUrl: p.dataUrl, caption: p.caption || '', _existing: true })) : [];

  document.getElementById('city-search').value = place ? place.name : '';
  document.getElementById('input-lat').value = place ? place.lat : '';
  document.getElementById('input-lng').value = place ? place.lng : '';
  document.getElementById('visit-date').value = place ? (place.visitDate || '') : new Date().toISOString().split('T')[0];
  document.getElementById('place-notes').value = place ? (place.notes || '') : '';
  _updateStarInput(_addRating);
  _renderModalPhotos();

  const modal = document.getElementById('add-modal');
  modal.querySelector('.modal-header h2').textContent = place ? '编辑地点' : '添加地点';
  document.getElementById('btn-delete-modal').style.display = place ? '' : 'none';
  modal.classList.remove('hidden');
}

function _closeModal() {
  document.getElementById('add-modal').classList.add('hidden');
  _editingId = null;
  _tempPhotos = [];
}

// ===== 照片 =====

function _renderModalPhotos() {
  const grid = document.getElementById('modal-photo-grid');
  grid.innerHTML = '';
  for (let i = 0; i < _tempPhotos.length; i++) {
    const photo = _tempPhotos[i];
    const wrap = document.createElement('div');
    wrap.className = 'modal-photo-wrap';
    const img = document.createElement('img');
    img.src = photo.dataUrl;
    img.title = photo.caption || '照片';
    wrap.appendChild(img);
    const del = document.createElement('button');
    del.className = 'modal-photo-del';
    del.textContent = '×';
    del.addEventListener('click', () => {
      _tempPhotos.splice(i, 1);
      _renderModalPhotos();
    });
    wrap.appendChild(del);
    grid.appendChild(wrap);
  }
}

function _updateStarInput(rating) {
  const spans = document.getElementById('star-input').querySelectorAll('span');
  spans.forEach(s => {
    const v = parseInt(s.dataset.value);
    s.textContent = v <= rating ? '★' : '☆';
    s.className = v <= rating ? 'active' : '';
  });
}

// ===== 保存（搬自旅行相册，API 版本） =====

async function _savePlace() {
  const name = document.getElementById('city-search').value.trim();
  if (!name) { alert('请输入地点名称'); return; }

  let lat, lng, fullName;

  if (_selectedCity && _selectedCity.name === name) {
    lat = _selectedCity.lat;
    lng = _selectedCity.lng;
    fullName = _selectedCity.province + '·' + _selectedCity.name;
  } else {
    const match = _citiesData.find(c => c.name === name)
      || _regionsData.find(r => r.name === name || r.nameEn === name)
      || _worldCitiesData.find(w => w.name === name || w.nameEn === name)
      || _citiesData.find(c => c.name.includes(name));
    if (match) {
      _selectedCity = match;
      document.getElementById('city-search').value = match.name;
      lat = match.lat;
      lng = match.lng;
      fullName = match.province + '·' + match.name;
    } else {
      lat = parseFloat(document.getElementById('input-lat').value);
      lng = parseFloat(document.getElementById('input-lng').value);
      if (isNaN(lat) || isNaN(lng)) {
        alert('未匹配到中国城市，请手动输入经纬度坐标'); return;
      }
      fullName = name;
    }
  }

  const placePayload = {
    name,
    full_name: fullName,
    lat, lng,
    rating: _addRating || 3,
    notes: document.getElementById('place-notes').value,
    visit_date: document.getElementById('visit-date').value,
  };

  // 区分新建照片（有 file）和已有照片（有 id/dataUrl）
  const newPhotos = _tempPhotos.filter(p => p.file);
  const existingPhotos = _tempPhotos.filter(p => !p.file);

  try {
    if (_editingId) {
      // 编辑模式
      await savePlace({ ...placePayload, _exists: true, id: _editingId });
      // 上传新照片
      for (const p of newPhotos) {
        try { await uploadPhoto(_editingId, p.file); } catch (err) { console.warn('照片上传失败:', err); }
      }
      // 重建 3D 元素
      _rebuildPlace(_editingId, placePayload, existingPhotos);
      syncPlaceCards();
      _closeModal();
      _earth._focusedPlaceId = _editingId;
      showDetail(_editingId);
    } else {
      // 新建模式
      const saved = await savePlace(placePayload);
      // 上传新照片
      for (const p of newPhotos) {
        try { await uploadPhoto(saved.id, p.file); } catch (err) { console.warn('照片上传失败:', err); }
      }
      _closeModal();
      // 重新加载全部地点以获取完整数据
      const places = await getAllPlaces();
      const full = places.find(pl => pl.id === saved.id);
      if (full) {
        _applyOnePlace(full);
        syncPlaceCards();
        _earth._focusedPlaceId = full.id;
        _earth.highlightFill(full.id);
        _earth.focusOnPlace(full.lat, full.lng, () => showDetail(full.id));
      }
    }
  } catch (err) {
    console.error('保存失败:', err);
    alert('保存失败：' + err.message);
  }
}

function _applyOnePlace(p) {
  const photos = (p.photos || []).map(ph => ({
    dataUrl: ph.url || ph.dataUrl || '',
    caption: ph.caption || '',
    id: ph.id,
  }));
  const rating = p.rating || 3;
  const color = RATING_COLORS[rating] || '#ffffff';

  _earth.removePlace(p.id);
  _earth.addPlace({
    id: p.id, name: p.name,
    fullName: p.full_name || p.fullName || p.name,
    lat: p.lat, lng: p.lng, rating,
    photos, notes: p.notes || '', visitDate: p.visit_date || p.visitDate || '',
  }, color, rating);
  _earth._places[p.id]._color = color;
  _earth._places[p.id]._rating = rating;
}

function _rebuildPlace(id, payload, existingPhotos) {
  const rating = payload.rating || 3;
  const color = RATING_COLORS[rating] || '#ffffff';
  const photos = existingPhotos.map(p => ({ dataUrl: p.dataUrl, caption: p.caption || '' }));

  _earth.removePlace(id);
  _earth.addPlace({
    id, name: payload.name,
    fullName: payload.full_name || payload.name,
    lat: payload.lat, lng: payload.lng, rating,
    photos, notes: payload.notes || '', visitDate: payload.visit_date || '',
  }, color, rating);
  _earth._places[id]._color = color;
  _earth._places[id]._rating = rating;
}

async function _deleteFromModal() {
  if (!_editingId) return;
  const place = _earth._places[_editingId];
  if (!place) return;
  if (!confirm(`删除 ${place.name} ？`)) return;
  try {
    await deletePlace(_editingId);
    _earth.removePlace(_editingId);
    syncPlaceCards();
    hideDetail();
    _closeModal();
  } catch (err) {
    alert('删除失败：' + err.message);
  }
}

// ===== 事件绑定 =====

function _bindAuthEvents() {
  document.getElementById('btn-auth-submit').addEventListener('click', _handleAuthSubmit);
  document.getElementById('btn-auth-switch').addEventListener('click', () => {
    _authMode = _authMode === 'login' ? 'register' : 'login';
    document.getElementById('auth-title').textContent = _authMode === 'login' ? '登录' : '注册';
    document.getElementById('btn-auth-submit').textContent = _authMode === 'login' ? '登录' : '注册';
    document.getElementById('btn-auth-switch').textContent = _authMode === 'login' ? '没有账号？注册' : '已有账号？登录';
    document.getElementById('auth-error').style.display = 'none';
  });
  document.getElementById('btn-auth-close').addEventListener('click', _hideAuthModal);
  document.getElementById('auth-modal').querySelector('.modal-backdrop').addEventListener('click', _hideAuthModal);
  document.getElementById('auth-password').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') _handleAuthSubmit();
  });
}

let _eventsBound = false;

function _bindEvents() {
  if (_eventsBound) return;
  _eventsBound = true;

  // 添加按钮
  document.getElementById('btn-add').addEventListener('click', () => openEditModal(null));

  // 城市搜索
  _createSearch('city-search', 'city-search-results', (c) => {
    _selectedCity = c;
    document.getElementById('input-lat').value = c.lat;
    document.getElementById('input-lng').value = c.lng;
  });

  // 关闭弹窗
  document.querySelectorAll('#add-modal .btn-close, #add-modal .modal-backdrop').forEach(el => {
    el.addEventListener('click', () => _closeModal());
  });

  // 星星输入
  const starInput = document.getElementById('star-input');
  starInput.querySelectorAll('span').forEach(s => {
    s.addEventListener('click', () => {
      _addRating = parseInt(s.dataset.value);
      _updateStarInput(_addRating);
    });
    s.addEventListener('mouseenter', () => _updateStarInput(parseInt(s.dataset.value)));
    s.addEventListener('mouseleave', () => _updateStarInput(_addRating));
  });

  // 保存 / 取消 / 弹窗内删除
  document.getElementById('btn-save-add').addEventListener('click', () => _savePlace());
  document.getElementById('btn-cancel-add').addEventListener('click', () => _closeModal());
  document.getElementById('btn-delete-modal').addEventListener('click', () => _deleteFromModal());

  // 弹窗添加照片（API 模式：保留 file 对象，保存时才上传）
  document.getElementById('btn-modal-add-photo').addEventListener('click', () => {
    document.getElementById('modal-photo-input').click();
  });
  document.getElementById('modal-photo-input').addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    for (const file of files) {
      _tempPhotos.push({
        dataUrl: URL.createObjectURL(file), // 预览用 blob URL
        caption: '',
        file: file,
      });
    }
    _renderModalPhotos();
    e.target.value = '';
  });

  // 详情卡关闭
  document.getElementById('btn-close-detail').addEventListener('click', () => hideDetail());

  // 详情卡添加照片
  document.getElementById('btn-add-photo').addEventListener('click', () => {
    document.getElementById('photo-input').click();
  });
  document.getElementById('photo-input').addEventListener('change', async (e) => {
    const placeId = _earth._focusedPlaceId;
    if (!placeId) return;
    const place = _earth._places[placeId];
    if (!place) return;
    const files = Array.from(e.target.files);
    for (const file of files) {
      try {
        const photo = await uploadPhoto(placeId, file);
        if (!place.photos) place.photos = [];
        place.photos.push({ dataUrl: photo.url || photo.dataUrl, caption: photo.caption || '', id: photo.id });
      } catch (err) { alert('照片上传失败: ' + err.message); }
    }
    showDetail(placeId);
    syncPlaceCards();
    e.target.value = '';
  });

  // 详情卡编辑
  document.getElementById('btn-edit-place').addEventListener('click', () => {
    const id = _earth._focusedPlaceId;
    if (!id) return;
    const place = _earth._places[id];
    if (!place) return;
    document.getElementById('detail-card').classList.add('hidden');
    _earth.highlightFill(id);
    openEditModal(place);
  });

  // 详情卡删除
  document.getElementById('btn-delete-place').addEventListener('click', async () => {
    const id = _earth._focusedPlaceId;
    if (!id) return;
    const place = _earth._places[id];
    if (!place || !confirm(`删除 ${place.name} ？`)) return;
    try {
      await deletePlace(id);
      _earth.removePlace(id);
      syncPlaceCards();
      hideDetail();
    } catch (err) { alert('删除失败: ' + err.message); }
  });

  // 全局点击
  document.addEventListener('click', (e) => {
    const hitCard = e.target.closest('.place-card');
    const hitModal = e.target.closest('.modal');
    const hitDetail = e.target.closest('#detail-card');
    const isInteractive = hitCard || hitModal || hitDetail ||
      e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';

    const card = document.getElementById('detail-card');
    if (!card.classList.contains('hidden') && !hitDetail && !hitModal) {
      card.classList.add('hidden');
    }

    if (!isInteractive && _earth._focusedPlaceId) {
      _earth.resetView();
    }
  });

  // 键盘 ESC 关闭弹窗
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const modal = document.getElementById('add-modal');
      if (!modal.classList.contains('hidden')) _closeModal();
    }
  });

  // 总览按钮
  document.getElementById('btn-overview').addEventListener('click', () => _openOverview());
  // 总览弹窗关闭
  document.getElementById('overview-modal').querySelector('.btn-close').addEventListener('click', () => _closeOverview());
  document.getElementById('overview-modal').querySelector('.modal-backdrop').addEventListener('click', () => _closeOverview());
}

// ===== 地点总览 =====

function _openOverview() {
  document.getElementById('overview-modal').classList.remove('hidden');
  _renderOverview();
}

function _closeOverview() {
  document.getElementById('overview-modal').classList.add('hidden');
}

async function _renderOverview() {
  const container = document.getElementById('overview-list');
  let placesArr;
  try {
    placesArr = await getAllPlaces();
  } catch (e) { placesArr = []; }

  const sorted = [...placesArr].sort((a, b) => (b.visitDate || '').localeCompare(a.visitDate || ''));
  const total = sorted.length;
  const avg = total > 0 ? (sorted.reduce((s, p) => s + (p.rating || 3), 0) / total).toFixed(1) : '0.0';
  document.getElementById('overview-stats').textContent = `${total} 个地点 · ★ ${avg}`;

  if (total === 0) {
    container.innerHTML = '<div class="overview-empty">还没有地点，点击右上角 + 添加</div>';
    return;
  }

  container.innerHTML = sorted.map(p => {
    const stars = '★'.repeat(p.rating || 3) + '☆'.repeat(5 - (p.rating || 3));
    const photoCount = p.photos ? p.photos.length : 0;
    return `
      <div class="overview-item" data-id="${p.id}">
        <div class="overview-item-main">
          <div class="overview-item-name">${p.name}</div>
          <div class="overview-item-sub">${p.fullName || p.name} · ${p.visitDate || '无日期'}</div>
        </div>
        <span class="overview-item-stars">${stars}</span>
        <span class="overview-item-photos">${photoCount}张</span>
        <div class="overview-item-actions">
          <button class="overview-btn" data-action="edit" data-id="${p.id}">编辑</button>
          <button class="overview-btn danger" data-action="delete" data-id="${p.id}">删除</button>
        </div>
      </div>`;
  }).join('');

  container.querySelectorAll('.overview-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      const id = item.dataset.id;
      const place = _earth._places[id];
      if (!place) return;
      _closeOverview();
      _earth._focusedPlaceId = id;
      _earth.highlightFill(id);
      _earth.focusOnPlace(place.lat, place.lng, () => showDetail(id));
    });
  });

  container.querySelectorAll('[data-action="edit"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const place = _earth._places[id];
      if (!place) return;
      _closeOverview();
      _earth._focusedPlaceId = id;
      _earth.highlightFill(id);
      _earth.focusOnPlace(place.lat, place.lng, () => openEditModal(place));
    });
  });

  container.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const place = _earth._places[id];
      if (!place || !confirm(`删除 ${place.name} ？`)) return;
      try {
        await deletePlace(id);
        _earth.removePlace(id);
        syncPlaceCards();
        hideDetail();
        _renderOverview();
      } catch (err) { alert('删除失败: ' + err.message); }
    });
  });
}
