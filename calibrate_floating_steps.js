'use strict';
// Node.js calibration script for floating_steps geometry.
// Usage: node calibrate_floating_steps.js [ramp2_x1 ramp2_y1 ramp2_x2 ramp2_y2]

// ---- physics core (copy of ==ESP-PHYSICS-CORE-BEGIN== block) ----------------
var MASS = 60, FRICTION_SCALE = 30, SUBDT = 1 / 240;

function catmullSample(ptsIn, perSeg) {
  perSeg = perSeg || 70;
  var pts = [];
  for (var i = 0; i < ptsIn.length; i++) {
    var p = ptsIn[i];
    if (!pts.length || Math.hypot(p[0]-pts[pts.length-1][0], p[1]-pts[pts.length-1][1]) > 1e-6)
      pts.push([p[0], p[1]]);
  }
  if (pts.length < 2) pts.push([pts[0][0]+1, pts[0][1]]);
  var P = pts.slice();
  P.unshift([2*pts[0][0]-pts[1][0], 2*pts[0][1]-pts[1][1]]);
  var n = pts.length;
  P.push([2*pts[n-1][0]-pts[n-2][0], 2*pts[n-1][1]-pts[n-2][1]]);
  var X = [], Y = [];
  function knot(t,a,b){return Math.pow(Math.hypot(b[0]-a[0],b[1]-a[1]),0.5)+t;}
  for (var seg=0; seg+3<P.length; seg++) {
    var p0=P[seg],p1=P[seg+1],p2=P[seg+2],p3=P[seg+3];
    var t0=0,t1=knot(t0,p0,p1),t2=knot(t1,p1,p2),t3=knot(t2,p2,p3);
    if (t2-t1<1e-9) continue;
    for (var j=(seg===0?0:1); j<=perSeg; j++) {
      var t=t1+(t2-t1)*j/perSeg;
      var A1x=lerp2(p0[0],p1[0],t0,t1,t),A1y=lerp2(p0[1],p1[1],t0,t1,t);
      var A2x=lerp2(p1[0],p2[0],t1,t2,t),A2y=lerp2(p1[1],p2[1],t1,t2,t);
      var A3x=lerp2(p2[0],p3[0],t2,t3,t),A3y=lerp2(p2[1],p3[1],t2,t3,t);
      var B1x=lerp2(A1x,A2x,t0,t2,t),B1y=lerp2(A1y,A2y,t0,t2,t);
      var B2x=lerp2(A2x,A3x,t1,t3,t),B2y=lerp2(A2y,A3y,t1,t3,t);
      X.push(lerp2(B1x,B2x,t1,t2,t)); Y.push(lerp2(B1y,B2y,t1,t2,t));
    }
  }
  function lerp2(a,b,ta,tb,t){return a+(b-a)*(t-ta)/(tb-ta);}
  var m=X.length, S=[0], TX=[], TY=[], K=[];
  for (i=1;i<m;i++) S[i]=S[i-1]+Math.hypot(X[i]-X[i-1],Y[i]-Y[i-1]);
  for (i=0;i<m;i++){
    var i0=Math.max(0,i-1),i1=Math.min(m-1,i+1);
    var dx=X[i1]-X[i0],dy=Y[i1]-Y[i0],L=Math.hypot(dx,dy)||1e-9;
    TX[i]=dx/L; TY[i]=dy/L;
  }
  for (i=0;i<m;i++){
    i0=Math.max(0,i-1); i1=Math.min(m-1,i+1);
    var ds=S[i1]-S[i0]||1e-9;
    var cr=TX[i0]*TY[i1]-TY[i0]*TX[i1];
    var dt2=TX[i0]*TX[i1]+TY[i0]*TY[i1];
    K[i]=Math.atan2(cr,dt2)/ds;
  }
  return {pts,X,Y,S,TX,TY,K,n:m,total:S[m-1]};
}

