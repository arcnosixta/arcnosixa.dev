# FATE visual assets

The initial newborn and hand plates were created for this repository with the built-in Imagegen tool on 2026-10-31. Source PNG alpha channels are preserved.

- `newborn.png` — 1536 × 1024 RGBA; sleeping newborn wrapped in ivory linen; current character silhouette source. Only its alpha channel is rendered: the character starts as solid black with emissive eyes and mouth, then becomes featureless white light. Skin, face and fabric RGB are never shown.
- `child.png` — 1024 × 1536 RGBA; earlier standing-child concept, retained for provenance and no longer used in the page.
- `hands-atlas.png` — 1254 × 1254 RGBA; four distinct sculptural hand poses in a 2 × 2 atlas, 0.77 MB. Only alpha is rendered; skin RGB is replaced with procedural deep-blue smoke.
- `congregation.png` — 1672 × 941 RGB; distant hand congregation, 1.73 MB. Blurred, thresholded luminance supplies a mass mask for dark blue mist, suppressing anatomical shading.

The scene uses image plates in a Three.js perspective camera, 72 or 192 instanced hand quads, procedural blade geometry, GLSL reveal/edge glow, particles and atmospheric light. The newborn and hands are not fully rigged 3D models; view angles are intentionally restrained to preserve the artwork. This is a deliberate depth-layered art direction, not a claim of 1,000 individually modeled hands.

The musical recording has separate provenance: it was provided locally by the site owner and is included unchanged in the repository and site build at their request. Playback is scoped to FATE. See the project README for autoplay behavior.

## Exact generation prompts

### Runtime silhouette treatment

The generated PNG remains unchanged. A smooth alpha threshold removes its original soft halo; the Three.js material renders a flat black silhouette, with three white apertures aligned to the newborn's pose. During score 71.5–79.5 (in scene cues) the fill becomes fully white and the eye/mouth apertures dissolve into it. A separate animated smoke pass samples the same contour, following the infant's breathing and rise. The still/reduced-motion version uses the same alpha silhouette through SVG filters and preserves both narrative states. No additional image generation was needed for this treatment.

### Runtime spectral hands

The original hand atlas remains unchanged. Its alpha channel defines the poses; no skin, veins or original lighting are sampled. Each instance is filled with slowly moving ink-blue noise and smoke strands. Nearby alpha samples soften the contour into vapor, while restrained edge light feeds the shared bloom pass. Lower forearms dissolve into the void, and slight vertex drift preserves the supporting fingertips. The distant congregation uses a blurred luminance threshold as its shape, recolored in dark blue smoke. The static/reduced-motion scene uses an SVG mask, solid blue fill and diffused rim, keeping the same direction without WebGL or animation. FATE retains its separate soundtrack and cold, oppressive atmosphere; these effects do not load on the Creation homepage.

### Continuous ascension (procedural, 2026-11-01)

The initial ascension and liquid transition use the original plates and procedural shaders. The former chapter title and its 11-score hold are removed. The scroll score ends at 297; the geometry cues extend to 260. At scroll85 the renderer continues at internal96 with the same clamped pose and persistent character opacity, so the fading flash flows directly into the dissolving hands. A seeded sample of their atlas alpha supplies ash origins; the ash vertex shader shares the dissolution field and follows reversible scroll trajectories. All figures disappear by scroll105. A completely empty white interval remains until117. The supplied FATE recording continues independently of scroll position.

### Liquid white world (procedural, 2026-11-01)

At the dissolution, the newborn's silhouette aura expands and brightens. A domain-warped, noise-distorted arrival field grows from the infant's camera projection. Its uneven edge advances during scroll90–105, leaving white behind. Screen aspect ratio keeps the liquid lobes proportional. Figures fade as the field finishes, leaving a pure white canvas. Noise coordinates do not depend on clock time, so scrubbing backward retraces the same front. Static SVG/CSS scenes retain an irregular white field and a blank white interval. All raster assets and the FATE soundtrack remain unchanged.

### Katana and black meadow (procedural, 2026-11-01)

`fate/katana.js` builds a narrow curved shinogi blade with an angular kissaki, yokote, charcoal steel facets and fine crimson inlay. The user's supplied anime katana reference guides the open four-hook guard, red tsuka underwrap, raised black crossing bands, fittings and a draped chain made from individually modeled alternating links. The reference image itself is not shipped. The katana falls during scroll117–135; the monumental blade fills the frame before the extended reading passage. The enlarged blade reading pass occupies scroll135–219, leaving the right side open for factual notes from the main portfolio. The blade is scaled to twice its former size and settled eight world units below the earth, burying most of the kissaki. Terrain is fully present and opaque before it enters the frame. During the notes, an upward camera angle keeps the meadow and ground out of view; the subsequent camera descent reveals the already existing surface. A shared reversible `fate/score.js` map gives the reading passage 84 scroll units instead of 48 and the ground approach 24 instead of 12. `fate/grove.js` now supplies a treeless meadow: dense individually curved grass ribbons and sparse bent seed heads over irregular black earth. Three merged meshes replace all tree, branch, shrub and fern geometry.

`reference-katana.svg` is the vector projection used for the still blade and its reading passage.

### A thousand blades

The falling swords and flat horizon share nine original contours in `fate/sword-profiles.js`. Curves and guards draw on the supplied illustrations and The Met's [katana](https://www.metmuseum.org/art/collection/search/21893), [tachi](https://www.metmuseum.org/art/collection/search/24369), [naginata](https://www.metmuseum.org/art/collection/search/24448), [ken](https://www.metmuseum.org/art/collection/search/22090) and [two-handed sword](https://www.metmuseum.org/art/collection/search/35388).

At scroll 243, falling swords enter behind the hero katana. Each lands tip first and embeds below the sampled terrain. The camera retreats as the materials fade to black. From scroll 281 to 289, the projected ground line meets the SVG seam. The full-screen vector scene has a 35% white sky and 65% black ground and includes exactly 1,000 sword instances. It also appears in the illustrated story. Rebuild the vector with `node scripts/generate-sword-horizon.mjs`.
