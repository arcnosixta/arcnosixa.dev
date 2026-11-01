/* An alpha-only interpretation of the approved drawing. The original pixels
   remain unchanged on disk; no photograph/background RGB enters the material. */
(() => {
  'use strict';
  const vertex = `varying vec2 vUv;
    void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
  // Same noise basis and slow vertical advection as the thousand-hands material.
  const noise = `
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
    float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
    float fbm(vec2 p){return noise(p)*.57+noise(p*2.03)*.28+noise(p*4.07)*.15;}
  `;
  function dilate(source,w,h,radius=1) {
    const output=new Uint8Array(source.length);
    for(let y=radius;y<h-radius;y++)for(let x=radius;x<w-radius;x++){
      let on=0;for(let j=-radius;j<=radius&&!on;j++)for(let i=-radius;i<=radius;i++)if(source[(y+j)*w+x+i]){on=1;break;}
      output[y*w+x]=on;
    }
    return output;
  }
  function distances(mask,w,h,target) {
    const d=new Float32Array(mask.length),diagonal=Math.SQRT2;
    for(let i=0;i<d.length;i++)d[i]=mask[i]===target?0:1e6;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;let v=d[i];if(x)v=Math.min(v,d[i-1]+1);if(y){v=Math.min(v,d[i-w]+1);if(x)v=Math.min(v,d[i-w-1]+diagonal);if(x+1<w)v=Math.min(v,d[i-w+1]+diagonal);}d[i]=v;}
    for(let y=h-1;y>=0;y--)for(let x=w-1;x>=0;x--){const i=y*w+x;let v=d[i];if(x+1<w)v=Math.min(v,d[i+1]+1);if(y+1<h){v=Math.min(v,d[i+w]+1);if(x)v=Math.min(v,d[i+w-1]+diagonal);if(x+1<w)v=Math.min(v,d[i+w+1]+diagonal);}d[i]=v;}
    return d;
  }
  function masks(image) {
    const sourceWidth=1024,sourceHeight=1536,pad=96,w=sourceWidth+2*pad,h=sourceHeight+2*pad;
    const canvas=document.createElement('canvas');canvas.width=sourceWidth;canvas.height=sourceHeight;
    const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(image,0,0,sourceWidth,sourceHeight);
    const rgb=context.getImageData(0,0,sourceWidth,sourceHeight).data,ink=new Uint8Array(w*h),eyes=new Uint8Array(w*h);
    let eyeLeft=0,eyeRight=0;
    for(let y=0;y<sourceHeight;y++)for(let x=0;x<sourceWidth;x++){
      const s=(y*sourceWidth+x)*4,i=(y+pad)*w+x+pad,r=rgb[s],g=rgb[s+1],b=rgb[s+2];
      ink[i]=(.299*r+.587*g+.114*b)<145?1:0;
      // Blue iris pixels, in the two verified anatomical regions of this exact
      // approved image. No invented eye positions or white eye replacements.
      if(x>=400&&x<540&&y>=180&&y<230&&b>r+8&&b>g+2&&b>65){eyes[i]=1;if(x<470)eyeLeft++;else eyeRight++;}
    }
    if(eyeLeft<4||eyeRight<4)throw new Error('Approved blue iris regions were not found');
    // Close subpixel gaps in the ink outline, then flood only the background
    // connected to the image border. Enclosed face/lining becomes solid black;
    // open gaps between hair, sleeves and boots remain genuinely transparent.
    const closed=dilate(ink,w,h,2),outside=new Uint8Array(w*h),queue=new Int32Array(w*h);let head=0,tail=1;queue[0]=0;outside[0]=1;
    while(head<tail){const i=queue[head++],x=i%w;for(const n of [x?i-1:-1,x+1<w?i+1:-1,i>=w?i-w:-1,i+w<w*h?i+w:-1])if(n>=0&&!outside[n]&&!closed[n]){outside[n]=1;queue[tail++]=n;}}
    const filled=new Uint8Array(w*h);for(let i=0;i<filled.length;i++)filled[i]=outside[i]?0:1;
    const insideDistance=distances(filled,w,h,0),outsideDistance=distances(filled,w,h,1),eyeMask=dilate(eyes,w,h),eyeInside=distances(eyeMask,w,h,0),eyeOutside=distances(eyeMask,w,h,1),data=new Uint8Array(w*h*4);
    let bodyPixels=0;
    const encode=(value,range)=>Math.round(Math.max(0,Math.min(1,.5+value/range))*255);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const i=y*w+x,k=((h-1-y)*w+x)*4,body=(insideDistance[i]-outsideDistance[i]-2)/2;
      data[k]=encode(body,96);data[k+1]=encode((eyeInside[i]-eyeOutside[i])/2,48);data[k+2]=body>0?255:0;data[k+3]=255;if(body>0)bodyPixels++;
    }
    return {data,w,h,sourceWidth,sourceHeight,pad,stats:{eyeLeft,eyeRight,bodyPixels,backgroundPixels:w*h-bodyPixels},sample(x,y){return filled[(Math.round(y)+pad)*w+Math.round(x)+pad]}};
  }
  function create(T,image,own) {
    const mask=masks(image),texture=own(new T.DataTexture(mask.data,mask.w,mask.h,T.RGBAFormat));
    texture.minFilter=texture.magFilter=T.LinearFilter;texture.generateMipmaps=false;texture.needsUpdate=true;
    const uniforms={uMask:{value:texture},uTime:{value:0},uMotion:{value:1},uEyes:{value:1}};
    const material=own(new T.ShaderMaterial({uniforms,vertexShader:vertex,fragmentShader:`
      varying vec2 vUv;uniform sampler2D uMask;uniform float uTime,uMotion,uEyes;
      ${noise}
      void main(){
        float time=uTime*uMotion;
        float smoke=fbm(vUv*vec2(8.,15.)+vec2(time*.04,-time*.15));
        float curl=fbm(vUv*vec2(24.,4.)+vec2(smoke*.7,-time*.12));
        float anchored=smoothstep(.13,.28,vUv.y);
        vec2 drift=vec2(smoke-.5,noise(vUv*13.-time*.07)-.5)*.004*anchored;
        vec2 uv=clamp(vUv+drift,.001,.999);
        vec4 sampleMask=texture2D(uMask,uv);
        float d=(sampleMask.r-.5)*96.;
        float aa=max(.45,fwidth(d));
        float body=smoothstep(-aa,aa,d);
        float molten=fbm(vUv*vec2(12.,9.)+vec2(curl*.9+time*.028,-time*.085));
        float edgeWarp=(molten-.5)*15.*anchored;
        float outside=max(0.,-d+edgeWarp);
        float extent=smoothstep(-44.,-27.,d);
        float tendrils=smoothstep(.23,.74,molten+curl*.24);
        float aura=(1.-body)*extent*exp(-outside*.065)*(.44+tendrils*.48);
        // The dense body is black. A faint neutral reflection belongs only to
        // the outside aura, keeping black readable even against a dark scene.
        float silver=exp(-pow((outside-6.)/5.,2.))*(.003+.005*molten);
        float eyeDistance=(sampleMask.g-.5)*48.;
        float eyeFlow=fbm(uv*vec2(155.,95.)+vec2(time*.19,-time*.31));
        float core=smoothstep(-1.,1.,eyeDistance+(eyeFlow-.5)*1.6);
        float eyeBreath=.94+.06*sin(time*.9);
        float halo=exp(-max(0.,-eyeDistance)*.24)*smoothstep(-22.,-13.,eyeDistance);
        vec3 blue=mix(vec3(0.,.11,.48),vec3(0.,.42,1.),eyeFlow);
        vec3 eyeLight=blue*(core*(1.1+eyeFlow*.7)+halo*.28)*eyeBreath*uEyes;
        vec3 color=vec3(silver)*(1.-body)+eyeLight;
        float alpha=max(body,max(aura,halo*.2*uEyes));
        if(alpha<.002)discard;
        gl_FragColor=vec4(color,alpha);
        #include <encodings_fragment>
      }`,transparent:true,depthWrite:false,side:T.FrontSide,toneMapped:false,extensions:{derivatives:true}}));
    const height=148/(1440/1536),width=height*1024/1536;
    const geometry=own(new T.PlaneGeometry(width*mask.w/mask.sourceWidth,height*mask.h/mask.sourceHeight));
    return {material,geometry,uniforms,mask,stats:mask.stats};
  }
  window.FateBraveInk={create,masks};
})();
