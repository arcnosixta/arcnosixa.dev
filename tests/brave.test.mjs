import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const require = createRequire(import.meta.url), T = require('../vendor/three.min.js');
const scope = {window:{}};
for (const file of ['brave-world','brave-camera']) runInNewContext(await readFile(new URL(`../fate/${file}.js`, import.meta.url),'utf8'),scope);
const pose = scope.window.braveCameraPose, world = scope.window.BRAVE_WORLD;

test('brave camera retraces the fixed clearing with continuous perspective and delayed eyes', () => {
  for (const [width,height] of [[1440,900],[390,844],[2560,1080]]) {
    const camera = new T.PerspectiveCamera(width<700?49:42,width/height,.1,1200);
    const apply = p => { const v=pose(p,camera.aspect,camera.fov); camera.position.fromArray(v.camera);camera.rotation.set(v.pitch,v.yaw,0,'YXZ');camera.updateMatrixWorld();return v; };
    const before=JSON.stringify(world), samples=[];
    for(let i=0;i<=1000;i++) {
      const p=i/1000; apply(p); samples.push([...camera.position.toArray(),...camera.quaternion.toArray()]);
      assert.ok(samples[i].every(Number.isFinite));
      assert.ok(camera.position.y>17,'camera remains above the soil');
      if(p>=.55&&p<.90){const eye=new T.Vector3(0,world.eyeY,-90).project(camera);assert.ok(Math.abs(eye.x)>1||Math.abs(eye.y)>1,'eyes stay outside the sleeve and shoulder passages');}
    }
    for(let i=1000;i>=0;i--){apply(i/1000);assert.deepEqual([...camera.position.toArray(),...camera.quaternion.toArray()],samples[i]);}
    assert.equal(JSON.stringify(world),before);
    for(const seam of [.34,.44,.55,.64,.70,.77,.84,.90]){apply(seam-1e-7);const position=camera.position.clone(),rotation=camera.quaternion.clone();apply(seam+1e-7);assert.ok(position.distanceTo(camera.position)<.001&&rotation.angleTo(camera.quaternion)<.001);}
    for(const p of [0,.55,.67,.87,1]){apply(p);assert.ok(Math.abs(camera.getWorldDirection(new T.Vector3()).y)<1e-9);}
    apply(.39);assert.ok(Math.abs(camera.getWorldDirection(new T.Vector3()).y+1)<1e-9);
  }
});

test('right sleeve and left shoulder reserve empty readable areas outside the character', () => {
  for(const [width,height] of [[1440,900],[390,844]]){
    const camera=new T.PerspectiveCamera(width<700?49:42,width/height,.1,1200);
    for(const [p,anchor,side] of [[.67,world.arm,'left'],[.87,world.shoulder,'right']]){
      const v=pose(p,camera.aspect,camera.fov);camera.position.fromArray(v.camera);camera.rotation.set(v.pitch,v.yaw,0,'YXZ');camera.updateMatrixWorld();
      const point=new T.Vector3(...anchor).project(camera),x=(point.x+1)/2,y=(1-point.y)/2,[left,top,w,h]=v.slot.rect;
      assert.equal(v.slot.side,side);assert.ok(w*width>=150);assert.ok(x>0&&x<1&&y>0&&y<1);assert.ok(x<left||x>left+w||y<top||y>top+h);
    }
  }
});

test('the main route loads the exact approved static art and retains the blade notes and ending', async () => {
  const art=await readFile(new URL('../assets/fate/brave-boy-approved.png',import.meta.url));
  assert.equal(createHash('sha256').update(art).digest('hex'),'3919f24d9d40a8cd9d3cd0a9ef277cc2f997e0ad4e9dc99bece1ac7dbe479a6e');
  const runtime=await readFile(new URL('../fate/fate.js',import.meta.url),'utf8'),html=await readFile(new URL('../fate/index.html',import.meta.url),'utf8');
  assert.doesNotMatch(runtime,/script\([^\n]*(?:GLTFLoader|witness\.js|witness-camera)/);
  for(const name of ['note-architecture','note-services','note-craft','revelation'])assert.ok(html.includes(name));
  assert.match(html,/id="brave-text-space"[^>]*><\/div>/);
  assert.equal((html.match(/class="still-scene still-brave /g)||[]).length,7);
  assert.doesNotMatch(html,/witness-(?:foot|back|face)(?:-mobile)?\.png/);
});
