"""Full-chain verification for gesture-earth-demo async loading + MediaPipe local."""

import os, sys, json, http.server, socketserver, threading, time, urllib.request, urllib.error

PROJECT = r'D:\大学作业文件夹\自制软件\gesture-earth-demo'
PASS, FAIL = '[PASS]', '[FAIL]'
results = []

def check(name, condition, detail=''):
    ok = bool(condition)
    results.append((name, ok, detail))
    print(f"  {PASS if ok else FAIL} {name}" + (f' -- {detail}' if detail else ''))
    return ok

def section(title):
    print(f'\n=== {title} ===')

# ============================================================
section('1. File Integrity')

check('admin1_china.geojson exists',
      os.path.exists(f'{PROJECT}/data/map/admin1_china.geojson'))

check('admin1_asia.geojson exists',
      os.path.exists(f'{PROJECT}/data/map/admin1_asia.geojson'))

check('admin1_eur_amer.geojson exists',
      os.path.exists(f'{PROJECT}/data/map/admin1_eur_amer.geojson'))

check('hand_landmarker.task exists',
      os.path.exists(f'{PROJECT}/data/models/hand_landmarker.task'))

check('world_admin1.geojson deleted',
      not os.path.exists(f'{PROJECT}/data/map/world_admin1.geojson'))

check('china_provinces.geojson deleted',
      not os.path.exists(f'{PROJECT}/data/map/china_provinces.geojson'))

# ============================================================
section('2. GeoJSON Content Validation')

def verify_geojson(path, expected_min, label):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        count = len(data.get('features', []))
        return check(f'{label} features ({count})',
                     count >= expected_min,
                     f'expected >= {expected_min}')
    except Exception as e:
        return check(f'{label} parseable', False, str(e))

verify_geojson(f'{PROJECT}/data/map/admin1_china.geojson', 70, 'china')
verify_geojson(f'{PROJECT}/data/map/admin1_asia.geojson', 800, 'asia')
verify_geojson(f'{PROJECT}/data/map/admin1_eur_amer.geojson', 3000, 'eur_amer')

# ============================================================
section('3. earth.js Code Correctness')

with open(f'{PROJECT}/js/earth.js', 'r', encoding='utf-8') as f:
    earth_js = f.read()

check('old admin1ForeignPoints removed',
      'admin1ForeignPoints' not in earth_js)

check('_loadRegion method exists',
      '_loadRegion' in earth_js)

check('_scheduleRemaining method exists',
      '_scheduleRemaining' in earth_js)

check('_prioritizeRegion method exists',
      '_prioritizeRegion' in earth_js)

check('_adminLoadState field exists',
      '_adminLoadState' in earth_js)

check('admin1AsiaPoints key exists',
      'admin1AsiaPoints' in earth_js)

check('admin1RestPoints key exists',
      'admin1RestPoints' in earth_js)

check('_prioritizeRegion injected in focusOnPlace',
      '_prioritizeRegion(lat, lng)' in earth_js)

check('zoom: 3-tier thresholds',
      all(x in earth_js for x in ['2.5, 0.32', '2.2, 0.24']))

check('breathing: asia + rest layers',
      'breathe(this._asiaAdminOpacity' in earth_js and
      'breathe(this._restAdminOpacity' in earth_js)

check('clearCoastlines includes new keys',
      "'admin1AsiaPoints'" in earth_js and "'admin1RestPoints'" in earth_js)

# ============================================================
section('4. camera.js Code Correctness')

with open(f'{PROJECT}/js/camera.js', 'r', encoding='utf-8') as f:
    camera_js = f.read()

check('local model path',
      "modelAssetPath: 'data/models/hand_landmarker.task'" in camera_js)

check('Google CDN removed',
      'storage.googleapis.com' not in camera_js)

# ============================================================
section('5. HTTP Server - File Accessibility')

PORT = 8083
os.chdir(PROJECT)

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

def start_server():
    server = socketserver.TCPServer(("", PORT), QuietHandler)
    server.timeout = 2
    t = threading.Thread(target=server.serve_forever, daemon=True)
    t.start()
    return server

def http_get(path):
    try:
        req = urllib.request.Request(f'http://localhost:{PORT}{path}')
        resp = urllib.request.urlopen(req, timeout=5)
        return resp.status, resp.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()
    except Exception as e:
        return None, str(e)

server = start_server()
time.sleep(0.5)

check(f'Server on :{PORT}', True)

for label, path in [
    ('GET admin1_china.geojson', '/data/map/admin1_china.geojson'),
    ('GET admin1_asia.geojson', '/data/map/admin1_asia.geojson'),
    ('GET admin1_eur_amer.geojson', '/data/map/admin1_eur_amer.geojson'),
    ('GET hand_landmarker.task', '/data/models/hand_landmarker.task'),
]:
    status, _ = http_get(path)
    check(f'{label} -> 200', status == 200, f'HTTP {status}')

status, _ = http_get('/data/map/world_admin1.geojson')
check('GET world_admin1.geojson -> 404 (deleted)', status == 404, f'HTTP {status}')

server.shutdown()

# ============================================================
section('6. File Size Summary')

total = 0
for f in [
    'data/map/admin1_china.geojson',
    'data/map/admin1_asia.geojson',
    'data/map/admin1_eur_amer.geojson',
    'data/map/china_cities.geojson',
    'data/map/borders.geojson',
    'data/map/coastline.geojson',
    'data/models/hand_landmarker.task',
]:
    fp = os.path.join(PROJECT, f)
    if os.path.exists(fp):
        sz = os.path.getsize(fp)
        total += sz
        if sz > 1_000_000:
            print(f'  {f}: {sz/1_000_000:.1f} MB')
        else:
            print(f'  {f}: {sz/1_000:.0f} KB')

print(f'\n  Total data: {total/1_000_000:.1f} MB')

# ============================================================
section('7. Summary')

passed = sum(1 for _, ok, _ in results if ok)
failed = sum(1 for _, ok, _ in results if not ok)

if failed > 0:
    print('\n  FAILURES:')
    for name, ok, detail in results:
        if not ok:
            print(f'    {FAIL} {name} -- {detail}')

print(f'\n  Result: {passed}/{len(results)} passed, {failed} failed')
sys.exit(0 if failed == 0 else 1)
