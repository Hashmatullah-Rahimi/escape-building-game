(function(){
'use strict';
var W=960,H=540;
var $=function(s){return document.querySelector(s)};
var cv=$('#cv'),ctx=cv.getContext('2d');
cv.width=W;cv.height=H;

var lerp=function(a,b,u){return a+(b-a)*u};
var clamp=function(v,a,b){return Math.max(a,Math.min(b,v))};
var esc=function(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})};
function shuffle(a){a=a.slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=a[i];a[i]=a[j];a[j]=t}return a}

/* ---------- Game data ---------- */
var FLOORS={
  1:{tag:'FIRE',rule:'Fall in the fire: stay on floor 1. The safe pit moves after every fall.',
     code:'# FLOOR 1 · FIND YOUR WAY\npits = ["A", "B", "C"]\nsafe = random.choice(pits)   # changes after every fall\njump(choice)                 # press 1, 2 or 3'},
  2:{tag:'BRIDGE',rule:'Fall off the bridge: you restart on floor 1.',
     code:'# FLOOR 2 · THE BRIDGE\nwhile player.on_bridge:\n    if gap_ahead():\n        jump()           # fall = back to floor 1\n    step_right()'},
  3:{tag:'MAZE',rule:'Walls cannot be crossed. Dead end? Turn back and pick another way.',
     code:'# FLOOR 3 · FIND THE RIGHT PATH\nmaze = build_maze(12, 6)\npath = find_exit(maze)       # no jumping over walls\n# dead end? turn around and try another way'},
  4:{tag:'QUIZ',rule:'4 right answers pass. 2 wrong answers drop you to floor 3.',
     code:'# FLOOR 4 · FIVE QUESTIONS\nscore = sum(answer(q) for q in questions)\nif score >= 4:\n    next_floor()\nelif wrong == 2:\n    floor -= 1'},
  5:{tag:'DOOR',rule:'You have 2:00 to build the door. Out of time: back to floor 1.',
     code:'# FLOOR 5 · BUILD THE DOOR\ntime_limit = 120             # seconds\ndoor = build(code_pieces)\nif door.runs():\n    helicopter.board()\nelse:\n    floor = 1'}
};
var LOSE_TO={1:1,2:1,3:2,4:3,5:1};
var G={floor:1,scene:null,timer:null,paused:false,tries:{1:0,2:0,3:0,4:0,5:0},f1safe:Math.floor(Math.random()*3)};
var keys={};

/* ---------- Modal ---------- */
function modal(o,cb){
  $('#mTitle').textContent=o.title;
  $('#mText').textContent=o.text;
  var b=$('#mBtn');b.textContent=o.button||'Continue';
  $('#modal').dataset.kind=o.kind||'info';
  $('#modal').hidden=false;G.paused=true;
  for(var k in keys)keys[k]=false;
  b.onclick=function(){$('#modal').hidden=true;G.paused=false;if(cb)cb()};
  setTimeout(function(){b.focus()},30);
}

/* ---------- Tower ---------- */
function buildTower(){
  var t=$('#tower');t.innerHTML='';
  for(var n=5;n>=1;n--){
    var d=document.createElement('div');d.className='fl';d.id='fl'+n;
    d.innerHTML='<b>'+n+'</b><span>'+FLOORS[n].tag+'</span>';
    t.appendChild(d);
  }
}
function updateTower(){
  for(var n=1;n<=5;n++){
    var el=$('#fl'+n);
    el.classList.toggle('cur',n===G.floor);
    el.classList.toggle('done',n<G.floor);
  }
}

/* ---------- Flow ---------- */
function winFloor(n){
  var msgs={
    1:'You found the cold flame. The stairs to floor 2 are open.',
    2:'You crossed the bridge. Stairs up to floor 3.',
    3:'You found the way out of the maze. Stairs up to floor 4.',
    4:'Four right answers. The lock clicks open. Stairs up to the last floor.'
  };
  modal({title:'FLOOR '+n+' CLEARED',text:msgs[n],kind:'win',button:'Go up to floor '+(n+1)},function(){startFloor(n+1)});
}
function loseFloor(n,why){
  var d=LOSE_TO[n],txt;
  if(d===n)txt=why+' Try floor 1 again.';
  else if(n===5)txt=why+' The helicopter leaves without you. You fall all the way back to floor 1.';
  else txt=why+' You go back down to floor '+d+'.';
  modal({title:'YOU LOST',text:txt,kind:'lose',button:d===n?'Try again':'Go to floor '+d},function(){startFloor(d)});
}
function startFloor(n){
  if(G.timer){clearInterval(G.timer);G.timer=null}
  G.floor=n;G.scene=null;G.paused=false;
  for(var k in keys)keys[k]=false;
  updateTower();
  $('#mission').textContent=FLOORS[n].code;
  $('#rule').textContent=FLOORS[n].rule;
  setControls(n);
  var showStage=n<=3;
  $('#stage').hidden=!showStage;
  $('#panel').hidden=showStage;
  if(n===1)G.scene=Floor1();
  else if(n===2)G.scene=Floor2();
  else if(n===3)G.scene=Floor3();
  else if(n===4)startQuiz();
  else startBuild();
}
function startEnding(){
  if(G.timer){clearInterval(G.timer);G.timer=null}
  G.floor=6;G.paused=false;updateTower();
  $('#stage').hidden=false;$('#panel').hidden=true;
  $('#controls').innerHTML='';
  $('#mission').textContent='# THE ROOF\nhelicopter.board(player)\nprint("FREE")';
  $('#rule').textContent='You made it to the top.';
  G.scene=Ending();
}

