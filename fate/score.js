/* Scroll time is longer along the blade; scene geometry keeps its cue space. */
(() => {
  "use strict";
  const ending = Object.freeze({ rain: 206, settled: 234, flatten: 244, flat: 252 });
  window.FateScore = Object.freeze({
    ending,
    length: ending.flat + 37,
    phase(cue) {
      if (cue < 116) return "ascension";
      if (cue < 128) return "void";
      if (cue < 146) return "fall";
      if (cue < 194) return "blade";
      if (cue < ending.rain) return "ground";
      if (cue < ending.settled) return "sword-rain";
      if (cue < ending.flat) return "sword-field";
      return "sword-horizon";
    },
    at(cue) {
      if (cue <= 85) return cue;
      if (cue < 96) return 85;
      if (cue <= 146) return cue - 11;
      if (cue <= 194) return 135 + (cue - 146) * 1.75;
      if (cue <= 206) return 219 + (cue - 194) * 2;
      return cue + 37;
    },
    cue(scroll) {
      if (scroll < 85) return scroll;
      if (scroll < 135) return scroll + 11;
      if (scroll < 219) return 146 + (scroll - 135) / 1.75;
      if (scroll < 243) return 194 + (scroll - 219) / 2;
      return scroll - 37;
    }
  });
})();