function trackQuery(tr,s){
  var S=tr.S,n=tr.n;
  if(s<=0) s=0; if(s>=tr.total) s=tr.total;
  var lo=0,hi=n-1,mid;
  while(hi-lo>1){mid=(lo+hi)>>1; if(S[mid]>s) hi=mid; else lo=mid;}
  var f=(s-S[lo])/((S[hi]-S[lo])||1e-9);
  var tx=tr.TX[lo]+(tr.TX[hi]-tr.TX[lo])*f;
  var ty=tr.TY[lo]+(tr.TY[hi]-tr.TY[lo])*f;
  var L=Math.hypot(tx,ty)||1e-9;
  return{x:tr.X[lo]+(tr.X[hi]-tr.X[lo])*f, y:tr.Y[lo]+(tr.Y[hi]-tr.Y[lo])*f,
         tx:tx/L, ty:ty/L, k:tr.K[lo]+(tr.K[hi]-tr.K[lo])*f};
}

function closestOnTrack(tr,px,py){
  var best=-1,bd=Infinity,stride=Math.max(1,Math.floor(tr.n/260));
  for(var i=0;i<tr.n;i+=stride){
    var d=(tr.X[i]-px)**2+(tr.Y[i]-py)**2;
    if(d<bd){bd=d;best=i;}
  }
  var lo=Math.max(0,best-stride),hi=Math.min(tr.n-1,best+stride);
  for(i=lo;i<=hi;i++){
    var d=(tr.X[i]-px)**2+(tr.Y[i]-py)**2;
    if(d<bd){bd=d;best=i;}
  }
  return{s:tr.S[best],dist:Math.sqrt(bd),idx:best};
}

function newSkater(){
  return{mode:'air',s:0,v:0,x:1.6,y:0,vx:0,vy:0,
         eth:0,em0:0,angle:0,face:1,airT:0,prevD:1,segIdx:0,segPrevD:[]};
}
function placeOnTrack(st,tr,s,g){
  var q=trackQuery(tr,s);
  st.mode='track';st.s=s;st.v=0;st.eth=0;
  st.em0=g*q.y;st.x=q.x;st.y=q.y;st.angle=Math.atan2(q.ty,q.tx);
}
function detach(st,tr,g){
  var q=trackQuery(tr,st.s);
  st.mode='air';
  st.x=q.x-q.ty*0.012;st.y=q.y+q.tx*0.012;
  st.vx=st.v*q.tx;st.vy=st.v*q.ty;
  st.airT=0;st.prevD=1;st.segPrevD=[];
}

