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
img=Image.new('RGBA',(W,H),(19,22,42,255))
ov=Image.new('RGBA',(W,H),(0,0,0,0)); od=ImageDraw.Draw(ov)
for i in range(-10,30): od.line([(i*70,0),(i*70+300,H)],fill=(255,255,255,18),width=22)
img=Image.alpha_composite(img,ov); d=ImageDraw.Draw(img,'RGBA')
for k in range(60):
    d.rectangle([k*20,0,k*20+20,14],fill=(255,255,255) if k%2 else (10,10,10)); d.rectangle([k*20,14,k*20+20,28],fill=(10,10,10) if k%2 else (255,255,255))
pts=[(760,470),(1000,500),(1130,380),(1050,230),(880,180),(780,300),(620,250),(560,400)]
pts=[(930+(x-860)*0.8,335+(y-340)*0.85) for x,y in pts]
poly=catmull(pts,60)
def brush(points,r,col):
    for (x,y) in points: d.ellipse([x-r,y-r,x+r,y+r],fill=col)
brush([(x+8,y+10) for x,y in poly],62,(0,0,0,90))
brush(poly,62,(60,60,66,255)); brush(poly,54,(75,75,83,255))
n=len(poly)
def offset(o):
    out=[]
    for i in range(n):
        ax,ay=poly[(i-1)%n]; bx,by=poly[(i+1)%n]; L=math.hypot(bx-ax,by-ay) or 1
        nx,ny=-(by-ay)/L,(bx-ax)/L; x,y=poly[i]; out.append((x+nx*o,y+ny*o))
    return out
for side in (-1,1):
    brush(offset(side*50),2,(244,244,244,255))
    e=offset(side*44)
    for i in range(0,n,9): brush(e[i:i+5],5,(216,49,47,255) if (i//9)%2 else (246,246,246,255))
for o in (-30,-10,10,30): brush(offset(o),1,(0,0,0,120))
car(d,962,446,-0.5,(255,45,45,255)); car(d,850,344,-1.25,(45,140,255,255)); car(d,1090,258,-2.4,(255,214,0,255))
f1=font(120); f2=font(40); f3=font(30)
t='RACISM 2'
bb=d.textbbox((0,0),t,font=f1,anchor='la'); tw,th=bb[2]-bb[0],bb[3]-bb[1]
d.text((76,156),t,font=f1,fill=(0,0,0,170),anchor='la')
grad=Image.new('RGBA',(tw+4,th+4)); gd=ImageDraw.Draw(grad)
for y in range(th+4):
    r=y/(th+4); col=(255,255,int(255-r*2*255)) if r<0.5 else (255,int(255-(r-0.5)*2*150),0)
    gd.line([(0,y),(grad.width,y)],fill=col+(255,))
mask=Image.new('L',grad.size,0); ImageDraw.Draw(mask).text((-bb[0],-bb[1]),t,font=f1,fill=255,anchor='la')
img.paste(grad,(70,150),mask); d=ImageDraw.Draw(img,'RGBA')
d.text((74,300),'SUPER SLOT RACING',font=f2,fill=(155,231,255,255))
d.text((74,360),'5 circuiti • turbo • motore da supercar',font=f3,fill=(255,255,255,235))
d.text((74,402),'avversari IA • gioca gratis nel browser',font=f3,fill=(255,255,255,235))
d.rounded_rectangle([70,470,470,540],radius=24,fill=(93,255,122,255))
d.text((270,505),'GIOCA GRATIS',font=f2,fill=(7,59,22,255),anchor='mm')
d.text((74,575),'pippopoppi.github.io/racism2  —  Pippo Poppi Games',font=font(24),fill=(255,255,255,180))
img.convert('RGB').save(os.path.join(OUT,'og.png'),optimize=True)
# icon 180
ic=Image.new('RGBA',(180,180),(19,22,42,255)); dd=ImageDraw.Draw(ic,'RGBA')
ipts=[(40,120),(70,50),(120,45),(150,80),(130,130),(80,150)]
ip=catmull(ipts,30)
for (x,y) in ip: dd.ellipse([x-16,y-16,x+16,y+16],fill=(75,75,83,255))
for (x,y) in ip: dd.ellipse([x-13,y-13,x+13,y+13],fill=(75,75,83,255))
car(dd,112,70,-0.6,(255,45,45,255),L=56,W=26)
dd.text((90,160),'R2',font=font(26),fill=(255,214,0,255),anchor='mm')
ic.convert('RGB').save(os.path.join(OUT,'icon-180.png'),optimize=True)
print('ok')
