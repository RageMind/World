from pathlib import Path
from PIL import Image, ImageDraw
import json

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'cozy' / 'assets' / 'full_png'
OUT.mkdir(parents=True, exist_ok=True)

def c(h,a=255):
    h=h.lstrip('#')
    return tuple(int(h[i:i+2],16) for i in (0,2,4))+(a,)

def shadow(d,cx,cy,rx,ry,a=45):
    d.ellipse((cx-rx,cy-ry,cx+rx,cy+ry),fill=(0,0,0,a))

def tile(name,base,hi,lo,kind='grass'):
    im=Image.new('RGBA',(128,80),(0,0,0,0)); d=ImageDraw.Draw(im)
    pts=[(64,8),(120,38),(64,70),(8,38)]
    d.polygon(pts,fill=c(base))
    d.polygon([(64,8),(120,38),(64,50),(8,38)],fill=c(hi,90))
    d.polygon([(8,38),(64,70),(64,50)],fill=c(lo,85))
    d.line(pts+[pts[0]],fill=c('#2c4f2b' if kind!='water' else '#317f92',75),width=2)
    if kind=='water':
        d.arc((22,20,58,42),15,165,fill=c('#ffffff',120),width=3)
        d.arc((70,34,104,54),190,340,fill=c('#ffffff',110),width=3)
        d.ellipse((57,21,67,27),fill=c('#aeeaf0',90))
    elif kind=='shore':
        for x,y in [(40,35),(76,42),(58,28)]: d.rectangle((x,y,x+9,y+2),fill=c('#ffe5a2',80))
    else:
        for x,y in [(35,34),(55,28),(78,44),(69,35)]: d.ellipse((x,y,x+8,y+4),fill=c('#96c761',90))
    im.save(OUT/name)

def tree(name):
    im=Image.new('RGBA',(96,118),(0,0,0,0)); d=ImageDraw.Draw(im)
    shadow(d,48,104,26,7,50)
    d.rectangle((43,63,53,104),fill=c('#7a4a2b'))
    d.ellipse((16,35,58,83),fill=c('#2f652c'))
    d.ellipse((38,32,82,82),fill=c('#3d7835'))
    d.ellipse((24,14,72,66),fill=c('#4f8b3e'))
    d.ellipse((34,8,64,36),fill=c('#75aa55',180))
    im.save(OUT/name)

def bush(name):
    im=Image.new('RGBA',(64,52),(0,0,0,0)); d=ImageDraw.Draw(im)
    shadow(d,32,43,19,5,38)
    d.ellipse((12,17,52,44),fill=c('#3f7732'))
    d.ellipse((19,10,42,30),fill=c('#6aa34b'))
    d.ellipse((14,24,25,35),fill=c('#cf5d4d'))
    d.ellipse((42,25,50,33),fill=c('#cf5d4d'))
    im.save(OUT/name)

def rock(name):
    im=Image.new('RGBA',(54,42),(0,0,0,0)); d=ImageDraw.Draw(im)
    shadow(d,27,34,18,5,45)
    d.ellipse((8,10,45,34),fill=c('#66665f'))
    d.ellipse((14,8,30,20),fill=c('#999078'))
    d.ellipse((31,17,41,25),fill=c('#817d70'))
    im.save(OUT/name)

def house(name,wall,roof):
    im=Image.new('RGBA',(150,140),(0,0,0,0)); d=ImageDraw.Draw(im)
    shadow(d,76,124,42,11,58)
    d.rectangle((46,58,112,118),fill=c('#6f4326'))
    d.rectangle((53,56,116,116),fill=c(wall))
    d.rectangle((59,64,110,111),outline=c('#efbd70'),width=2)
    d.polygon([(40,62),(75,27),(124,62)],fill=c('#55271c'))
    d.polygon([(50,59),(75,35),(115,59)],fill=c(roof))
    d.polygon([(75,35),(124,62),(115,59)],fill=c('#a5502a'))
    d.rectangle((72,88,92,118),fill=c('#3b241c'))
    for x in (60,99): d.rectangle((x,72,x+12,86),fill=c('#ffdf92'))
    im.save(OUT/name)

def campfire():
    im=Image.new('RGBA',(88,88),(0,0,0,0)); d=ImageDraw.Draw(im)
    shadow(d,44,70,28,9,45)
    d.line((22,66,68,52),fill=c('#6e3f24'),width=8)
    d.line((22,52,68,67),fill=c('#7b4a2a'),width=8)
    d.polygon([(44,16),(63,60),(31,60)],fill=c('#ee5b26'))
    d.polygon([(47,7),(57,57),(37,57)],fill=c('#ffc84d'))
    d.polygon([(44,31),(53,60),(38,60)],fill=c('#fff0a0'))
    im.save(OUT/'campfire.png')

def person(name,shirt,hair,skin):
    im=Image.new('RGBA',(64,84),(0,0,0,0)); d=ImageDraw.Draw(im)
    shadow(d,32,76,12,4,40)
    d.rounded_rectangle((23,52,29,74),radius=2,fill=c('#2d241f'))
    d.rounded_rectangle((35,52,41,74),radius=2,fill=c('#2d241f'))
    d.rectangle((21,73,31,78),fill=c('#1d1714'))
    d.rectangle((33,73,43,78),fill=c('#1d1714'))
    d.rounded_rectangle((20,32,44,56),radius=4,fill=c(shirt))
    d.rectangle((18,36,22,52),fill=c(skin)); d.rectangle((42,36,46,52),fill=c(skin))
    d.rounded_rectangle((21,13,43,34),radius=5,fill=c(skin))
    d.pieslice((20,6,44,28),180,360,fill=c(hair))
    d.rectangle((20,16,26,24),fill=c(hair)); d.rectangle((39,16,44,23),fill=c(hair))
    d.rectangle((28,23,30,25),fill=c('#1d1714')); d.rectangle((36,23,38,25),fill=c('#1d1714'))
    im.save(OUT/name)

tile('tile_grass.png','#70ad45','#7fc857','#5a8d38')
tile('tile_flower.png','#74b14b','#84c95a','#5d913b')
tile('tile_bush.png','#669d3f','#78b94d','#568438')
tile('tile_shore.png','#cfaa63','#e0bf78','#b98944','shore')
tile('tile_water.png','#5fb7cb','#9ee3eb','#4198aa','water')
tree('tree_01.png'); tree('tree_02.png')
bush('bush_01.png'); rock('rock_01.png'); rock('pebble_01.png')
house('house_01.png','#ca8c48','#8e4325'); house('house_02.png','#d59b4e','#703421')
campfire()
people=[('person_01.png','#a75a39','#2d1a15','#d99a67'),('person_02.png','#d7bd69','#3a2419','#e1ad77'),('person_03.png','#ead9b2','#6b3e23','#dfa575'),('person_04.png','#3d3933','#241713','#d89d6f'),('person_05.png','#c1843f','#1d1410','#dba36e'),('person_06.png','#95513d','#4a2a1d','#e1a876')]
for p in people: person(*p)
manifest={'tiles':{'grass':['tile_grass.png','tile_flower.png','tile_bush.png'],'shore':['tile_shore.png'],'water':['tile_water.png']},'objects':{'trees':['tree_01.png','tree_02.png'],'bushes':['bush_01.png'],'rocks':['rock_01.png'],'pebbles':['pebble_01.png'],'houses':['house_01.png','house_02.png'],'campfires':['campfire.png'],'people':[p[0] for p in people]}}
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
print('Created full PNG asset pack:', OUT)
