(() => {
  'use strict';
  // One fixed world shared by camera, ground, props and verification. Positions
  // are centimetre-like units; no scroll-dependent relocation or rescaling.
  window.BRAVE_WORLD=Object.freeze({
    sword:Object.freeze([0,-8,0]), footprint:Object.freeze([28,0,20]),
    boy:Object.freeze([0,0,-90]), boyHeight:148, eyeY:127.2,
    arm:Object.freeze([-22,76,-90]), shoulder:Object.freeze([15,113,-90]),
    landmarks:Object.freeze([
      Object.freeze({name:'split-stone',position:[11,.36,6],scale:[2.5,.75,1.4]}),
      Object.freeze({name:'pale-chip',position:[22,.18,6],scale:[1.2,.4,.8]}),
      Object.freeze({name:'heel-stone',position:[39,.26,28],scale:[1.7,.55,1.1]})
    ])
  });
})();
