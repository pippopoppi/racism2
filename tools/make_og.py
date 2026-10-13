#!/usr/bin/env python3
"""Render og.png (1200x630) and icon-180.png for Racism 2 with Pillow only."""
import math, os
from PIL import Image, ImageDraw, ImageFont
HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, '..')
def font(sz):
    for p in ['/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf']:
        if os.path.exists(p): return ImageFont.truetype(p, sz)
    return ImageFont.load_default()
def catmull(pts, segs=40):
    out=[]; n=len(pts)
    for i in range(n):
        p0,p1,p2,p3=pts[(i-1)%n],pts[i],pts[(i+1)%n],pts[(i+2)%n]
        for j in range(segs):
            t=j/segs; t2=t*t; t3=t2*t
            x=0.5*((2*p1[0])+(-p0[0]+p2[0])*t+(2*p0[0]-5*p1[0]+4*p2[0]-p3[0])*t2+(-p0[0]+3*p1[0]-3*p2[0]+p3[0])*t3)
            y=0.5*((2*p1[1])+(-p0[1]+p2[1])*t+(2*p0[1]-5*p1[1]+4*p2[1]-p3[1])*t2+(-p0[1]+3*p1[1]-3*p2[1]+p3[1])*t3)
            out.append((x,y))
    return out
def car(d, x, y, ang, col, L=120, W=56):
    c,s=math.cos(ang),math.sin(ang)
    def P(px,py): return (x+px*c-py*s, y+px*s+py*c)
    d.polygon([P(-L/2+6,-W/2+8),P(L/2+6,-W/2+8),P(L/2+6,W/2+8),P(-L/2+6,W/2+8)], fill=(0,0,0,110))
    for wx,wy in [(L*0.3,-W/2-2),(L*0.3,W/2-12),(-L*0.32,-W/2-2),(-L*0.32,W/2-12)]:
        d.polygon([P(wx-14,wy),P(wx+14,wy),P(wx+14,wy+14),P(wx-14,wy+14)], fill=(20,20,20,255))
    d.polygon([P(-L/2,-W/2),P(L/2-10,-W/2),P(L/2,0),P(L/2-10,W/2),P(-L/2,W/2)], fill=col)
    d.polygon([P(-L/2-8,-W/2-6),P(-L/2+4,-W/2-6),P(-L/2+4,W/2+6),P(-L/2-8,W/2+6)], fill=(21,23,28,255))
    d.polygon([P(-12,-W/2+10),P(28,-W/2+10),P(28,W/2-10),P(-12,W/2-10)], fill=(27,34,48,255))
    d.polygon([P(-L/2+4,-5),P(L/2-14,-5),P(L/2-14,5),P(-L/2+4,5)], fill=(255,255,255,220))
    d.polygon([P(L/2-10,-W/2+6),P(L/2-2,-W/2+6),P(L/2-2,-W/2+16),P(L/2-10,-W/2+16)], fill=(255,247,194,255))
    d.polygon([P(L/2-10,W/2-16),P(L/2-2,W/2-16),P(L/2-2,W/2-6),P(L/2-10,W/2-6)], fill=(255,247,194,255))
W,H=1200,630
img=Image.new('RGBA',(W,H),(19,22,42,255)); d=ImageDraw.Draw(img,'RGBA')
for i in range(-10,30): d.line([(i*70,0),(i*70+300,H)],fill=(255,255,255,14),width=22)
for k in range(60):
    d.rectangle([k*20,0,k*20+20,14],fill=(255,255,255) if k%2 else (10,10,10)); d.rectangle([k*20,14,k*20+20,28],fill=(10,10,10) if k%2 else (255,255,255))
pts=[(760,470),(1000,500),(1130,380),(1050,230),(880,180),(780,300),(620,250),(560,400)]
poly=catmull(pts)
d.line(poly+[poly[0]],fill=(0,0,0,120),width=130,joint='curve')
d.line(poly+[poly[0]],fill=(75,75,83,255),width=110,joint='curve')
d.line(poly+[poly[0]],fill=(244,244,244,255),width=4,joint='curve')
for off in (-30,-10,10,30):
    pass
# kerbs: dashes
for i in range(0,len(poly),16):
    x,y=poly[i]; d.ellipse([x-50-4,y-4,x-50+4,y+4],fill=(216,49,47) if (i//16)%2 else (246,246,246))
car(d,900,470,-0.5,(255,45,45,255)); car(d,760,350,-1.25,(45,140,255,255)); car(d,1060,250,-2.4,(255,214,0,255))
# title
f1=font(120); f2=font(40); f3=font(30)
t='RACISM 2'
for dx,dy in [(6,6)]: d.text((70+dx,150+dy),t,font=f1,fill=(0,0,0,170))
tw=d.textlength(t,font=f1)
grad=Image.new('RGBA',(int(tw)+20,140)); gd=ImageDraw.Draw(grad)
for y in range(140):
    r=y/140; col=(255,int(255-r*50),int(255-r*255)) if r<0.5 else (255,int(214-(r-0.5)*2*108),0)
    gd.line([(0,y),(grad.width,y)],fill=col+(255,))
mask=Image.new('L',grad.size,0); ImageDraw.Draw(mask).text((0,-20),t,font=f1,fill=255)
img.paste(grad,(70,150),mask)
d.text((74,290),'SUPER SLOT RACING',font=f2,fill=(155,231,255,255))
d.text((74,350),'5 circuiti • turbo • motore da supercar',font=f3,fill=(255,255,255,230))
d.text((74,392),'avversari IA • gioca gratis nel browser',font=f3,fill=(255,255,255,230))
d.rounded_rectangle([70,470,470,540],radius=24,fill=(93,255,122,255))
d.text((270,505),'GIOCA GRATIS',font=f2,fill=(7,59,22,255),anchor='mm')
d.text((74,575),'pippopoppi.github.io/racism2  —  Pippo Poppi Games',font=font(24),fill=(255,255,255,170))
img.convert('RGB').save(os.path.join(OUT,'og.png'),optimize=True)
# icon 180
ic=Image.new('RGBA',(180,180),(19,22,42,255)); dd=ImageDraw.Draw(ic,'RGBA')
ipts=[(40,120),(70,50),(120,45),(150,80),(130,130),(80,150)]
ip=catmull(ipts,30); dd.line(ip+[ip[0]],fill=(75,75,83,255),width=30,joint='curve'); dd.line(ip+[ip[0]],fill=(244,244,244,255),width=2,joint='curve')
car(dd,112,70,-0.6,(255,45,45,255),L=56,W=26)
dd.text((90,160),'R2',font=font(26),fill=(255,214,0,255),anchor='mm')
ic.convert('RGB').save(os.path.join(OUT,'icon-180.png'),optimize=True)
print('ok')