/* ---------- Controls ---------- */
function holdBtn(label,code){return '<button class="hb" type="button" data-k="'+code+'">'+label+'</button>'}
function setControls(n){
  var c=$('#controls'),h='';
  if(n===1){
    h='<button class="hb" type="button" data-pick="0">JUMP A · 1</button><button class="hb" type="button" data-pick="1">JUMP B · 2</button><button class="hb" type="button" data-pick="2">JUMP C · 3</button>';
  }else if(n===2){
    h=holdBtn('◀ LEFT','ArrowLeft')+holdBtn('RIGHT ▶','ArrowRight')+'<span class="sp"></span>'+holdBtn('JUMP ▲','ArrowUp');
  }else if(n===3){
    h=holdBtn('◀','ArrowLeft')+holdBtn('▲','ArrowUp')+holdBtn('▼','ArrowDown')+holdBtn('▶','ArrowRight')+'<span class="sp"></span><button class="hb" type="button" data-act="reset">BACK TO START</button>';
  }
  c.innerHTML=h;
  var i,els=c.querySelectorAll('[data-k]');
  for(i=0;i<els.length;i++)(function(el){
    var code=el.getAttribute('data-k');
    el.addEventListener('pointerdown',function(e){e.preventDefault();keys[code]=true});
    ['pointerup','pointerleave','pointercancel'].forEach(function(ev){el.addEventListener(ev,function(){keys[code]=false})});
    el.addEventListener('contextmenu',function(e){e.preventDefault()});
  })(els[i]);
  els=c.querySelectorAll('[data-pick]');
  for(i=0;i<els.length;i++)(function(el){
    el.addEventListener('click',function(){if(G.scene&&G.scene.pick&&!G.paused)G.scene.pick(+el.getAttribute('data-pick'))});
  })(els[i]);
  els=c.querySelectorAll('[data-act="reset"]');
  for(i=0;i<els.length;i++)els[i].addEventListener('click',function(){if(G.scene&&G.scene.reset)G.scene.reset()});
}
window.addEventListener('keydown',function(e){
  if(!$('#modal').hidden)return;
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].indexOf(e.code)>-1&&!$('#stage').hidden)e.preventDefault();
  keys[e.code]=true;
  var m=/^(Digit|Numpad)([1-3])$/.exec(e.code);
  if(m&&G.scene&&G.scene.pick)G.scene.pick(+m[2]-1);
});
window.addEventListener('keyup',function(e){keys[e.code]=false});
window.addEventListener('blur',function(){for(var k in keys)keys[k]=false});
cv.addEventListener('pointerdown',function(e){
  if(!G.scene||!G.scene.click||G.paused)return;
  var r=cv.getBoundingClientRect();
  G.scene.click((e.clientX-r.left)*W/r.width,(e.clientY-r.top)*H/r.height);
});

/* ---------- Drawing helpers ---------- */
function txt(s,x,y,size,color,align){
  ctx.font=size+'px Silkscreen, "Courier New", monospace';
  ctx.fillStyle=color;ctx.textAlign=align||'left';ctx.textBaseline='alphabetic';
  ctx.fillText(s,x,y);
}
function interior(cam){
  var g=ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,'#0d1325');g.addColorStop(1,'#1a2240');
  ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  var off=(cam*0.25)%180,i;
  for(i=-1;i<7;i++){
    var x=i*180-off;
    ctx.fillStyle='#121a32';ctx.fillRect(x,0,46,H);
    ctx.fillStyle='#19224a';ctx.fillRect(x+40,0,6,H);
    ctx.fillStyle='#0f1730';ctx.fillRect(x+60,60,60,150);
    ctx.fillStyle='#1b2a55';ctx.fillRect(x+64,64,52,6);
  }
  ctx.fillStyle='rgba(255,176,46,.05)';
  ctx.fillRect(0,0,W,H);
}
function drawPlayer(x,y,face,t,state,alpha){
  ctx.save();
  ctx.globalAlpha=alpha==null?1:alpha;
  ctx.translate(Math.round(x),Math.round(y));ctx.scale(face,1);
  var run=state==='run',air=state==='jump';
  var sw=run?Math.sin(t*16)*7:0;
  ctx.fillStyle='#232b4a';
  if(air){ctx.fillRect(-9,-15,7,12);ctx.fillRect(2,-15,7,15)}
  else{ctx.fillRect(-8+sw*0.5,-16,7,16);ctx.fillRect(1-sw*0.5,-16,7,16)}
  ctx.fillStyle='#161c35';
  if(!air){ctx.fillRect(-8+sw*0.5,-3,8,3);ctx.fillRect(1-sw*0.5,-3,8,3)}
  ctx.fillStyle='#ff9f1c';ctx.fillRect(-9,-35,18,20);
  ctx.fillStyle='#d97f00';ctx.fillRect(-1,-35,2,20);ctx.fillRect(-9,-18,18,3);
  ctx.fillStyle='#ffb84d';
  if(air){ctx.fillRect(-14,-42,5,13);ctx.fillRect(9,-42,5,13)}
  else{ctx.fillRect(-14,-33+sw*0.35,5,15);ctx.fillRect(9,-33-sw*0.35,5,15)}
  ctx.fillStyle='#f2c9a0';ctx.fillRect(-8,-51,16,16);
  ctx.fillStyle='#2a1f1a';ctx.fillRect(-9,-53,18,6);ctx.fillRect(-9,-53,5,13);
  ctx.fillStyle='#111';ctx.fillRect(3,-45,3,3);
  ctx.restore();
}
function drawDoor(x,y,open,label){
  ctx.fillStyle='#3a4670';ctx.fillRect(x-4,y-4,78,74);
  ctx.fillStyle='#0a0e1b';ctx.fillRect(x,y,70,70);
  if(open){
    var g=ctx.createLinearGradient(0,y,0,y+70);g.addColorStop(0,'#fff3c4');g.addColorStop(1,'#ffb02e');
    ctx.fillStyle=g;ctx.fillRect(x+4,y+4,62,66);
    ctx.fillStyle='#d98f10';
    for(var i=0;i<4;i++)ctx.fillRect(x+10+i*10,y+46-i*10,52-i*10,6);
  }else{
    ctx.fillStyle='#4a5578';ctx.fillRect(x+4,y+4,62,66);
    ctx.fillStyle='#2f385a';ctx.fillRect(x+34,y+4,2,66);
  }
  txt(label||'UP',x+35,y-12,12,'#ffb02e','center');
}
function flames(cx,w,baseY,k,t){
  if(k<=0.01)return;
  var g=ctx.createLinearGradient(0,baseY-260,0,baseY);
  g.addColorStop(0,'#ffe08a');g.addColorStop(.35,'#ff9f1c');g.addColorStop(.75,'#e63900');g.addColorStop(1,'#7a1200');
  ctx.save();ctx.globalAlpha=k*0.92;ctx.fillStyle=g;
  var n=9,tw=w/n;
  for(var j=0;j<n;j++){
    var x=cx-w/2+(j+.5)*tw;
    var h=190+50*Math.sin(t*5+j*1.9)+25*Math.sin(t*9+j*3.1);
    var sx=Math.sin(t*6+j)*5;
    ctx.beginPath();
    ctx.moveTo(x-tw*.9,baseY);
    ctx.quadraticCurveTo(x-tw*.5+sx,baseY-h*.55,x+Math.sin(t*8+j*2)*9,baseY-h);
    ctx.quadraticCurveTo(x+tw*.5+sx,baseY-h*.55,x+tw*.9,baseY);
    ctx.closePath();ctx.fill();
  }
  ctx.restore();
}

