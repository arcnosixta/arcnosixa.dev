# vendor

Сторонние файлы живут здесь и не редактируются.

## GSAP / ScrollTrigger 3.15.0

- `gsap.min.js`, `ScrollTrigger.min.js` — локальные UMD-сборки, работают без CDN и сборщика.
- Источники: https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js и https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/ScrollTrigger.min.js
- Лицензия: https://gsap.com/standard-license/ (заголовки сохранены).
- Используются в `cinematic.js`: вступление, параллакс, главы и раскрытие деталей.

## three.min.js

- three.js r147 (`REVISION === "147"`), UMD-сборка `build/three.min.js`
- Источник: https://unpkg.com/three@0.147.0/build/three.min.js
- Лицензия: MIT, Copyright 2010-2022 Three.js Authors (заголовок сохранён в файле)
- Почему r147: начиная с r160 three.js не публикует UMD-сборки, а ES-модули не
  работают по `file://` (CORS). UMD держит проект без сборщиков и без CDN.

Обновление: положить новую UMD-сборку, проверить `THREE.REVISION` и сцену в
`scene3d.js`, затем обновить версию в этом файле и в `README.md` репозитория.
