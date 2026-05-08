"""Apply all earth.js changes for async GeoJSON loading."""
import sys

path = r'D:\大学作业文件夹\自制软件\gesture-earth-demo\js\earth.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

patches = 0

# 1) clearCoastlines key list (already done manually, check)
if "admin1AsiaPoints" not in content:
    content = content.replace(
        "'admin1ForeignPoints'",
        "'admin1AsiaPoints', 'admin1RestPoints'"
    )
    print('[1/5] clearCoastlines: patched')
    patches += 1
else:
    print('[1/5] clearCoastlines: already patched')

# 2) loadAdminBoundaries - find and replace the whole method
old_start = content.find('// ===== loadAdminBoundaries')
if old_start == -1:
    old_start = content.find('async loadAdminBoundaries()')
if old_start >= 0:
    # Find the block - from the comment line to the closing brace
    # Go back to find the comment line
    line_start = content.rfind('\n', 0, old_start) + 1
    # Find the comment line before the method
    comment_line = content.rfind('// =====', 0, old_start)
    if comment_line >= 0:
        line_start = content.rfind('\n', 0, comment_line) + 1
    # Find the matching closing brace
    brace_start = content.find('{', old_start)
    depth = 0
    i = brace_start
    while i < len(content):
        if content[i] == '{':
            depth += 1
        elif content[i] == '}':
            depth -= 1
            if depth == 0:
                break
        i += 1
    old_block = content[line_start:i+2]  # include the newline after }

    new_block = '''  // ===== 加载全球一级行政区边界（分区域异步加载） =====
  // 加载状态：pending → loading → loaded
  // 兜底顺序：中国(await) → 亚太(后台) → 欧美(后台)
  // 用户聚焦某区域时，_priorityRegion 插队优先加载
  async loadAdminBoundaries() {
    this._adminLoadState = { china: 'pending', asia: 'pending', rest: 'pending' };
    this._priorityRegion = null;

    // 1) 中国优先，同步等待
    await this._loadRegion('admin1_china', 'china', {
      color: 0xffffff, size: 1.5, opacity: 0.4,
    }, 'admin1ChinaPoints');

    // 2) 后台异步加载剩余区域
    this._scheduleRemaining();
  }

  // 加载单个区域文件
  async _loadRegion(fileName, region, style, meshKey) {
    if (this._adminLoadState[region] === 'loaded') return;
    this._adminLoadState[region] = 'loading';
    try {
      const resp = await fetch(`data/map/${fileName}.geojson`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      if (data.features.length > 0) {
        if (region === 'china') this._provinceFeatures = data.features;
        this._geoJSONToParticles(data, style, meshKey, true);
      }
      this._adminLoadState[region] = 'loaded';
      if (region === 'china') this._createHomeFill();
    } catch (err) {
      console.warn(`[earth] ${fileName} load failed:`, err);
      this._adminLoadState[region] = 'pending';
    }
  }

  // 后台调度：有优先区域则插队，否则兜底顺序 亚太→欧美
  _scheduleRemaining() {
    const loadAsia = () => {
      if (this._adminLoadState.asia !== 'pending') return;
      this._loadRegion('admin1_asia', 'asia', {
        color: 0xffffff, size: 0.85, opacity: 0.32,
      }, 'admin1AsiaPoints');
    };
    const loadRest = () => {
      if (this._adminLoadState.rest !== 'pending') return;
      this._loadRegion('admin1_eur_amer', 'rest', {
        color: 0xffffff, size: 0.85, opacity: 0.24,
      }, 'admin1RestPoints');
    };
    if (this._priorityRegion === 'rest') { loadRest(); loadAsia(); }
    else if (this._priorityRegion === 'asia') { loadAsia(); loadRest(); }
    else { loadAsia(); loadRest(); }
  }

  // 根据经纬度判断所属区域，标记优先级并触发加载
  _prioritizeRegion(lat, lng) {
    // 中国范围约 18-54N, 73-135E — 已 await 加载，无需动作
    if (lat >= 18 && lat <= 54 && lng >= 73 && lng <= 135) return;
    // 亚太范围（含东亚/东南亚/南亚/大洋洲/中亚/俄罗斯）
    if (lat >= -50 && lat <= 70 && lng >= 60 && lng <= 180) {
      if (this._adminLoadState.asia === 'pending') {
        this._priorityRegion = 'asia';
        this._scheduleRemaining();
      }
    } else {
      if (this._adminLoadState.rest === 'pending') {
        this._priorityRegion = 'rest';
        this._scheduleRemaining();
      }
    }
  }
'''

    content = content[:line_start] + new_block + content[i+2:]
    print('[2/5] loadAdminBoundaries: patched')
    patches += 1
else:
    print('[2/5] loadAdminBoundaries: NOT FOUND')

# 3) Zoom layers - replace foreign admin block
old_zoom = '''    // 外国州界
    if (this.admin1ForeignPoints) {
      this._applyZoomLayer(this.admin1ForeignPoints, distFromCenter, 2.2, 0.28, '_foreignAdminOpacity');
    }'''
new_zoom = '''    // 亚太州界 — 地心距 < 2.5
    if (this.admin1AsiaPoints) {
      this._applyZoomLayer(this.admin1AsiaPoints, distFromCenter, 2.5, 0.32, '_asiaAdminOpacity');
    }
    // 欧美州界 — 地心距 < 2.2
    if (this.admin1RestPoints) {
      this._applyZoomLayer(this.admin1RestPoints, distFromCenter, 2.2, 0.24, '_restAdminOpacity');
    }'''
if old_zoom in content:
    content = content.replace(old_zoom, new_zoom)
    print('[3/5] zoom layers: patched')
    patches += 1
else:
    print('[3/5] zoom layers: NOT FOUND')

# 4) Breathing
old_breath = '    if (this.admin1ForeignPoints)\n      this.admin1ForeignPoints.material.opacity = breathe(this._foreignAdminOpacity || 0, 0.9);'
new_breath = '    if (this.admin1AsiaPoints)\n      this.admin1AsiaPoints.material.opacity = breathe(this._asiaAdminOpacity || 0, 1.0);\n    if (this.admin1RestPoints)\n      this.admin1RestPoints.material.opacity = breathe(this._restAdminOpacity || 0, 0.9);'
if old_breath in content:
    content = content.replace(old_breath, new_breath)
    print('[4/5] breathing: patched')
    patches += 1
else:
    print('[4/5] breathing: NOT FOUND')

# 5) focusOnPlace - inject _prioritizeRegion call
old_focus = '  focusOnPlace(lat, lng, onArrive) {\n    const local = this._latLngToVec3(lat, lng, this.earthRadius * 1.01);'
new_focus = '  focusOnPlace(lat, lng, onArrive) {\n    if (this._prioritizeRegion) this._prioritizeRegion(lat, lng);\n    const local = this._latLngToVec3(lat, lng, this.earthRadius * 1.01);'
if old_focus in content:
    content = content.replace(old_focus, new_focus)
    print('[5/5] focusOnPlace: patched')
    patches += 1
else:
    print('[5/5] focusOnPlace: NOT FOUND')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print(f'\nTotal patches applied: {patches}/5')
print('earth.js written successfully.')