/* ---------- Floor 1: Fire and fire ---------- */
function Floor1(){
  var PX=[335,480,625];
  var s={t:0,phase:'choose',seg:null,queue:[],choice:-1,landed:false,burning:false,doorOpen:false,
    fire:[1,1,1],attempt:++G.tries[1],p:{x:150,y:380,face:1,state:'idle',alpha:1}};
  function next(){
    var q=s.queue.shift();
    s.seg=q?Object.assign({e:0,x0:s.p.x,y0:s.p.y,d:0.01},q):null;
  }
  s.pick=function(i){
    if(s.phase!=='choose')return;
    s.phase='act';s.choice=i;
    var safe=(i===G.f1safe);
    var q=[{k:'jump',x:PX[i],y:380,d:.85,h:120,end:function(){if(safe)s.landed=true;else s.burning=true}}];
    if(safe){
      q.push({k:'wait',d:.7});
      q.push({k:'jump',x:790,y:380,d:.9,h:110,end:function(){s.doorOpen=true}});
      q.push({k:'walk',x:872,d:.8});
      q.push({k:'wait',d:.5,end:function(){winFloor(1)}});
    }else{
      q.push({k:'fall',d:.9});
      q.push({k:'wait',d:.6,end:function(){
        G.f1safe=(G.f1safe+1+Math.floor(Math.random()*2))%3;
        loseFloor(1,'The flame burned you. The safe pit has moved.');
      }});
    }
    s.queue=q;next();
  };
  s.click=function(x,y){
    for(var i=0;i<3;i++)if(Math.abs(x-PX[i])<60&&y>240){s.pick(i);return}
  };
  s.update=function(dt){
    s.t+=dt;
    if(s.landed&&s.choice>-1)s.fire[s.choice]=Math.max(.1,s.fire[s.choice]-dt*1.8);
    var g=s.seg;if(!g)return;
    g.e+=dt;
    var u=Math.min(1,g.e/g.d),p=s.p;
    if(g.k==='jump'){
      p.x=lerp(g.x0,g.x,u);p.y=lerp(g.y0,g.y,u)-4*g.h*u*(1-u);p.state='jump';p.face=g.x>=g.x0?1:-1;
    }else if(g.k==='walk'){p.x=lerp(g.x0,g.x,u);p.state='run';p.face=1}
    else if(g.k==='wait'){if(g.x0>0)p.state='idle'}
    else if(g.k==='fall'){p.y=g.y0+g.e*g.e*420;p.state='jump';p.alpha=Math.max(0,1-g.e/g.d)}
    if(g.e>=g.d){
      if(g.k==='jump'||g.k==='walk'){p.x=g.x;if(g.y!=null)p.y=g.y}
      if(g.k==='jump')p.state='idle';
      var end=g.end;next();
      if(end)end();
    }
  };
  s.draw=function(){
    interior(0);
    ctx.fillStyle='#262e4a';ctx.fillRect(0,380,230,160);ctx.fillRect(730,380,230,160);
    ctx.fillStyle='#3a4670';ctx.fillRect(0,380,230,6);ctx.fillRect(730,380,230,6);
    var cg=ctx.createLinearGradient(0,380,0,540);cg.addColorStop(0,'#150c18');cg.addColorStop(1,'#6a1c0a');
    ctx.fillStyle=cg;ctx.fillRect(230,380,500,160);
    drawDoor(850,310,s.doorOpen,'UP');
    var i;
    if(s.landed){
      var sx=PX[s.choice];
      ctx.fillStyle='#8b94ab';ctx.fillRect(sx-48,380,96,18);
      ctx.fillStyle='#b8c0d4';ctx.fillRect(sx-48,380,96,4);
    }
    drawPlayer(s.p.x,s.p.y,s.p.face,s.t,s.p.state,s.p.alpha);
    for(i=0;i<3;i++)flames(PX[i],100,540,s.fire[i],s.t+i*.7);
    var lab=['A','B','C'];
    for(i=0;i<3;i++){
      txt(lab[i],PX[i],232,26,'#ffe9b0','center');
      txt(String(i+1),PX[i],254,12,'#ffb02e','center');
      if(s.phase==='choose'){
        var by=270+Math.sin(s.t*4+i)*5;
        ctx.fillStyle='#ffb02e';ctx.beginPath();ctx.moveTo(PX[i]-9,by-8);ctx.lineTo(PX[i]+9,by-8);ctx.lineTo(PX[i],by+4);ctx.closePath();ctx.fill();
      }
    }
    txt('FLOOR 1 · ATTEMPT '+s.attempt,24,36,14,'#8f9bbd');
    if(s.phase==='choose')txt('ONE FLAME HIDES STONE. PICK A PIT.',W/2,86,16,'#ffe9b0','center');
    if(s.burning){ctx.fillStyle='rgba(255,60,20,'+(0.12+0.1*Math.sin(s.t*30))+')';ctx.fillRect(0,0,W,H)}
  };
  return s;
}

