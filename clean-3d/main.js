const canvas = document.getElementById('game');
const gl = canvas.getContext('webgl', { antialias: true, alpha: false });

if (!gl) {
  document.body.innerHTML = '<div style="padding:24px;color:white;background:#111;font-family:sans-serif">WebGL не поддерживается на этом устройстве.</div>';
  throw new Error('WebGL not supported');
}

const vertexSource = `
attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec3 aColor;
uniform mat4 uProjection;
uniform mat4 uView;
uniform mat4 uModel;
uniform mat3 uNormalMatrix;
varying vec3 vColor;
varying vec3 vNormal;
varying vec3 vWorld;
void main() {
  vec4 world = uModel * vec4(aPosition, 1.0);
  vWorld = world.xyz;
  vColor = aColor;
  vNormal = normalize(uNormalMatrix * aNormal);
  gl_Position = uProjection * uView * world;
}`;

const fragmentSource = `
precision mediump float;
varying vec3 vColor;
varying vec3 vNormal;
varying vec3 vWorld;
uniform vec3 uLightDir;
uniform vec3 uAmbient;
void main() {
  float diffuse = max(dot(normalize(vNormal), normalize(-uLightDir)), 0.0);
  float rim = pow(1.0 - max(dot(normalize(vNormal), normalize(vec3(0.2, 0.8, 0.4))), 0.0), 2.0) * 0.12;
  vec3 color = vColor * (uAmbient + diffuse * vec3(0.68, 0.64, 0.55)) + rim;
  float fog = smoothstep(22.0, 56.0, length(vWorld.xz));
  color = mix(color, vec3(0.70, 0.86, 0.65), fog * 0.38);
  gl_FragColor = vec4(color, 1.0);
}`;

function shader(type, source) {
  const s = gl.createShader(type);
  gl.shaderSource(s, source);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}
function program(vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, shader(gl.VERTEX_SHADER, vs));
  gl.attachShader(p, shader(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  return p;
}

const prog = program(vertexSource, fragmentSource);
gl.useProgram(prog);

const loc = {
  pos: gl.getAttribLocation(prog, 'aPosition'),
  normal: gl.getAttribLocation(prog, 'aNormal'),
  color: gl.getAttribLocation(prog, 'aColor'),
  proj: gl.getUniformLocation(prog, 'uProjection'),
  view: gl.getUniformLocation(prog, 'uView'),
  model: gl.getUniformLocation(prog, 'uModel'),
  normalMatrix: gl.getUniformLocation(prog, 'uNormalMatrix'),
  lightDir: gl.getUniformLocation(prog, 'uLightDir'),
  ambient: gl.getUniformLocation(prog, 'uAmbient')
};

function m4Identity() { return [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]; }
function m4Perspective(fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2);
  const nf = 1 / (near - far);
  return [f/aspect,0,0,0, 0,f,0,0, 0,0,(far+near)*nf,-1, 0,0,(2*far*near)*nf,0];
}
function v3Sub(a,b){return [a[0]-b[0],a[1]-b[1],a[2]-b[2]]}
function v3Cross(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]}
function v3Norm(a){const l=Math.hypot(a[0],a[1],a[2])||1;return [a[0]/l,a[1]/l,a[2]/l]}
function m4LookAt(eye, center, up) {
  const z = v3Norm(v3Sub(eye, center));
  const x = v3Norm(v3Cross(up, z));
  const y = v3Cross(z, x);
  return [x[0],y[0],z[0],0, x[1],y[1],z[1],0, x[2],y[2],z[2],0, -dot(x,eye),-dot(y,eye),-dot(z,eye),1];
}
function dot(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]}
function m4Translate(x,y,z){return [1,0,0,0,0,1,0,0,0,0,1,0,x,y,z,1]}
function normalMatrixFromModel(m){return [m[0],m[1],m[2], m[4],m[5],m[6], m[8],m[9],m[10]]}

function cube(w, h, d, color) {
  const x=w/2,y=h/2,z=d/2;
  const faces = [
    [[-x,-y,z],[x,-y,z],[x,y,z],[-x,y,z],[0,0,1]],
    [[x,-y,-z],[-x,-y,-z],[-x,y,-z],[x,y,-z],[0,0,-1]],
    [[-x,y,z],[x,y,z],[x,y,-z],[-x,y,-z],[0,1,0]],
    [[-x,-y,-z],[x,-y,-z],[x,-y,z],[-x,-y,z],[0,-1,0]],
    [[x,-y,z],[x,-y,-z],[x,y,-z],[x,y,z],[1,0,0]],
    [[-x,-y,-z],[-x,-y,z],[-x,y,z],[-x,y,-z],[-1,0,0]]
  ];
  const data=[];
  for (const f of faces) {
    const [a,b,c,dv,n] = f;
    for (const p of [a,b,c,a,c,dv]) data.push(...p, ...n, ...color);
  }
  return new Float32Array(data);
}