function stepSkater(st,tr,dt,g,b,stick,segs){
  if(st.mode==='track'){
    var s=st.s,v=st.v;
    function f(s_,v_){var q=trackQuery(tr,s_);return[v_,-g*q.ty-b*v_];}
    var k1=f(s,v),k2=f(s+dt/2*k1[0],v+dt/2*k1[1]),
        k3=f(s+dt/2*k2[0],v+dt/2*k2[1]),k4=f(s+dt*k3[0],v+dt*k3[1]);
    var sN=s+dt/6*(k1[0]+2*k2[0]+2*k3[0]+k4[0]);
    var vN=v+dt/6*(k1[1]+2*k2[1]+2*k3[1]+k4[1]);
    var v2=(k1[0]**2+2*k2[0]**2+2*k3[0]**2+k4[0]**2)/6;
    st.eth+=b*v2*dt;
    if(sN<0||sN>tr.total){
      st.s=Math.max(0,Math.min(tr.total,sN));st.v=vN;
      detach(st,tr,g);return'left-end';
    }
    var q=trackQuery(tr,sN);
    var ke2=2*(st.em0-g*q.y-st.eth);
    if(ke2<0)ke2=0;
    var sg=vN>0?1:(vN<0?-1:(v>=0?1:-1));
    st.s=sN;st.v=sg*Math.sqrt(ke2);
    st.x=q.x;st.y=q.y;st.angle=Math.atan2(q.ty,q.tx);
    if(!stick){
      var N=st.v*st.v*q.k+g*q.tx;
      if(N<-1e-9){detach(st,tr,g);return'detach';}
    }
    return null;
  }
  if(st.mode==='air'){
    st.x+=st.vx*dt;
    st.y+=st.vy*dt-0.5*g*dt*dt;
    st.vy-=g*dt;
    st.airT+=dt;
    if(Math.abs(st.vx)>0.05)st.face=st.vx>0?1:-1;
    if(st.y<=0&&st.vy<0){
      st.eth+=0.5*st.vy*st.vy;
      st.y=0;st.mode='ground';st.v=st.vx;st.angle=0;
      st.em0=0.5*st.v*st.v+st.eth;return'land-ground';
    }
    if(st.airT>0.04){
      if(segs){
        for(var si=0;si<segs.length;si++){
          var seg=segs[si];
          var c=closestOnTrack(seg,st.x,st.y);
          var q2=trackQuery(seg,c.s);
          var d=(st.x-q2.x)*(-q2.ty)+(st.y-q2.y)*q2.tx;
          var vn=st.vx*(-q2.ty)+st.vy*q2.tx;
          var prevD=st.segPrevD[si]!==undefined?st.segPrevD[si]:1;
          if(prevD>0&&d<=0&&c.dist<0.6&&vn<0&&c.s>1e-6&&c.s<seg.total-1e-6){
            var vt=st.vx*q2.tx+st.vy*q2.ty;
            st.eth+=0.5*vn*vn;
            st.mode='track';st.s=c.s;st.v=vt;st.segIdx=si;
            st.em0=0.5*vt*vt+g*q2.y+st.eth;
            st.x=q2.x;st.y=q2.y;st.angle=Math.atan2(q2.ty,q2.tx);
            st.segPrevD=[];return'land-track';
          }
          st.segPrevD[si]=d;
        }
      } else if(tr){
        var c=closestOnTrack(tr,st.x,st.y);
        var q2=trackQuery(tr,c.s);
        var d=(st.x-q2.x)*(-q2.ty)+(st.y-q2.y)*q2.tx;
        var vn=st.vx*(-q2.ty)+st.vy*q2.tx;
        if(st.prevD>0&&d<=0&&c.dist<0.6&&vn<0&&c.s>1e-6&&c.s<tr.total-1e-6){
          var vt=st.vx*q2.tx+st.vy*q2.ty;
          st.eth+=0.5*vn*vn;
          st.mode='track';st.s=c.s;st.v=vt;
          st.em0=0.5*vt*vt+g*q2.y+st.eth;
          st.x=q2.x;st.y=q2.y;st.angle=Math.atan2(q2.ty,q2.tx);
          return'land-track';
        }
        st.prevD=d;
      }
    }
    return null;
  }
  if(st.mode==='ground'){
    var vOld=st.v;
    if(b>0){
      st.v=vOld*Math.exp(-b*dt);
      st.x+=vOld*(1-Math.exp(-b*dt))/b;
      st.eth+=0.5*(vOld*vOld-st.v*st.v);
    } else st.x+=vOld*dt;
    return null;
  }
  return null;
}
// ---- end physics core -------------------------------------------------------

// linearSample: straight-line segment as a track object
function linearSample(p0, p1, N) {
  N = N || 40;
  var dx=p1[0]-p0[0], dy=p1[1]-p0[1];
  var len=Math.hypot(dx,dy)||1e-9;
  var tx=dx/len, ty=dy/len;
  var X=[], Y=[], S=[], TX=[], TY=[], K=[];
  for (var i=0; i<=N; i++) {
    var t=i/N;
    X.push(p0[0]+dx*t); Y.push(p0[1]+dy*t);
    S.push(len*t); TX.push(tx); TY.push(ty); K.push(0);
  }
  return {pts:[p0,p1], X, Y, S, TX, TY, K, n:N+1, total:len};
}