/* ---------- Floor 2: The bridge ---------- */
function Floor2(){
  var WORLD=2400,GY=360,GOAL=2290;
  var gaps=[[520,600],[960,1040],[1360,1480],[1800,1920]];
  var loose=[680,720,1120,1160,1200,1500,1540,1960,2000,2040];
  var planks=[],x;
  for(x=0;x<WORLD;x+=40){
    if(gaps.some(function(g){return x>=g[0]&&x<g[1]}))continue;
    planks.push({x:x,loose:loose.indexOf(x)>-1,st:0,tm:0,dy:0,vy:0,rot:0});
  }
  var s={t:0,over:false,after:0,result:'',jpWas:false,attempt:++G.tries[2],
    p:{x:90,y:GY,vx:0,vy:0,face:1,on:true,coy:0,buf:0,state:'idle'}};
  function support(px){
    for(var i=0;i<planks.length;i++){var pl=planks[i];if(pl.st<2&&px+9>pl.x&&px-9<pl.x+40)return pl}
    return null;
  }
  s.update=function(dt){
    s.t+=dt;
    var p=s.p,i;
    for(i=0;i<planks.length;i++){
      var pl=planks[i];
      if(pl.st===1){pl.tm-=dt;if(pl.tm<=0)pl.st=2}
      else if(pl.st===2){pl.vy+=1400*dt;pl.dy+=pl.vy*dt;pl.rot+=dt*3}
    }
    var dir=0;
    if(!s.over){
      dir=((keys.ArrowRight||keys.KeyD)?1:0)-((keys.ArrowLeft||keys.KeyA)?1:0);
      var jp=!!(keys.ArrowUp||keys.KeyW||keys.Space);
      if(jp&&!s.jpWas)p.buf=0.12;
      s.jpWas=jp;
    }
    p.vx=dir*235;if(dir)p.face=dir;
    p.buf-=dt;p.coy-=dt;
    if(p.on)p.coy=0.09;
    if(p.buf>0&&p.coy>0){p.vy=-560;p.on=false;p.coy=0;p.buf=0}
    p.vy+=1500*dt;
    p.x=clamp(p.x+p.vx*dt,14,WORLD-14);
    var py=p.y;p.y+=p.vy*dt;
    if(p.vy>=0&&py<=GY+0.5&&p.y>=GY){
      var sp=support(p.x);
      if(sp){
        p.y=GY;p.vy=0;p.on=true;
        if(sp.loose&&sp.st===0){sp.st=1;sp.tm=0.5}
      }else p.on=false;
    }else if(p.vy<0||p.y>GY+1)p.on=false;
    p.state=!p.on?'jump':(dir?'run':'idle');
    if(!s.over&&p.y>GY+240){
      s.over=true;s.result='lose';s.after=0.7;
    }
    if(!s.over&&p.x>=GOAL&&p.on){s.over=true;s.result='win';s.after=0.5}
    if(s.over){
      s.after-=dt;
      if(s.after<=0&&s.result){
        var r=s.result;s.result='';
        if(r==='win')winFloor(2);else loseFloor(2,'You fell off the bridge.');
      }
    }
  };
  s.draw=function(){
    var p=s.p,cam=clamp(p.x-360,0,WORLD-W),i;
    interior(cam);
    var cg=ctx.createLinearGradient(0,GY+20,0,H);cg.addColorStop(0,'rgba(10,6,16,0)');cg.addColorStop(1,'rgba(150,40,10,.55)');
    ctx.fillStyle=cg;ctx.fillRect(0,GY+20,W,H-GY-20);
    // ropes and posts
    for(i=0;i<planks.length;i++){
      var pl=planks[i];
      if(pl.x%120!==0||pl.st>1)continue;
      var sx=pl.x-cam+19;
      if(sx<-130||sx>W+130)continue;
      ctx.fillStyle='#5b3c22';ctx.fillRect(sx-3,GY-62,6,64);
      var ok=true;
      for(var k=0;k<4;k++){var q=planks[i+k];if(!q||q.x!==pl.x+40*k||q.st>1)ok=false}
      if(ok){
        ctx.strokeStyle='#b58a58';ctx.lineWidth=2;ctx.beginPath();
        ctx.moveTo(sx,GY-58);ctx.quadraticCurveTo(sx+60,GY-44,sx+120,GY-58);ctx.stroke();
      }
    }
    // planks
    for(i=0;i<planks.length;i++){
      var b=planks[i],bx=b.x-cam;
      if(bx<-50||bx>W+10)continue;
      ctx.save();
      var jit=b.st===1?(Math.random()-.5)*3:0;
      var by=GY+b.dy+Math.sin(s.t*2+b.x*.05)*1.2;
      ctx.translate(bx+19+jit,by+5);ctx.rotate(b.rot);
      ctx.fillStyle=b.loose?'#7a5030':'#8f6038';ctx.fillRect(-19,-5,38,11);
      ctx.fillStyle=b.loose?'#4c2f1a':'#6a4527';ctx.fillRect(-19,3,38,3);
      ctx.fillStyle='rgba(0,0,0,.25)';ctx.fillRect(-4,-5,1,9);
      if(b.loose){ctx.fillStyle='#c9a06a';ctx.fillRect(-16,-3,3,2);ctx.fillRect(13,-3,3,2)}
      ctx.restore();
    }
    drawDoor(GOAL+30-cam,GY-70,true,'STAIRS');
    txt('ENTRY',70-cam,GY-80,12,'#8f9bbd','center');
    if(p.y<GY+300)drawPlayer(p.x-cam,p.y,p.face,s.t,p.state,1);
    // HUD progress
    ctx.fillStyle='rgba(255,255,255,.12)';ctx.fillRect(40,24,W-80,8);
    ctx.fillStyle='#ffb02e';ctx.fillRect(40,24,(W-80)*clamp(p.x/GOAL,0,1),8);
    txt('FLOOR 2 · ATTEMPT '+s.attempt,40,58,13,'#8f9bbd');
    txt(Math.round(p.x/10)+' / '+Math.round(GOAL/10)+' M',W-40,58,13,'#8f9bbd','right');
    if(s.t<5)txt('LOOSE PLANKS GIVE WAY. KEEP MOVING.',W/2,120,14,'#ffe9b0','center');
  };
  return s;
}