function plane(size, color) {
  const s=size/2, n=[0,1,0];
  const pts=[[-s,0,-s],[s,0,-s],[s,0,s],[-s,0,-s],[s,0,s],[-s,0,s]];
  const data=[];
  for (const p of pts) data.push(...p,...n,...color);
  return new Float32Array(data);
}

function makeMesh(vertices) {
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
  return { buffer, count: vertices.length / 9 };
}

const meshes = {
  ground: makeMesh(plane(42, [0.43,0.68,0.34])),
  water: makeMesh(plane(13, [0.23,0.54,0.83])),
  block: makeMesh(cube(1,1,1,[0.55,0.39,0.23]))
};

const objects = [];
for (let x=-18;x<=18;x+=2){
  objects.push({mesh:'block', model:m4Translate(x,-0.51,-20), color:null});
  objects.push({mesh:'block', model:m4Translate(x,-0.51,20), color:null});
}
for (let z=-18;z<=18;z+=2){
  objects.push({mesh:'block', model:m4Translate(-20,-0.51,z), color:null});
  objects.push({mesh:'block', model:m4Translate(20,-0.51,z), color:null});
}

const camera = { yaw: -0.8, pitch: -0.72, dist: 32, target:[0,0,0], dragging:false, panning:false, lastX:0, lastY:0 };

function resetCamera(){ camera.yaw=-0.8; camera.pitch=-0.72; camera.dist=32; camera.target=[0,0,0]; }
document.getElementById('resetCamera').onclick = resetCamera;

let pinchStart = 0;
canvas.addEventListener('pointerdown', e => { camera.dragging=true; camera.panning=e.button===2 || e.shiftKey; camera.lastX=e.clientX; camera.lastY=e.clientY; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', e => {
  if(!camera.dragging) return;
  const dx=e.clientX-camera.lastX, dy=e.clientY-camera.lastY;
  if(camera.panning){ camera.target[0]-=dx*0.025; camera.target[2]+=dy*0.025; }
  else { camera.yaw-=dx*0.006; camera.pitch=Math.max(-1.25, Math.min(-0.25, camera.pitch-dy*0.004)); }
  camera.lastX=e.clientX; camera.lastY=e.clientY;
});
canvas.addEventListener('pointerup', e => { camera.dragging=false; });
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('wheel', e => { e.preventDefault(); camera.dist=Math.max(12,Math.min(60,camera.dist*(e.deltaY>0?1.08:0.92))); }, {passive:false});

canvas.addEventListener('touchmove', e => {
  if (e.touches.length === 2) {
    const a=e.touches[0], b=e.touches[1];
    const d=Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);
    if(pinchStart) camera.dist=Math.max(12,Math.min(60,camera.dist*(pinchStart/d)));
    pinchStart=d;
  }
}, {passive:false});
canvas.addEventListener('touchend', () => { pinchStart=0; });

function resize(){
  const dpr=Math.min(devicePixelRatio||1,2);
  const w=Math.floor(innerWidth*dpr), h=Math.floor(innerHeight*dpr);
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);}
}

function drawMesh(mesh, model) {
  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffer);
  const stride = 9 * 4;
  gl.enableVertexAttribArray(loc.pos); gl.vertexAttribPointer(loc.pos,3,gl.FLOAT,false,stride,0);
  gl.enableVertexAttribArray(loc.normal); gl.vertexAttribPointer(loc.normal,3,gl.FLOAT,false,stride,3*4);
  gl.enableVertexAttribArray(loc.color); gl.vertexAttribPointer(loc.color,3,gl.FLOAT,false,stride,6*4);
  gl.uniformMatrix4fv(loc.model,false,new Float32Array(model));
  gl.uniformMatrix3fv(loc.normalMatrix,false,new Float32Array(normalMatrixFromModel(model)));
  gl.drawArrays(gl.TRIANGLES,0,mesh.count);
}

function render(t){
  resize();
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);
  gl.clearColor(0.62,0.82,1.0,1);
  gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);

  const aspect=canvas.width/canvas.height;
  const proj=m4Perspective(Math.PI/4,aspect,0.1,120);
  const cp=Math.cos(camera.pitch), sp=Math.sin(camera.pitch);
  const eye=[camera.target[0]+Math.sin(camera.yaw)*cp*camera.dist, camera.target[1]-sp*camera.dist, camera.target[2]+Math.cos(camera.yaw)*cp*camera.dist];
  const view=m4LookAt(eye,camera.target,[0,1,0]);
  gl.uniformMatrix4fv(loc.proj,false,new Float32Array(proj));
  gl.uniformMatrix4fv(loc.view,false,new Float32Array(view));
  gl.uniform3fv(loc.lightDir,new Float32Array([-0.5,-1.0,-0.35]));
  gl.uniform3fv(loc.ambient,new Float32Array([0.48,0.50,0.45]));

  drawMesh(meshes.ground, m4Identity());
  drawMesh(meshes.water, m4Translate(7,0.02,6));
  for(const obj of objects) drawMesh(meshes[obj.mesh], obj.model);

  requestAnimationFrame(render);
}
requestAnimationFrame(render);