// Test a given set of segments. Returns { L, vLaunch, vFar, vFarFric }
function testSegments(segDefs, friction) {
  var segs = segDefs.map(([p0, p1]) => linearSample(p0, p1));
  var st = newSkater(); st.segIdx = 0; st.segPrevD = [];
  placeOnTrack(st, segs[0], 0.001, 10);
  var t = 0, L = [], g = 10;
  while (t < 30) {
    var tr = st.mode === 'track' ? segs[st.segIdx] : null;
    var b = st.mode === 'track' ? friction * FRICTION_SCALE : 0;
    var ev = stepSkater(st, tr, SUBDT, g, b, false, st.mode === 'air' ? segs : null);
    t += SUBDT;
    if (ev === 'left-end') L.push({ x: st.x, y: st.y, sp: Math.hypot(st.vx, st.vy), seg: st.segIdx });
    if (L.length >= 2 || st.mode === 'ground' || st.y < -0.5) break;
  }
  return L;
}

// Ramp 1 is fixed: [[0.4, 4.65], [3.8, 3.725]] → gives Δy=0.925m → ~4.30 m/s
const RAMP1 = [[0.4, 4.65], [3.8, 3.725]];

// Command-line args: optional ramp2 geometry override
var args = process.argv.slice(2);
var r2x0 = parseFloat(args[0]) || 4.55;
var r2y0 = parseFloat(args[1]) || 2.77;
var r2x1 = parseFloat(args[2]) || 7.00;
var r2y1 = parseFloat(args[3]) || 3.14;
var RAMP2 = [[r2x0, r2y0], [r2x1, r2y1]];

// Also provide a few extra ramps so skater doesn't overshoot into void
const RAMP3 = [[7.40, 1.55], [9.10, 1.75]];
const RAMP4 = [[9.00, 0.70], [10.50, 0.45]];

// Sweep ramp2 y_far to find the value giving v_far ≈ 2.20
console.log('=== Ramp 1 baseline ===');
var L1 = testSegments([RAMP1, RAMP2, RAMP3, RAMP4], 0);
console.log('  L[0] (ramp1 launch):', L1[0] ? `v=${L1[0].sp.toFixed(4)} m/s` : 'not found');
console.log('  L[1] (ramp2 far edge):', L1[1] ? `v=${L1[1].sp.toFixed(4)} m/s at (${L1[1].x.toFixed(3)}, ${L1[1].y.toFixed(3)})` : 'not found');

console.log('\n=== Sweep ramp2 y_far ===');
console.log('y_far\tv_far(m/s)\t|target 2.200|');
for (var yf = 2.90; yf <= 3.50; yf += 0.05) {
  var ramp2 = [[r2x0, r2y0], [r2x1, yf]];
  var L = testSegments([RAMP1, ramp2, RAMP3, RAMP4], 0);
  var vf = L[1] ? L[1].sp : NaN;
  var marker = (Math.abs(vf - 2.20) < 0.05) ? ' <-- near target' : '';
  console.log(`  ${yf.toFixed(2)}\t${isNaN(vf)?'miss':vf.toFixed(4)}\t\t${marker}`);
}

console.log('\n=== Fine sweep around best region ===');
for (var yf = 3.10; yf <= 3.35; yf += 0.01) {
  var ramp2 = [[r2x0, r2y0], [r2x1, yf]];
  var L = testSegments([RAMP1, ramp2, RAMP3, RAMP4], 0);
  var vf = L[1] ? L[1].sp : NaN;
  var v0 = L[0] ? L[0].sp : NaN;
  var marker = (Math.abs(vf - 2.20) < 0.02) ? ' <<<' : '';
  console.log(`  y_far=${yf.toFixed(2)}  v_launch=${isNaN(v0)?'miss':v0.toFixed(3)}  v_far=${isNaN(vf)?'miss':vf.toFixed(3)}${marker}`);
}

console.log('\n=== Friction test at best ramp2 geometry ===');
// Once we know y_far, test with friction=0.0089 → launch should be ~3.70 m/s
var BEST_RAMP2 = [[r2x0, r2y0], [r2x1, r2y1]];
console.log('Using ramp2:', JSON.stringify(BEST_RAMP2));
var Lf = testSegments([RAMP1, BEST_RAMP2, RAMP3, RAMP4], 0.0089);
console.log('  friction=0.0089: L[0]:', Lf[0] ? `${Lf[0].sp.toFixed(3)} m/s (target 3.69-3.71)` : 'not found');
