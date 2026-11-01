(() => {
  'use strict';
  const clamp=x=>Math.max(0,Math.min(1,x)),ease=x=>{x=clamp(x);return x*x*x*(x*(x*6-15)+10)},mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t),lerp=(a,b,t)=>a+(b-a)*t;
  window.braveCameraPose=(progress,aspect,fov=42)=>{
    const W=window.BRAVE_WORLD,p=clamp(progress),portrait=aspect<.8;
    const halfHorizontal=Math.atan(Math.tan(fov*Math.PI/360)*aspect);
    const openingYaw=Math.min(Math.atan2(-150,82),Math.atan2(-(150+105.244/2),172)-halfHorizontal-.06);
    const footY=portrait?42:39,foot=[W.footprint[0],footY,W.footprint[2]];
    let camera,pitch=0,yaw=0,phase,slot=null;
    if(p<.34){
      // Aim at the same physical impression throughout the approach. The
      // former empty horizontal pan and late swivel made geography hard to read.
      const t=ease(p/.34),radius=Math.hypot(178,62)*(1-t),angle=Math.atan2(178,62)*(1-t),settle=ease(t/.30);
      camera=[foot[0]-radius*Math.sin(angle),lerp(49,footY,t),foot[2]+radius*Math.cos(angle)];
      pitch=-Math.atan2(camera[1]+.3,radius)*settle;
      const nearestArtYaw=Math.atan2(-(105.244/2-camera[0]),camera[2]+90);
      const safeYaw=Math.min(-angle,nearestArtYaw-halfHorizontal-(portrait?.10:aspect>2?.22:.18));
      const release=ease((Math.abs(pitch)*180/Math.PI-55)/30);
      yaw=lerp(openingYaw,lerp(safeYaw,-angle,release),settle);phase=p<.06?'move-right':'tilt-down';
    }else if(p<.44){camera=foot;pitch=-Math.PI/2;phase='brave';}
    else if(p<.55){
      const t=ease((p-.44)/.11),aimT=ease((p-.44)/.085);
      camera=mix(foot,[0,18,-16],t);const aim=mix([28,-.3,20],[0,18,-90],aimT);
      pitch=Math.atan2(aim[1]-camera[1],camera[2]-aim[2]);phase='footprint-to-boots';
    }else{
      const shoulderX=Math.max(38,60*Math.tan(fov*Math.PI/360)*aspect+1.5);
      const boots=[0,18,-16],arm=portrait?[-37,73,20]:[-45,76,-5],cross=portrait?[27,73,10]:[shoulderX,76,-30],shoulder=portrait?[27,107,10]:[shoulderX,108,-30],face=[0,W.eyeY,portrait?-14:-26];
      if(p<.64){camera=mix(boots,arm,ease((p-.55)/.09));phase='right-arm-approach';}
      else if(p<.70){camera=arm;phase='right-arm';slot={side:'left',rect:portrait?[.05,.29,.40,.32]:[.06,.30,.36,.34]};}
      else if(p<.77){camera=mix(arm,cross,ease((p-.70)/.07));phase='cross-to-left';}
      else if(p<.84){camera=mix(cross,shoulder,ease((p-.77)/.07));phase='left-shoulder-approach';}
      else if(p<.90){camera=shoulder;phase='left-shoulder';slot={side:'right',rect:portrait?[.56,.27,.39,.34]:[.60,.29,.34,.35]};}
      else {camera=mix(shoulder,face,ease((p-.90)/.10));phase='head';}
    }
    return {camera,pitch,yaw,phase,progress:p,slot};
  };
})();
