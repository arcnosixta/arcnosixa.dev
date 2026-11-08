/* Normalized sword profiles. The tip starts at [0, 0] and the pommel reaches y=1.
   Profile IDs retain their assignments in the field and the rain sequence. */
(() => {
  "use strict";

  function blade(stations) {
    // Each station is [height, spine, cutting edge]. The first station makes
    // the angular kissaki, and the wider spacing above it describes the curve.
    return [[0, 0], ...stations.map(([y, , edge]) => [edge, y]),
      ...stations.slice().reverse().map(([y, spine]) => [spine, y])];
  }

  function guard(x, y, width, wing = 0) {
    return [[x - width * .5, y + wing], [x - width * .32, y - .012],
      [x + width * .32, y - .012], [x + width * .5, y + wing],
      [x + width * .39, y + .014 + wing], [x + width * .23, y + .014],
      [x - width * .23, y + .014], [x - width * .39, y + .014 + wing]];
  }

  function handle(x, base, width, sweep = 0, wrapped = false) {
    const top = x + sweep;
    return {
      grip: [[x - width / 2, base], [x + width / 2, base], [top + width * .44, .981], [top - width * .44, .981]],
      pommel: [[top - width * .55, .97], [top + width * .55, .97], [top + width * .55, .99],
        [top + width * .41, 1], [top - width * .41, 1], [top - width * .55, .99]],
      wrap: wrapped ? { x, top, base, width } : undefined,
    };
  }

  const profiles = [
    {
      id: "katana",
      blade: blade([[.067, -.008, .017], [.14, -.005, .032], [.27, .004, .045], [.43, .014, .054],
        [.61, .022, .06], [.79, .026, .062], [.815, .027, .062]]),
      guard: guard(.045, .815, .106, .004),
      ...handle(.045, .824, .031, -.007, true),
    },
    {
      id: "tachi",
      blade: blade([[.057, -.006, .018], [.13, .002, .03], [.26, .021, .055], [.44, .05, .09],
        [.62, .071, .11], [.799, .084, .121]]),
      guard: guard(.103, .799, .098),
      ...handle(.103, .808, .029, -.013),
    },
    {
      id: "short-cleaver",
      blade: blade([[.068, -.016, .031], [.129, -.015, .047], [.24, -.01, .051], [.42, -.001, .058],
        [.63, .01, .063], [.799, .021, .067]]),
      guard: guard(.044, .799, .115, .006),
      ...handle(.044, .808, .035, -.005),
    },
    {
      id: "hooked-cleaver",
      blade: blade([[.062, -.009, .028], [.149, -.004, .048], [.29, .007, .067], [.47, .025, .081],
        [.64, .041, .092], [.805, .049, .097]]),
      guard: [[.005, .788], [.029, .799], [.116, .799], [.141, .788], [.131, .815], [.106, .826], [.04, .826], [.013, .815]],
      ...handle(.073, .816, .031, -.007),
    },
    {
      id: "chained-cleaver",
      blade: blade([[.08, -.014, .025], [.17, -.01, .04], [.32, .006, .056], [.52, .024, .071],
        [.7, .041, .084], [.816, .047, .088]]),
      guard: guard(.068, .816, .112, .008),
      ...handle(.068, .825, .031, -.008, true),
      ornament: [[.076, .977], [.103, .948], [.127, .906], [.147, .854], [.158, .795], [.158, .745],
        [.149, .69], [.127, .637], [.096, .598], [.092, .604], [.121, .641], [.142, .693],
        [.151, .746], [.151, .794], [.14, .853], [.121, .904], [.098, .944], [.071, .972]],
    },
    {
      id: "angular-cleaver",
      blade: blade([[.076, -.011, .029], [.132, -.013, .049], [.31, 0, .056], [.56, .019, .067], [.81, .035, .081]]),
      guard: guard(.058, .81, .109, .012),
      ...handle(.058, .819, .033, -.004),
    },
    {
      id: "naginata",
      blade: blade([[.059, -.007, .018], [.136, -.001, .033], [.253, .012, .055], [.406, .027, .071],
        [.553, .042, .082], [.698, .052, .089]]),
      guard: guard(.071, .698, .093, .006),
      ...handle(.071, .707, .027, -.007),
    },
    {
      id: "ken",
      blade: blade([[.091, -.022, .022], [.35, -.026, .026], [.68, -.025, .025], [.809, -.021, .021]]),
      guard: guard(0, .809, .115, .012),
      ...handle(0, .818, .033),
    },
    {
      id: "greatsword",
      blade: blade([[.075, -.019, .034], [.16, -.018, .052], [.31, -.006, .063], [.51, .013, .074],
        [.68, .025, .087], [.825, .039, .098]]),
      guard: guard(.069, .825, .132, .01),
      ...handle(.069, .834, .036, -.009),
    },
  ];

  const api = { profiles };
  if (typeof module === "object" && module.exports) module.exports = api;
  else window.FateSwordProfiles = api;
})();
