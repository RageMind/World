from pathlib import Path
from PIL import Image, ImageDraw
import json

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'cozy' / 'assets' / 'cozy_core'
OUT.mkdir(parents=True, exist_ok=True)


def rgba(hex_color, a=255):
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4)) + (a,)


def shadow(draw, cx, cy, rx, ry):
    draw.ellipse((cx-rx, cy-ry, cx+rx, cy+ry), fill=(0, 0, 0, 55))


def save_house(name, wall='#c88a46', roof='#7a3723'):
    im = Image.new('RGBA', (160, 150), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    shadow(d, 80, 132, 48, 12)
    # back wall side
    d.polygon([(48, 58), (86, 75), (86, 125), (48, 110)], fill=rgba('#8a542f'))
    # front wall
    d.rectangle((58, 63, 122, 126), fill=rgba(wall))
    d.rectangle((64, 70, 116, 120), outline=rgba('#e8b96d'), width=2)
    # roof
    d.polygon([(44, 64), (80, 28), (126, 64)], fill=rgba('#5d2a1d'))
    d.polygon([(52, 62), (80, 36), (116, 62)], fill=rgba(roof))
    d.polygon([(80, 36), (126, 64), (116, 62)], fill=rgba('#a64d27'))
    # highlights roof
    d.line((62, 59, 82, 40, 105, 59), fill=rgba('#d9853d'), width=3)
    # door
    d.rectangle((75, 93, 94, 126), fill=rgba('#4a2c20'))
    d.rectangle((79, 96, 91, 126), fill=rgba('#5a3422'))
    d.ellipse((89, 110, 92, 113), fill=rgba('#e8c46e'))
    # windows
    for x in (63, 101):
        d.rectangle((x, 77, x+14, 92), fill=rgba('#ffe2a0'))
        d.rectangle((x+2, 79, x+12, 90), fill=rgba('#f0c875'))
        d.line((x+7, 78, x+7, 91), fill=rgba('#8a542f'), width=1)
    # trim
    d.rectangle((56, 124, 124, 130), fill=rgba('#6f4126'))
    im.save(OUT / name)


def save_campfire():
    im = Image.new('RGBA', (96, 96), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    shadow(d, 48, 75, 30, 10)
    d.line((23, 70, 73, 54), fill=rgba('#6e3f24'), width=8)
    d.line((25, 55, 75, 72), fill=rgba('#7b4a2a'), width=8)
    d.polygon([(46, 18), (64, 62), (34, 62)], fill=rgba('#ef5c25'))
    d.polygon([(50, 8), (59, 58), (39, 58)], fill=rgba('#ffcb50'))
    d.polygon([(47, 32), (55, 61), (41, 61)], fill=rgba('#fff09b'))
    im.save(OUT / 'campfire.png')


def save_person(name, shirt='#b76b3b', hair='#3a2019', pants='#33261f', skin='#dca06a'):
    im = Image.new('RGBA', (72, 96), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    shadow(d, 36, 84, 15, 5)
    # legs
    d.rectangle((26, 58, 32, 83), fill=rgba(pants))
    d.rectangle((40, 58, 46, 83), fill=rgba(pants))
    d.rectangle((23, 82, 33, 88), fill=rgba('#211713'))
    d.rectangle((39, 82, 49, 88), fill=rgba('#211713'))
    # body
    d.rectangle((22, 35, 50, 62), fill=rgba(shirt))
    d.rectangle((25, 38, 47, 59), fill=rgba(shirt))
    d.rectangle((20, 40, 25, 58), fill=rgba(skin))
    d.rectangle((47, 40, 52, 58), fill=rgba(skin))
    # head
    d.rectangle((23, 15, 49, 37), fill=rgba(skin))
    d.rectangle((21, 10, 51, 20), fill=rgba(hair))
    d.rectangle((21, 18, 27, 26), fill=rgba(hair))
    d.rectangle((45, 18, 51, 25), fill=rgba(hair))
    # face
    d.rectangle((30, 25, 33, 28), fill=rgba('#1e1714'))
    d.rectangle((41, 25, 44, 28), fill=rgba('#1e1714'))
    d.rectangle((35, 32, 40, 34), fill=rgba('#a45d48'))
    # tiny highlight
    d.rectangle((25, 16, 35, 18), fill=rgba('#e6b885', 120))
    im.save(OUT / name)


save_house('house_01.png', '#c88a46', '#9b4d26')
save_house('house_02.png', '#d59b4e', '#7d3922')
save_campfire()
people = [
    ('person_01.png', '#a75637', '#2d1a15', '#2e2a24', '#d99a67'),
    ('person_02.png', '#d6bd65', '#3b2418', '#3a2a24', '#e3ad72'),
    ('person_03.png', '#f0dfb4', '#6b3e23', '#2c2b28', '#e0aa78'),
    ('person_04.png', '#3f3c36', '#241713', '#222222', '#d89d6f'),
    ('person_05.png', '#c1843f', '#1d1410', '#3a2720', '#dba36e'),
    ('person_06.png', '#8f4f37', '#4a2a1d', '#29211e', '#e1a876'),
]
for args in people:
    save_person(*args)

manifest = {
    'houses': ['house_01.png', 'house_02.png'],
    'campfires': ['campfire.png'],
    'people': [p[0] for p in people]
}
(OUT / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
(OUT / 'README.txt').write_text('Cozy core PNG assets generated locally for YourWill prototype. Use as temporary in-repo game assets until final art pack is chosen.\n', encoding='utf-8')
print('Created cozy core assets in', OUT)
