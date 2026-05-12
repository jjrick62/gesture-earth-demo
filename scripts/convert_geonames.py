"""从 GeoNames cities5000.txt 提取人口前 5000 城市，输出精简 JSON。
短键名：en(英文名), zh(中文名/音译-留空后续补), la(纬度), lo(经度), cc(ISO国家码), ad(所属国), pop(人口)
"""
import json
import os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INPUT = os.path.join(BASE, 'data', 'cities5000.txt')
OUTPUT = os.path.join(BASE, 'data', 'cities_world.json')
MAX_CITIES = 5000


def main():
    cities = []

    with open(INPUT, encoding='utf-8') as f:
        for i, line in enumerate(f):
            if i >= MAX_CITIES:
                break
            fields = line.strip().split('\t')
            if len(fields) < 16:
                continue

            geonameid = fields[0]
            name = fields[1]          # 本地名（可能含非ASCII）
            asciiname = fields[2]     # ASCII 英文名
            lat = fields[4]
            lng = fields[5]
            country_code = fields[8]
            country_name = ''         # cities5000 不含国家名，从 cc 映射
            population = fields[14]

            if not asciiname or not lat or not lng:
                continue

            cities.append({
                'en': asciiname.strip(),
                'zh': '',  # 国际城市中文名留空，后续可补
                'la': float(lat),
                'lo': float(lng),
                'cc': country_code.strip().upper(),
                'ad': '',  # 国家名后续从 regions_world 映射
                'pop': int(population) if population else 0,
            })

    # 按人口降序排列
    cities.sort(key=lambda c: c.get('pop', 0), reverse=True)

    with open(OUTPUT, 'w', encoding='utf-8') as f:
        json.dump(cities, f, ensure_ascii=False)

    size_kb = os.path.getsize(OUTPUT) / 1024
    print(f'输出: {os.path.basename(OUTPUT)} — {len(cities)} 条, {size_kb:.0f}KB')

    for c in cities[:10]:
        zh_hint = f' / {c["zh"]}' if c['zh'] else ''
        print(f'  [{c["cc"]}] {c["en"]}{zh_hint} (pop={c["pop"]}) ({c["la"]:.2f}, {c["lo"]:.2f})')

    # 验证几个知名城市
    check = {'London', 'New York', 'Tokyo', 'Paris', 'Berlin', 'Moscow', 'Sydney', 'Dubai', 'Singapore'}
    found = set()
    for c in cities:
        if c['en'] in check:
            print(f'  ✓ {c["en"]}: [{c["cc"]}] pop={c["pop"]} ({c["la"]}, {c["lo"]})')
            found.add(c['en'])
    if check - found:
        print(f'  未找到: {check - found}')


if __name__ == '__main__':
    main()
