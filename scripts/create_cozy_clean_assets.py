from pathlib import Path
from PIL import Image, ImageDraw
import json

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'cozy' / 'assets' / 'cozy_clean'
OUT.mkdir(parents=True, exist_ok=True)

def hx(c, a=255):
    c = c.lstrip('#')
    return tuple(int(c[i:i+2], 16) for i in (0,2,4)) + (a,)

def shadow(d, cx, cy, rx, ry, a=60):
    d.ellipse((cx-rx, cy-ry, cx+rx, cy+ry), fill=(0,0,0,a))

def house(name, wall, roof):
    im = Image.new('RGBA', (150, 140), (0,0,0,0)); d = ImageDraw.Draw(im)
    shadow(d, 76, 124, 42, 11)
    d.rectangle((46,58,112,118), fill=hx('#6f4326'))
    d.rectangle((53,56,116,116), fill=hx(wall))
    d.rectangle((59,64,110,111), outline=hx('#efbd70'), width=2)
    d.polygon([(40,62),(75,27),(124,62)], fill=hx('#55271c'))
    d.polygon([(50,59),(75,35),(115,59)], fill=hx(roof))
    d.polygon([(75,35),(124,62),(115,59)], fill=hx('#a5502a'))
    d.line((58,57,76,39,106,57), fill=hx('#de8a3e'), width=3)
    d.rectangle((72,88,92,118), fill=hx('#3b241c'))
    d.rectangle((76,91,88,118), fill=hx('#55301f'))
    d.ellipse((87,104,90,107), fill=hx('#e7c26d'))
    for x in (60,99):
        d.rectangle((x,72,x+12,86), fill=hx('#ffdf92'))
        d.rectangle((x+2,74,x+10,84), fill=hx('#f0c875'))
    im.save(OUT/name)

def campfire():
    im=Image.new('RGBA',(88,88),(0,0,0,0)); d=ImageDraw.Draw(im)
    shadow(d,44,70,28,9)
    d.line((22,66,68,52), fill=hx('#6e3f24'), width=8)
    d.line((22,52,68,67), fill=hx('#7b4a2a'), width=8)
    d.polygon([(44,16),(63,60),(31,60)], fill=hx('#ee5b26'))
    d.polygon([(47,7),(57,57),(37,57)], fill=hx('#ffc84d'))
    d.polygon([(44,31),(53,60),(38,60)], fill=hx('#fff0a0'))
    im.save(OUT/'campfire.png')

def person(name, shirt, hair, skin):
    im=Image.new('RGBA',(64,84),(0,0,0,0)); d=ImageDraw.Draw(im)
    shadow(d,32,76,12,4,45)
    # legs smaller / softer
    d.rounded_rectangle((23,52,29,74), radius=2, fill=hx('#2d241f'))
    d.rounded_rectangle((35,52,41,74), radius=2, fill=hx('#2d241f'))
    d.rectangle((21,73,31,78), fill=hx('#1d1714'))
    d.rectangle((33,73,43,78), fill=hx('#1d1714'))
    # body
    d.rounded_rectangle((20,32,44,56), radius=4, fill=hx(shirt))
    d.rectangle((18,36,22,52), fill=hx(skin))
    d.rectangle((42,36,46,52), fill=hx(skin))
    # head, less blocky
    d.rounded_rectangle((21,13,43,34), radius=5, fill=hx(skin))
    d.pieslice((20,6,44,28), 180, 360, fill=hx(hair))
    d.rectangle((20,16,26,24), fill=hx(hair))
    d.rectangle((39,16,44,23), fill=hx(hair))
    d.rectangle((28,23,30,25), fill=hx('#1d1714'))
    d.rectangle((36,23,38,25), fill=hx('#1d1714'))
    d.rectangle((31,29,36,31), fill=hx('#9a5c4c'))
    im.save(OUT/name)

house('house_01.png','#ca8c48','#8e4325')
house('house_02.png','#d59b4e','#703421')
campfire()
for args in [
    ('person_01.png','#a75a39','#2d1a15','#d99a67'),
    ('person_02.png','#d7bd69','#3a2419','#e1ad77'),
    ('person_03.png','#ead9b2','#6b3e23','#dfa575'),
    ('person_04.png','#3d3933','#241713','#d89d6f'),
    ('person_05.png','#c1843f','#1d1410','#dba36e'),
    ('person_06.png','#95513d','#4a2a1d','#e1a876'),
]: person(*args)
manifest={'houses':['house_01.png','house_02.png'],'campfires':['campfire.png'],'people':[f'person_{i:02d}.png' for i in range(1,7)]}
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
print('Created', OUT)