/* ---------- Floor 3: Maze ---------- */
function Floor3(){
  var CW=12,CH=6,COLS=2*CW+1,ROWS=2*CH+1,T=36,OX=(W-COLS*T)/2,OY=(H-ROWS*T)/2,R=10;
  var grid=[],seen=[],explored=[],r,c;
  for(r=0;r<ROWS;r++){grid.push([]);explored.push([]);for(c=0;c<COLS;c++){grid[r].push(1);explored[r].push(false)}}
  for(r=0;r<CH;r++){seen.push([]);for(c=0;c<CW;c++)seen[r].push(false)}
  var st=[[0,0]];seen[0][0]=true;grid[1][1]=0;
  while(st.length){
    var cur=st[st.length-1],nb=[];
    [[1,0],[-1,0],[0,1],[0,-1]].forEach(function(d){
      var nx=cur[0]+d[0],ny=cur[1]+d[1];
      if(nx>=0&&ny>=0&&nx<CW&&ny<CH&&!seen[ny][nx])nb.push([nx,ny,d]);
    });
    if(!nb.length){st.pop();continue}
    var n=nb[Math.floor(Math.random()*nb.length)];
    seen[n[1]][n[0]]=true;
    grid[2*cur[1]+1+n[2][1]][2*cur[0]+1+n[2][0]]=0;
    grid[2*n[1]+1][2*n[0]+1]=0;
    st.push([n[0],n[1]]);
  }
  var EX=COLS-2,EY=ROWS-2;
  var s={t:0,won:false,after:0,steps:0,dir:[1,0],p:{x:OX+1.5*T,y:OY+1.5*T,moving:false}};
  function solid(x,y){
    var cc=Math.floor((x-OX)/T),rr=Math.floor((y-OY)/T);
    if(cc<0||rr<0||cc>=COLS||rr>=ROWS)return true;
    return grid[rr][cc]===1;
  }
  function hit(x,y){return solid(x-R,y-R)||solid(x+R,y-R)||solid(x-R,y+R)||solid(x+R,y+R)}
  s.reset=function(){s.p.x=OX+1.5*T;s.p.y=OY+1.5*T};
  s.update=function(dt){
    s.t+=dt;
    var p=s.p;
    if(!s.won){
      var dx=((keys.ArrowRight||keys.KeyD)?1:0)-((keys.ArrowLeft||keys.KeyA)?1:0);
      var dy=((keys.ArrowDown||keys.KeyS)?1:0)-((keys.ArrowUp||keys.KeyW)?1:0);
      p.moving=!!(dx||dy);
      if(dx||dy){
        var len=Math.sqrt(dx*dx+dy*dy);s.dir=[dx/len,dy/len];
        var nx=p.x+dx/len*165*dt,ny=p.y+dy/len*165*dt;
        if(!hit(nx,p.y))p.x=nx;
        if(!hit(p.x,ny))p.y=ny;
      }
      var tc=Math.floor((p.x-OX)/T),tr=Math.floor((p.y-OY)/T);
      if(tc===EX&&tr===EY){s.won=true;s.after=0.7}
    }else{
      s.after-=dt;
      if(s.after<=0){s.after=999;winFloor(3)}
    }
    var pc=(p.x-OX)/T,pr=(p.y-OY)/T;
    for(var rr=0;rr<ROWS;rr++)for(var cc=0;cc<COLS;cc++){
      var d=Math.hypot(cc+.5-pc,rr+.5-pr);
      if(d<4.4)explored[rr][cc]=true;
    }
  };
  s.draw=function(){
    ctx.fillStyle='#05070f';ctx.fillRect(0,0,W,H);
    var p=s.p,pc=(p.x-OX)/T,pr=(p.y-OY)/T;
    for(var rr=0;rr<ROWS;rr++)for(var cc=0;cc<COLS;cc++){
      if(!explored[rr][cc])continue;
      var d=Math.hypot(cc+.5-pc,rr+.5-pr);
      var a=d<2.6?1:clamp(1-(d-2.6)/2.2,0.3,1);
      var x=OX+cc*T,y=OY+rr*T;
      ctx.globalAlpha=a;
      if(grid[rr][cc]===1){
        ctx.fillStyle='#232d4d';ctx.fillRect(x,y,T,T);
        ctx.fillStyle='#34426f';ctx.fillRect(x,y,T,4);
        ctx.fillStyle='#1a2340';ctx.fillRect(x,y+T-3,T,3);
      }else{
        ctx.fillStyle=(rr+cc)%2?'#161d35':'#18203a';ctx.fillRect(x,y,T,T);
      }
    }
    ctx.globalAlpha=1;
    // start and exit markers
    var ex=OX+EX*T,ey=OY+EY*T;
    if(explored[EY][EX]){
      var gl=ctx.createRadialGradient(ex+T/2,ey+T/2,2,ex+T/2,ey+T/2,T*1.4);
      gl.addColorStop(0,'rgba(255,224,138,.9)');gl.addColorStop(1,'rgba(255,176,46,0)');
      ctx.fillStyle=gl;ctx.fillRect(ex-T,ey-T,T*3,T*3);
      ctx.fillStyle='#ffe08a';ctx.fillRect(ex+5,ey+4,T-10,T-8);
      ctx.fillStyle='#d98f10';ctx.fillRect(ex+9,ey+22,T-18,4);ctx.fillRect(ex+13,ey+16,T-26,4);
    }
    txt('IN',OX+T*1.5,OY+T*1.5+26,9,'#5a678f','center');
    // player (top-down)
    ctx.fillStyle='rgba(0,0,0,.35)';ctx.beginPath();ctx.ellipse(p.x,p.y+9,10,5,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#ff9f1c';ctx.beginPath();ctx.arc(p.x,p.y,10,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#d97f00';ctx.fillRect(p.x-1,p.y-9,2,18);
    ctx.fillStyle='#f2c9a0';ctx.beginPath();ctx.arc(p.x+s.dir[0]*3,p.y+s.dir[1]*3-1,6,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#2a1f1a';ctx.beginPath();ctx.arc(p.x+s.dir[0]*1,p.y+s.dir[1]*1-2,6,Math.PI,Math.PI*2);ctx.fill();
    txt('FLOOR 3 · FIND THE EXIT',24,26,13,'#8f9bbd');
    txt('GLOW = STAIRS',W-24,26,13,'#ffb02e','right');
  };
  return s;
}

/* ---------- Floor 4: Quiz ---------- */
var BANK=[
  {q:'What does print(7 // 2) show?',o:['3','3.5','4','2'],why:'// is floor division, so 7 // 2 is 3.'},
  {q:'Which keyword starts a function definition?',o:['def','func','function','define'],why:'Python uses def.'},
  {q:'What is len("hello")?',o:['5','4','6','hello'],why:'The string has 5 characters.'},
  {q:'What does print(2 ** 3) show?',o:['8','6','5','9'],why:'** is the power operator: 2 to the power 3 is 8.'},
  {q:'What does print("py" * 3) show?',o:['pypypy','py3','py py py','Error'],why:'A string times an int repeats the string.'},
  {q:'Which of these is immutable?',o:['tuple','list','dict','set'],why:'Tuples cannot be changed after they are created.'},
  {q:'What does list(range(3)) give?',o:['[0, 1, 2]','[1, 2, 3]','[0, 1, 2, 3]','[3]'],why:'range(3) starts at 0 and stops before 3.'},
  {q:'After x = [1, 2, 3] and x.append(4), what is x?',o:['[1, 2, 3, 4]','[4, 1, 2, 3]','[1, 2, 3]','[5]'],why:'append adds one item to the end.'},
  {q:'What does bool("") return?',o:['False','True','None','Error'],why:'An empty string is falsy.'},
  {q:'What does "abc".upper() return?',o:['"ABC"','"abc"','"Abc"','None'],why:'upper() returns an uppercase copy.'},
  {q:'Which symbol starts a comment in Python?',o:['#','//','--','/*'],why:'Everything after # on a line is ignored.'},
  {q:'What is type(3.0)?',o:["<class 'float'>","<class 'int'>","<class 'str'>","<class 'number'>"],why:'3.0 has a decimal point, so it is a float.'},
  {q:'What does print(10 % 3) show?',o:['1','3','0','3.33'],why:'% gives the remainder: 10 = 3*3 + 1.'}
];
function startQuiz(){
  G.tries[4]++;
  var qs=shuffle(BANK).slice(0,5),i=0,right=0,wrong=0,marks=[];
  var panel=$('#panel');
  function show(){
    var q=qs[i];
    var opts=shuffle(q.o.map(function(t,k){return {t:t,c:k===0}}));
    var dots='';
    for(var k=0;k<5;k++)dots+='<i class="'+(marks[k]||(k===i?'now':''))+'"></i>';
    panel.innerHTML='<div class="qhead"><span>QUESTION '+(i+1)+' OF 5</span><span>RIGHT '+right+' · WRONG '+wrong+'</span></div>'
      +'<div class="dots">'+dots+'</div>'
      +'<h2>'+esc(q.q)+'</h2>'
      +'<div class="opts">'+opts.map(function(o,k){return '<button class="opt" type="button" data-i="'+k+'">'+esc(o.t)+'</button>'}).join('')+'</div>'
      +'<div class="fb" hidden><p id="why"></p><button class="btn" id="qnext" type="button">NEXT</button></div>';
    var btns=panel.querySelectorAll('.opt');
    Array.prototype.forEach.call(btns,function(b){
      b.addEventListener('click',function(){
        var o=opts[+b.getAttribute('data-i')];
        Array.prototype.forEach.call(btns,function(x,k){x.disabled=true;if(opts[k].c)x.classList.add('ok')});
        if(o.c){right++;marks[i]='ok'}else{wrong++;b.classList.add('no');marks[i]='no'}
        var fb=panel.querySelector('.fb');fb.hidden=false;
        panel.querySelector('#why').textContent=(o.c?'Correct. ':'Wrong. ')+q.why;
        var done=right>=4||wrong>=2;
        var nb=panel.querySelector('#qnext');
        nb.textContent=done?'SEE RESULT':'NEXT';
        nb.focus();
        nb.addEventListener('click',function(){
          if(done){
            if(right>=4)winFloor(4);
            else loseFloor(4,'Two wrong answers.');
          }else{i++;show()}
        });
      });
    });
  }
  show();
}

/* ---------- Floor 5: Build the door ---------- */
var PUZZLES=[
  {goal:'Goal: the program prints OPEN.',lines:[
    'def check(code):','    total = 0','    for d in code:','        total += d','    return total == 8','print("OPEN" if check([3, 1, 4]) else "LOCKED")']},
  {goal:'Goal: the program prints OPEN.',lines:[
    'def unlock(pin):','    if pin == 4821:','        return "OPEN"','    return "LOCKED"','result = unlock(4821)','print(result)']}
];
function startBuild(){
  G.tries[5]++;
  var pz=PUZZLES[Math.floor(Math.random()*PUZZLES.length)],N=pz.lines.length;
  var ids=[],k;for(k=0;k<N;k++)ids.push(k);
  var order;do{order=shuffle(ids)}while(order.every(function(v,j){return v===j}));
  var slots=[];for(k=0;k<N;k++)slots.push(null);
  var locked=false,TOTAL=120000,deadline=Date.now()+TOTAL;
  var panel=$('#panel');
  panel.innerHTML='<div class="clock"><span id="clk">2:00</span><div class="bar"><i id="fill"></i></div></div>'
    +'<h2>Build the door. Put the lines in the right order.</h2>'
    +'<div class="bgrid"><div><h3>CODE PIECES</h3><div class="pool" id="pool"></div></div>'
    +'<div><h3>THE DOOR · '+esc(pz.goal)+'</h3><div class="door" id="door"></div></div></div>'
    +'<div class="bact"><button class="btn" id="run" type="button">RUN ▶</button><button class="btn ghost" id="clr" type="button">CLEAR</button><span class="msg" id="bmsg">Tap a piece to place it. Tap a placed line to take it back. Run checks the order.</span></div>';
  function render(status){
    var pool=$('#pool'),door=$('#door');
    pool.innerHTML='';door.innerHTML='';
    order.forEach(function(id){
      if(slots.indexOf(id)>-1)return;
      var b=document.createElement('button');b.type='button';b.className='piece';b.textContent=pz.lines[id];
      b.addEventListener('click',function(){
        if(locked)return;
        var f=slots.indexOf(null);if(f<0)return;
        slots[f]=id;render();
      });
      pool.appendChild(b);
    });
    if(!pool.children.length)pool.innerHTML='<span style="color:var(--muted);font-size:13px">All pieces placed.</span>';
    slots.forEach(function(id,j){
      var d=document.createElement('div');
      d.className='slot'+(id!=null?' full':'');
      if(status&&id!=null)d.classList.add(status[j]?'ok':'bad');
      d.textContent=id!=null?pz.lines[id]:'line '+(j+1);
      d.addEventListener('click',function(){if(locked||slots[j]==null)return;slots[j]=null;render()});
      door.appendChild(d);
    });
    if(locked&&status&&status.every(Boolean))door.classList.add('open');
  }
  render();
  function tick(){
    var rem=Math.max(0,deadline-Date.now());
    var s=Math.ceil(rem/1000);
    var el=$('#clk');if(!el)return;
    el.textContent=Math.floor(s/60)+':'+String(s%60).padStart(2,'0');
    el.classList.toggle('low',s<=20);
    $('#fill').style.width=(rem/TOTAL*100)+'%';
    if(rem<=0&&!locked){
      locked=true;clearInterval(G.timer);G.timer=null;
      loseFloor(5,'Time ran out before the door was built.');
    }
  }
  G.timer=setInterval(tick,200);tick();
  $('#clr').addEventListener('click',function(){if(locked)return;for(var j=0;j<N;j++)slots[j]=null;render();$('#bmsg').textContent='Cleared. Start again.'});
  $('#run').addEventListener('click',function(){
    if(locked)return;
    if(slots.indexOf(null)>-1){$('#bmsg').textContent='Fill all '+N+' lines first.';return}
    var status=slots.map(function(id,j){return id===j});
    var good=status.filter(Boolean).length;
    if(good===N){
      locked=true;clearInterval(G.timer);G.timer=null;
      render(status);
      $('#bmsg').textContent='The program prints OPEN. The door slides open.';
      setTimeout(function(){
        modal({title:'DOOR BUILT',text:'The last door is open. The stairs lead to the roof, and the helicopter is waiting.',kind:'win',button:'Run to the helicopter'},startEnding);
      },1500);
    }else{
      render(status);
      $('#bmsg').textContent=good+' of '+N+' lines are in the right place. Red lines are wrong. Fix them and run again.';
    }
  });
}

/* ---------- Ending ---------- */
function Ending(){
  var sky=[],stars=[],i;
  for(i=0;i<22;i++)sky.push({x:i*46-10,w:30+((i*37)%28),h:60+((i*53)%120)});
  for(i=0;i<50;i++)stars.push({x:(i*97)%W,y:(i*61)%260,r:(i%3)+1});
  var s={t:0,done:false,p:{x:120,y:420}};
  function ease(u){return u*u*(3-2*u)}
  var HX=640;
  function heliPos(t){
    if(t<2)return {x:lerp(1250,HX,ease(t/2)),y:250};
    if(t<3.2)return {x:HX,y:lerp(250,386,ease((t-2)/1.2))};
    if(t<6)return {x:HX,y:386};
    var u=t-6;return {x:HX+u*u*60,y:386-u*u*42};
  }
  s.update=function(dt){
    s.t+=dt;
    var t=s.t;
    if(t>=3.4&&t<5.4)s.p.x=lerp(120,HX-8,(t-3.4)/2);
    if(t>10.2&&!s.done){
      s.done=true;
      modal({title:'FREEDOM',text:'You cleared all five floors and flew out of the building. You are free.',kind:'win',button:'Play again'},function(){G.tries={1:0,2:0,3:0,4:0,5:0};startFloor(1)});
    }
  };
  s.draw=function(){
    var t=s.t,k=clamp(t/10,0,1),i;
    var g=ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0,'rgb('+Math.round(lerp(8,48,k))+','+Math.round(lerp(12,70,k))+','+Math.round(lerp(34,130,k))+')');
    g.addColorStop(.75,'rgb('+Math.round(lerp(34,255,k))+','+Math.round(lerp(30,150,k))+','+Math.round(lerp(78,80,k))+')');
    g.addColorStop(1,'rgb('+Math.round(lerp(40,255,k))+','+Math.round(lerp(34,190,k))+','+Math.round(lerp(80,110,k))+')');
    ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    ctx.fillStyle='#fff';
    for(i=0;i<stars.length;i++){ctx.globalAlpha=(1-k)*0.8;ctx.fillRect(stars[i].x,stars[i].y,stars[i].r,stars[i].r)}
    ctx.globalAlpha=1;
    var sy=lerp(470,330,k);
    ctx.fillStyle='rgba(255,230,160,.9)';ctx.beginPath();ctx.arc(780,sy,46,0,Math.PI*2);ctx.fill();
    for(i=0;i<sky.length;i++){
      ctx.fillStyle='#1a2040';ctx.fillRect(sky[i].x,420-sky[i].h,sky[i].w,sky[i].h+4);
      ctx.fillStyle='rgba(255,210,120,.5)';
      ctx.fillRect(sky[i].x+5,420-sky[i].h+12,4,4);ctx.fillRect(sky[i].x+sky[i].w-10,420-sky[i].h+34,4,4);
    }
    // roof
    ctx.fillStyle='#1c2338';ctx.fillRect(0,420,W,120);
    ctx.fillStyle='#2e3858';ctx.fillRect(0,420,W,6);
    ctx.fillStyle='#252d48';ctx.fillRect(0,452,W,3);
    // hut
    ctx.fillStyle='#2a3352';ctx.fillRect(30,320,130,100);
    ctx.fillStyle='#39456b';ctx.fillRect(30,320,130,6);
    ctx.fillStyle='#ffd978';ctx.fillRect(96,350,40,70);
    txt('ROOF',95,310,12,'#ffb02e','center');
    // helipad
    ctx.strokeStyle='rgba(255,255,255,.6)';ctx.lineWidth=3;
    ctx.beginPath();ctx.ellipse(HX,430,118,13,0,0,Math.PI*2);ctx.stroke();
    txt('H',HX,438,26,'rgba(255,255,255,.7)','center');
    // player
    if(t<5.4)drawPlayer(s.p.x,s.p.y,1,t,(t>=3.4&&t<5.4)?'run':'idle',1);
    // helicopter
    var hp=heliPos(t);
    drawHeli(hp.x,hp.y,t);
    if(t>6.8){
      ctx.globalAlpha=clamp((t-6.8)/1.2,0,1);
      txt('FREEDOM',W/2,150,56,'#fff3c4','center');
      ctx.globalAlpha=1;
    }
  };
  return s;
}
function drawHeli(x,y,t){
  ctx.save();ctx.translate(x,y);
  ctx.fillStyle='#d7d2c4';
  ctx.beginPath();ctx.moveTo(30,-10);ctx.lineTo(140,-20);ctx.lineTo(140,-11);ctx.lineTo(30,8);ctx.closePath();ctx.fill();
  ctx.fillStyle='#ff7a1a';ctx.fillRect(126,-44,14,28);
  ctx.fillStyle='#e9e4d6';ctx.beginPath();ctx.ellipse(0,0,56,32,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#ff7a1a';ctx.fillRect(-48,6,100,7);
  var cg=ctx.createLinearGradient(-60,-24,-20,14);cg.addColorStop(0,'#bff3ff');cg.addColorStop(1,'#4aa6c4');
  ctx.fillStyle=cg;ctx.beginPath();ctx.ellipse(-26,-4,26,20,-0.2,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#4a4f66';ctx.fillRect(-4,-44,8,14);
  var a=t*34,cx=Math.cos(a);
  ctx.globalAlpha=.22;ctx.fillStyle='#fff';ctx.beginPath();ctx.ellipse(0,-45,130,6,0,0,Math.PI*2);ctx.fill();
  ctx.globalAlpha=1;ctx.strokeStyle='#2b3047';ctx.lineWidth=5;
  ctx.beginPath();ctx.moveTo(-125*cx,-45);ctx.lineTo(125*cx,-45);ctx.stroke();
  ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(133,-30+Math.sin(a)*12);ctx.lineTo(133,-30-Math.sin(a)*12);ctx.stroke();
  ctx.strokeStyle='#2b3047';ctx.lineWidth=4;
  ctx.beginPath();ctx.moveTo(-52,38);ctx.lineTo(48,38);ctx.stroke();
  ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-28,28);ctx.lineTo(-32,38);ctx.moveTo(26,28);ctx.lineTo(30,38);ctx.stroke();
  ctx.restore();
}

/* ---------- Main loop ---------- */
var last=performance.now();
function frame(now){
  var dt=Math.min(0.05,(now-last)/1000);last=now;
  var sc=G.scene;
  if(sc&&!$('#stage').hidden){
    if(!G.paused)sc.update(dt);
    if(G.scene===sc)sc.draw();
  }
  requestAnimationFrame(frame);
}
buildTower();
updateTower();
$('#mission').textContent='# FIVE FLOORS OUT\nplayer.floor = 1\nwhile player.floor <= 5:\n    complete(mission[player.floor])\nhelicopter.board(player)';
$('#rule').textContent='Clear all five floors to reach the helicopter.';
$('#stage').hidden=false;
ctx.fillStyle='#0d1325';ctx.fillRect(0,0,W,H);
requestAnimationFrame(frame);
modal({
  title:'FIVE FLOORS OUT',
  text:'You are locked inside a five-floor building. Clear each mission to climb. On the roof, finish the last mission and the helicopter takes you out. Lose, and you drop back down: floor 1 repeats, floors 2 to 4 send you one floor down, and floor 5 sends you all the way to floor 1.',
  button:'Start on floor 1'
},function(){startFloor(1)});
})();
