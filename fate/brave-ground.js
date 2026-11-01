/* Procedural earth relief, not a screen label or replacement character art. */
(() => {
  'use strict';
  window.makeBraveFootprint = (T, scene, compact) => {
    const W=window.BRAVE_WORLD,size=40,res=512,centre={x:W.footprint[0],z:W.footprint[2]},angle=.25,resources=[];
    const own=r=>(resources.push(r),r),group=new T.Group();group.name='brave-ground-relief';scene.add(group);
    function layer(){const c=document.createElement('canvas');c.width=c.height=res;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.fillStyle='#000';ctx.fillRect(0,0,res,res);ctx.translate(res/2,res/2);ctx.scale(res/size,res/size);ctx.rotate(-angle);ctx.fillStyle=ctx.strokeStyle='#fff';return {c,ctx};}
    const sole=layer(),s=sole.ctx;
    s.beginPath();s.moveTo(-1.9,10.2);s.bezierCurveTo(-4,8.6,-2.9,3.3,-3.0,.4);s.bezierCurveTo(-4.6,-2.0,-4.7,-5.6,-3.3,-7.2);s.bezierCurveTo(-1.6,-8.7,2.8,-8.3,4.0,-5.9);s.bezierCurveTo(5,-3.8,3.5,-.8,2.4,2.7);s.bezierCurveTo(1.6,5.0,3.3,8.5,1.6,10.5);s.bezierCurveTo(.8,11.5,-.7,11.4,-1.9,10.2);s.fill();
    for(const [x,z,rx,rz] of [[-2.9,-10.0,1.40,1.60],[-.35,-10.4,1.08,1.30],[1.75,-9.9,.88,1.13],[3.35,-8.8,.74,.96],[4.35,-7.4,.62,.80]]){s.beginPath();s.ellipse(x,z,rx,rz,-.1,0,Math.PI*2);s.fill();}
    const letters=layer(),l=letters.ctx;l.translate(-3.45,-2.0);l.scale(.150,.150);l.lineWidth=1.4;l.lineCap=l.lineJoin='round';
    const writing=new Path2D('M 0 3 C 1 -2 2 -11 2 -14 C 2 -18 -1 -16 -1 -12 L 0 3 C 2 -4 8 -5 8 -1 C 8 3 3 4 1 2 M 9 3 L 11 -5 M 10 -2 C 14 -8 16 -5 16 -3 M 25 -4 C 21 -8 16 -3 18 2 C 20 5 24 1 25 -4 L 24 3 M 27 -4 L 29 3 C 32 1 34 -1 35 -5 M 38 -1 C 45 -2 44 -6 40 -5 C 35 -3 35 3 40 3 C 43 3 45 1 45 0');l.stroke(writing);
    const soft=document.createElement('canvas');soft.width=soft.height=res;const softCtx=soft.getContext('2d',{willReadFrequently:true});softCtx.filter='blur(1.8px)';softCtx.drawImage(sole.c,0,0);
    const mask=softCtx.getImageData(0,0,res,res).data,grooves=letters.ctx.getImageData(0,0,res,res).data;
    function sample(data,x,z){const u=Math.max(0,Math.min(res-1,(x/size+.5)*(res-1))),v=Math.max(0,Math.min(res-1,(z/size+.5)*(res-1))),a=Math.floor(u),b=Math.floor(v),u1=Math.min(a+1,res-1),v1=Math.min(b+1,res-1),fx=u-a,fz=v-b;return ((data[(b*res+a)*4]*(1-fx)+data[(b*res+u1)*4]*fx)*(1-fz)+(data[(v1*res+a)*4]*(1-fx)+data[(v1*res+u1)*4]*fx)*fz)/255;}
    const hash=(x,z)=>{const n=Math.sin(x*127.1+z*311.7)*43758.5453123;return n-Math.floor(n)};
    function noise(x,z){const a=Math.floor(x),b=Math.floor(z);let u=x-a,v=z-b;u=u*u*(3-2*u);v=v*v*(3-2*v);return (hash(a,b)*(1-u)+hash(a+1,b)*u)*(1-v)+(hash(a,b+1)*(1-u)+hash(a+1,b+1)*u)*v;}
    const height=(x,z)=>{const edge=Math.max(0,Math.min(1,(20-Math.max(Math.abs(x),Math.abs(z)))/2));const f=sample(mask,x,z),g=sample(grooves,x,z);return ((noise(x*2,z*2)-.5)*.10*(1-f*.55)-f*(.48+noise(x*.8,z*.8)*.16)-g*.24)*edge;};
    const geo=own(new T.PlaneGeometry(size,size,compact?256:320,compact?256:320));geo.rotateX(-Math.PI/2);const p=geo.attributes.position,colors=[];
    const base=new T.Color(0x515661).convertSRGBToLinear();
    for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),f=sample(mask,x,z),g=sample(grooves,x,z);p.setY(i,height(x,z));const shade=1-f*.18-g*.32;colors.push(base.r*shade,base.g*shade,base.b*shade);}
    // Interpolate the actual two triangles of each relief grid cell. Grass
    // roots meet the rendered earth, including the patch's small soil noise.
    function surfaceHeight(x,z){
      x-=centre.x;z-=centre.z;if(Math.abs(x)>=20||Math.abs(z)>=20)return 0;
      const n=compact?256:320,gx=(x+20)/size*n,gz=(z+20)/size*n,ix=Math.floor(gx),iz=Math.floor(gz),fx=gx-ix,fz=gz-iz;
      const a=iz*(n+1)+ix,h00=p.getY(a),h10=p.getY(a+1),h01=p.getY(a+n+1),h11=p.getY(a+n+2);
      return fx+fz<=1?h00*(1-fx-fz)+h10*fx+h01*fz:h11*(fx+fz-1)+h01*(1-fx)+h10*(1-fz);
    }
    geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.computeVertexNormals();const mat=own(new T.MeshStandardMaterial({vertexColors:true,roughness:.94,metalness:0})),relief=new T.Mesh(geo,mat);relief.position.set(centre.x,0,centre.z);relief.name='human-footprint-with-carved-brave';relief.receiveShadow=true;group.add(relief);
    // Four surrounding slabs leave an actual hole: the flat ground never fills
    // the depressed footprint or lettering. Patch boundaries meet exactly at y=0.
    const groundMat=own(new T.MeshStandardMaterial({color:base,roughness:.96}));
    // A single world-space soil pattern spans both the carved patch and the
    // surrounding ground. It provides perspective cues during the return tilt.
    function earth(material){material.onBeforeCompile=shader=>{
      shader.vertexShader='varying vec3 earthWorld;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nearthWorld = (modelMatrix * vec4(position,1.0)).xyz;');
      shader.fragmentShader=`varying vec3 earthWorld;
float earthHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float earthNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(earthHash(i),earthHash(i+vec2(1.,0.)),f.x),mix(earthHash(i+vec2(0.,1.)),earthHash(i+vec2(1.,1.)),f.x),f.y);}
`+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
float coarse = earthNoise(earthWorld.xz * .25);
float fine = earthNoise(earthWorld.xz * 5.);
float grit = earthNoise(earthWorld.xz * 17.);
diffuseColor.rgb *= .81 + coarse*.27 + (fine-.5)*.16 + (grit-.5)*.08;`);
    };}
    earth(mat);earth(groundMat);
    function ground(x,z,w,d){const mesh=new T.Mesh(own(new T.PlaneGeometry(w,d)),groundMat);mesh.rotation.x=-Math.PI/2;mesh.position.set(x,0,z);mesh.receiveShadow=true;group.add(mesh);}
    const lo=-600,hi=600,x0=centre.x-20,x1=centre.x+20,z0=centre.z-20,z1=centre.z+20;
    ground(0,(lo+z0)/2,1200,z0-lo);ground(0,(z1+hi)/2,1200,hi-z1);ground((lo+x0)/2,centre.z,x0-lo,40);ground((x1+hi)/2,centre.z,hi-x1,40);
    // Persistent physical landmarks make the short sword-to-footprint interval
    // recognizable while perspective changes. They never follow the camera.
    const stoneMat=own(new T.MeshStandardMaterial({color:new T.Color(0x1c2330).convertSRGBToLinear(),roughness:1}));
    for(const [i,mark] of W.landmarks.entries()){const stone=new T.Mesh(own(new T.IcosahedronGeometry(1,0)),stoneMat);stone.position.fromArray(mark.position);stone.scale.fromArray(mark.scale);stone.rotation.set(.1,i*.8,.15);stone.name=mark.name;stone.castShadow=stone.receiveShadow=true;group.add(stone);}
    // Densely occupied cells form ink-black grass around one continuous worn
    // clearing. Roots stay at the same terrain level at both quality settings.
    let seed=64721;const rand=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296};const tiles=new Map();
    function segmentDistance(x,z,ax,az,bx,bz){const dx=bx-ax,dz=bz-az,t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz)));return Math.hypot(x-ax-dx*t,z-az-dz*t);}
    function clear(x,z){return Math.hypot(x/9,z/9)<1||Math.hypot((x-28)/14,(z-20)/19)<1||segmentDistance(x,z,0,0,28,20)<8||segmentDistance(x,z,28,20,0,-90)<18||Math.hypot(x/62,(z+90)/20)<1;}
    const step=compact?1.8:1.4;
    for(let xx=-170;xx<170;xx+=step)for(let zz=-180;zz<160;zz+=step){const x=xx+(rand()-.5)*step,z=zz+(rand()-.5)*step;if(clear(x,z))continue;const key=Math.floor((x+170)/64)+":"+Math.floor((z+180)/64);if(!tiles.has(key))tiles.set(key,[]);const blades=tiles.get(key);for(let b=0;b<2;b++){const h=2.2+rand()*4.7,w=.12+rand()*.14,ang=rand()*Math.PI,dx=Math.cos(ang)*w,dz=Math.sin(ang)*w,bx=(rand()-.5)*h*.6,bz=(rand()-.5)*h*.6;const root=surfaceHeight(x,z),a=[x-dx,surfaceHeight(x-dx,z-dz)-.025,z-dz],c=[x+dx,surfaceHeight(x+dx,z+dz)-.025,z+dz],d=[x+bx*.4-dx*.5,root+h*.65,z+bz*.4-dz*.5],e=[x+bx*.4+dx*.5,root+h*.65,z+bz*.4+dz*.5],tip=[x+bx,root+h,z+bz];blades.push(...a,...c,...d,...c,...e,...d,...d,...e,...tip);}}
    // Static spatial tiles let the camera cull grass outside the footprint view.
    // Density and each blade's root remain identical to the approved prototype.
    const grassMaterial=own(new T.MeshBasicMaterial({color:new T.Color(0x06070b).convertSRGBToLinear(),side:T.DoubleSide}));
    for(const [key,blades] of tiles){const grassGeo=own(new T.BufferGeometry());grassGeo.setAttribute('position',new T.Float32BufferAttribute(blades,3));grassGeo.computeBoundingSphere();const grass=new T.Mesh(grassGeo,grassMaterial);grass.name='rooted-clearing-grasses-'+key;group.add(grass);}
    return {group,relief,centre,angle,footLength:23,word:'brave',height,surfaceHeight,maskAt:(x,z)=>sample(mask,x,z),grooveAt:(x,z)=>sample(grooves,x,z),dispose(){group.removeFromParent();resources.forEach(r=>r.dispose());}};
  };
})();
