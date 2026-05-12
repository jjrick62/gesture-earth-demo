"""从 admin1 GeoJSON 文件中提取地名属性，输出精简 JSON。
短键名：en(英文), zh(中文), la(纬度), lo(经度), cc(ISO国家码), ad(所属国)
"""
import json
import os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCES = [
    os.path.join(BASE, 'data', 'map', 'admin1_asia.geojson'),
    os.path.join(BASE, 'data', 'map', 'admin1_eur_amer.geojson'),
]
OUTPUT = os.path.join(BASE, 'data', 'regions_world.json')

FIELDS = ['name_en', 'name_zh', 'latitude', 'longitude', 'iso_a2', 'admin']
SHORT_KEYS = ['en', 'zh', 'la', 'lo', 'cc', 'ad']


def main():
    regions = []
    seen = set()

    for src in SOURCES:
        print(f'读取: {os.path.basename(src)} ({os.path.getsize(src)/1024:.0f}KB)')
        with open(src, encoding='utf-8') as f:
            data = json.load(f)

        for feat in data['features']:
            props = feat['properties']
            en = (props.get('name_en') or '').strip()
            zh = (props.get('name_zh') or props.get('name') or '').strip()
            lat = props.get('latitude')
            lng = props.get('longitude')
            iso = (props.get('iso_a2') or '').strip().upper()
            admin_name = (props.get('admin') or '').strip()

            if not en and not zh:
                continue
            if lat is None or lng is None:
                continue

            # 去重：英文名+国家码
            key = f'{en}|{iso}'
            if key in seen:
                continue
            seen.add(key)

            regions.append({
                'en': en,
                'zh': zh,
                'la': float(lat),
                'lo': float(lng),
                'cc': iso,
                'ad': admin_name,
            })

    regions.sort(key=lambda r: r.get('en', '').lower())

    with open(OUTPUT, 'w', encoding='utf-8') as f:
        json.dump(regions, f, ensure_ascii=False)

    size_kb = os.path.getsize(OUTPUT) / 1024
    print(f'输出: {os.path.basename(OUTPUT)} — {len(regions)} 条, {size_kb:.0f}KB')

    # 抽样
    for r in regions[:5]:
        print(f'  [{r["cc"]}] {r["en"]} / {r["zh"]} ({r["la"]:.2f}, {r["lo"]:.2f})')
    print('  ...')
    # 检查几个知名地区
    check_names = {'Tokyo', 'California', 'Paris', 'London'}
    for r in regions:
        if r['en'] in check_names:
            print(f'  ✓ {r["en"]}: {r["zh"]} ({r["la"]}, {r["lo"]})')


if __name__ == '__main__':
    main()
