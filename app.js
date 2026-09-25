const I18N = {
  ru: {
    "a11y.skip": "К содержанию",
    "nav.about": "Обо мне",
    "nav.skills": "Навыки",
    "nav.work": "Проекты",
    "nav.path": "Путь",
    "nav.contact": "Контакты",
    "hero.status": "Открыт к проектам и стажировкам",
    "hero.hi": "Привет, я",
    "hero.roleLabel": "Роль:",
    "hero.lead":
      "Делаю интерфейсы, которые не стыдно показать: React-приложения, локальные инструменты для работы с ИИ-агентами и мобильные продукты с упором на производительность и детали.",
    "hero.ctaWork": "Смотреть проекты",
    "hero.ctaContact": "Написать мне",
    "hero.nowLabel": "Сейчас",
    "hero.now":
      "Полирую Ciel: локальный мост к OpenCode, SSE-стримы и аккуратная типографика",
    "hero.stackLabel": "Стек",
    "hero.stack": "React 19 · Vite · TypeScript · Node · Flutter · Supabase",
    "hero.focusLabel": "Фокус",
    "hero.focus": "Продуктовый фронтенд, локальные сервисы, интеграции ИИ-агентов",
    "hero.scroll": "скролл",
    "about.title": "Обо мне",
    "about.p1":
      "Я frontend-разработчик, которому нравится доводить продукты до конца: от структуры данных и API до анимаций, состояния загрузки и текста ошибки.",
    "about.p2":
      "Большую часть времени работаю с React: собираю интерфейсы, поднимаю локальные сервисы, пишу логику на Node, прикручиваю ИИ-агентов к рабочим инструментам. Отдельно люблю мобильную разработку на Flutter и Telegram Mini Apps.",
    "about.p3":
      "Ценю простые решения без лишних зависимостей, читаемый код и то, что продукт остаётся понятным после того, как я перестал его трогать.",
    "about.stat1": "проектов в портфолио",
    "about.stat2": "года коммерческой разработки",
    "about.stat3": "языка интерфейса в проектах",
    "about.stat4": "платформы: web, mobile, desktop",
    "skills.title": "Навыки",
    "work.title": "Проекты",
    "path.title": "Путь",
    "contact.title": "Контакты",
    "contact.lead":
      "Открыт к фронтенд-проектам, стажировкам и задачам, где нужен аккуратный интерфейс и надёжная интеграция с ИИ. Пишите — отвечаю быстро.",
    "contact.note": "Обычно отвечаю в течение дня. Люблю задачи с реальными пользователями.",
    "footer.built": "Сделано вручную: HTML, CSS, немного JavaScript",
    "work.featured": "Главный",
    "work.highlights": "Что внутри",
    "work.metrics": "Цифры",
    "work.code": "Код",
    "work.demo": "Демо",
    "work.more": "Ещё проекты",
    "work.lab": "Лаборатория и учебные",
    "work.lessons": "Учебные и pet-проекты",
    "skills.note.frontend": "Компонентный подход, состояние, анимации, доступность",
    "skills.note.backend": "Локальные API, SSE-стримы, безопасность, без лишних абстракций",
    "skills.note.mobile": "Кроссплатформенные приложения, Supabase, криптография на клиенте",
    "skills.note.ai": "LLM-интеграции, MCP, агенты, вопросы и разрешения",
    "skills.note.design": "Сетки, типографика, тёмные темы, дизайн-токены",
    "skills.note.flow": "Vite, TypeScript, линтеры, тесты, CI",
    "skills.frontend": "Frontend",
    "skills.backend": "Сервисы и API",
    "skills.mobile": "Мобильная разработка",
    "skills.ai": "ИИ и агенты",
    "skills.design": "Интерфейс и дизайн",
    "skills.flow": "Инструменты и процесс",
    "typed": [
      "Frontend-разработчик",
      "React-инженер",
      "Проектирую интерфейсы",
      "Поднимаю локальные сервисы",
    ],
    "skillsList": {
      frontend: ["React 19", "TypeScript", "Hooks", "Vite", "React Router", "Motion"],
      backend: ["Node.js", "Express", "REST / JSON", "SSE", "PostgreSQL", "Neo4j"],
      mobile: ["Flutter", "Dart", "Supabase", "Firebase", "FCM", "Crypto"],
      ai: ["OpenCode", "LLM-агенты", "MCP", "OpenRouter", "Промпты", "RAG"],
      design: ["Figma", "Design tokens", "CSS Grid", "Dark UI", "Анимации", "A11y"],
      flow: ["Vite", "TypeScript", "Oxlint", "Vitest", "node:test", "Git"],
    },
    "projectsList": [
      {
        key: "ciel",
        featured: true,
        accent: "#d8f26c",
        year: "2026",
        title: "Ciel",
        titleEn: "Ciel",
        tagline: "Локальное рабочее пространство для ИИ-агента",
        taglineEn: "A local-first workspace for an AI coding agent",
        desc: "Спокойная оболочка вокруг локальной установки OpenCode: пространства, файлы, память, плейбуки и подключённый агент с сессиями, стримингом, моделями, инструментами, разрешениями и диффами.",
        descEn:
          "A calm shell around a local OpenCode install: spaces, files, memory, playbooks and a connected agent with sessions, streaming, models, tools, permissions and diffs.",
        points: [
          "React 19 + Vite, тёмная тема, i18n RU/KZ, адаптив",
          "Локальный мост на Node: JSON/SSE-прокси к серверу OpenCode",
          "Проверки Host/Origin, биндинг только на loopback",
          "Нормализация событий сессии, вопросы агенту, восстановление pending-вопросов",
          "Тесты на node:test, линтинг Oxlint",
        ],
        pointsEn: [
          "React 19 + Vite, dark theme, RU/KZ i18n, responsive",
          "Node bridge: JSON/SSE proxy to the OpenCode server",
          "Host/Origin checks, loopback-only binding",
          "Session event normalization, agent questions, pending-question restore",
          "node:test suites, Oxlint",
        ],
        metrics: [
          ["~40", "событий сессии нормализовано"],
          ["2", "потока: JSON и SSE"],
          ["RU/KZ", "локализация интерфейса"],
        ],
        links: [{ label: "Живой сайт", labelEn: "Live site", href: "https://ciel-flax.vercel.app" }],
      },
      {
        key: "esep",
        accent: "#f49a70",
        year: "2025—2026",
        title: "ESEP",
        titleEn: "ESEP",
        tagline: "Оценка недвижимости: Flutter + Supabase",
        taglineEn: "Real-estate appraisal: Flutter + Supabase",
        desc: "Платформа для оценки объектов: заявки, кабинеты оценщика и компании, документы, отчёты, платежи, интеграция с egov и подпись документов.",
        descEn:
          "An appraisal platform: requests, appraiser and company dashboards, documents, reports, payments, egov integration and document signing.",
        points: [
          "Flutter 3 для Android, iOS, Web, desktop",
          "Supabase: Auth, RLS для каждой роли, миграции SQL",
          "Криптография на клиенте, secure storage, local auth",
          "ИИ-модуль: разбор и проверка подписи, чат по делу",
          "Push-уведомления, платежи, deploy-скрипт",
        ],
        pointsEn: [
          "Flutter 3 for Android, iOS, Web, desktop",
          "Supabase: Auth, per-role RLS, SQL migrations",
          "Client-side crypto, secure storage, local auth",
          "AI module: signature parsing and verification, case chat",
          "Push notifications, payments, deploy script",
        ],
        metrics: [
          ["6", "платформ из одной кодовой базы"],
          ["24+", "экранов и сценариев"],
          ["RLS", "изоляция данных по ролям"],
        ],
        links: [],
      },
      {
        key: "tradepro",
        accent: "#a8c9ff",
        year: "2025",
        title: "TradePro",
        titleEn: "TradePro",
        tagline: "Telegram Mini App для трейдеров",
        taglineEn: "A Telegram Mini App for traders",
        desc: "Приложение внутри Telegram: дашборд, сигналы и разбор сделок, авторизация через Telegram SDK, данные в Firebase.",
        descEn:
          "An in-Telegram app: dashboard, signals and trade reviews, Telegram SDK auth, Firebase backend.",
        points: [
          "React 19 + TypeScript + Vite",
          "Telegram WebApp SDK: авторизация, тема, haptic",
          "Firebase: Firestore, Storage, правила доступа",
          "Motion для анимаций переходов и графиков",
        ],
        pointsEn: [
          "React 19 + TypeScript + Vite",
          "Telegram WebApp SDK: auth, theme, haptics",
          "Firebase: Firestore, Storage, security rules",
          "Motion for transitions and chart animations",
        ],
        metrics: [
          ["TS", "строгий типобезопасный слой"],
          ["1 клик", "вход через Telegram"],
          ["Rules", "Firestore и Storage под контролем"],
        ],
        links: [],
      },
      {
        key: "courses",
        accent: "#d8f26c",
        year: "2024",
        title: "Trading Courses",
        titleEn: "Trading Courses",
        tagline: "Сайт курсов с прогрессией уроков",
        taglineEn: "A course site with lesson progression",
        desc: "Сайт с каталогом курсов, страницами уроков и прогрессом обучения. Акцент на читаемый контент и быстрые анимации переходов.",
        descEn:
          "A course catalogue with lesson pages and learning progress, focused on readable content and quick transitions.",
        points: [
          "React 19 + TypeScript + Vite, React Router",
          "Motion: анимации списков и переходов",
          "Адаптивная вёрстка и тёмная тема",
        ],
        pointsEn: [
          "React 19 + TypeScript + Vite, React Router",
          "Motion animations for lists and transitions",
          "Responsive layout and dark theme",
        ],
        metrics: [],
        links: [],
      },
    ],
    "labsList": [
      {
        title: "ML-эксперименты",
        titleEn: "ML experiments",
        desc: "Python: анализ датасетов, обучение моделей, метрики качества.",
        descEn: "Python: dataset analysis, model training, quality metrics.",
        tag: "Python · pandas · scikit-learn",
      },
      {
        title: "Визуализатор сети",
        titleEn: "Network visualizer",
        desc: "Отрисовка топологий и графов на Python, разбор логов.",
        descEn: "Rendering topologies and graphs in Python, log parsing.",
        tag: "Python · networkx · graph",
      },
      {
        title: "Java-лаборатория",
        titleEn: "Java lab",
        desc: "Эксперименты с коллекциями, классами и сборкой.",
        descEn: "Experiments with collections, classes and builds.",
        tag: "Java · Gradle",
      },
      {
        title: "Боты и утилиты",
        titleEn: "Bots and utilities",
        desc: "Небольшие скрипты и автоматизация повседневных задач.",
        descEn: "Small scripts automating everyday tasks.",
        tag: "Node · Python",
      },
    ],
    "timelineList": [
      {
        when: "2026",
        title: "Ciel — локальный ИИ-фронтенд",
        where: "React · Node · OpenCode",
        desc: "Спроектировал мост между браузером и локальным сервером агента: SSE, разрешения, вопросы агенту, локализация и тёмная тема.",
        descEn:
          "Designed the bridge between the browser and a local agent server: SSE, permissions, agent questions, localization and a dark theme.",
      },
      {
        when: "2025",
        title: "ESEP — оценка недвижимости",
        where: "Flutter · Supabase",
        desc: "Кроссплатформенное приложение с ролями, документами и отчётами; безопасность на уровне RLS и клиентская криптография.",
        descEn:
          "A cross-platform app with roles, documents and reports, secured by RLS and client-side cryptography.",
      },
      {
        when: "2025",
        title: "TradePro — Telegram Mini App",
        where: "React · TypeScript · Firebase",
        desc: "Приложение внутри Telegram: авторизация через SDK, дашборд, работа с данными в реальном времени.",
        descEn:
          "An in-Telegram app: SDK auth, dashboard and real-time data.",
      },
      {
        when: "2024",
        title: "Первые React-проекты и основы",
        where: "JavaScript · CSS",
        desc: "Учебные проекты, привычка к компонентному подходу, интерес к анимациям и типографике.",
        descEn:
          "Study projects, a habit of component thinking, and an interest in animation and typography.",
      },
    ],
    "contactsList": [
      {
        label: "Telegram",
        labelEn: "Telegram",
        value: "@arcnosixa",
        href: "https://t.me/arcnosixa",
        icon: "M12 3c-5 0-9 4.4-9 9.5 0 1.6.4 3.2 1.2 4.6L3 21l4-1.1c1.3.7 2.8 1.1 5 1.1 5 0 9-4.4 9-9.5S17 3 12 3Zm4.6 13.2c-.2.5-1 .9-1.4 1-.4.1-.8.2-2.7-.6-2.3-1-3.7-3.3-3.8-3.4-.1-.2-.9-1.2-.9-2.3 0-1.1.6-1.6.8-1.8.2-.2.4-.3.6-.3h.4c.1 0 .3 0 .5.4l.7 1.7c.1.2.1.3 0 .5l-.3.5-.4.4c-.1.1-.3.3-.1.6.2.3.7 1.1 1.5 1.8 1 .9 1.8 1.2 2.1 1.3.3.1.4.1.6-.1l.9-1c.2-.3.4-.2.7-.1l1.7.8c.3.1.5.2.5.3.1.2.1.7-.1 1.2Z",
      },
      {
        label: "GitHub",
        labelEn: "GitHub",
        value: "github.com/arcnosixa",
        href: "https://github.com/arcnosixa",
        icon: "M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.8c-2.8.6-3.4-1.3-3.4-1.3-.4-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.3 1.1 2.9.8.1-.6.4-1.1.6-1.3-2.2-.3-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.6 0 0 .8-.3 2.7 1a9.4 9.4 0 0 1 5 0c1.9-1.3 2.7-1 2.7-1 .5 1.3.2 2.3.1 2.6.6.7 1 1.6 1 2.7 0 3.9-2.4 4.7-4.6 5 .4.3.7.9.7 1.9v2.8c0 .3.2.6.7.5A10 10 0 0 0 12 2Z",
      },
      {
        label: "Почта",
        labelEn: "Email",
        value: "hello@arcnosixa.dev",
        href: "mailto:hello@arcnosixa.dev",
        copy: "hello@arcnosixa.dev",
        icon: "M3 6h18v12H3V6Zm0 1.2 9 6 9-6",
      },
    ],
  },
  en: {
    "a11y.skip": "Skip to content",
    "nav.about": "About",
    "nav.skills": "Skills",
    "nav.work": "Work",
    "nav.path": "Path",
    "nav.contact": "Contact",
    "hero.status": "Open to projects and internships",
    "hero.hi": "Hi, I'm",
    "hero.roleLabel": "Role:",
    "hero.lead":
      "I build interfaces worth showing: React apps, local tools for AI agents and mobile products with an eye for performance and detail.",
    "hero.ctaWork": "See projects",
    "hero.ctaContact": "Get in touch",
    "hero.nowLabel": "Now",
    "hero.now": "Polishing Ciel: the local OpenCode bridge, SSE streams and careful typography",
    "hero.stackLabel": "Stack",
    "hero.stack": "React 19 · Vite · TypeScript · Node · Flutter · Supabase",
    "hero.focusLabel": "Focus",
    "hero.focus": "Product frontend, local services, AI agent integrations",
    "hero.scroll": "scroll",
    "about.title": "About",
    "about.p1":
      "I'm a frontend developer who likes finishing products: from data shapes and APIs down to animations, loading states and error copy.",
    "about.p2":
      "Most of my time goes into React: building interfaces, standing up local services, writing Node logic, wiring AI agents into everyday tools. On the side I love Flutter and Telegram Mini Apps.",
    "about.p3":
      "I value simple solutions without extra dependencies, readable code, and products that stay understandable after I stop touching them.",
    "about.stat1": "projects in this portfolio",
    "about.stat2": "years of production work",
    "about.stat3": "interface languages shipped",
    "about.stat4": "platforms: web, mobile, desktop",
    "skills.title": "Skills",
    "work.title": "Work",
    "path.title": "Path",
    "contact.title": "Contact",
    "contact.lead":
      "Open to frontend projects, internships and tasks where the interface matters and the AI integration has to be reliable. Write to me — I reply fast.",
    "contact.note": "Usually within a day. I like tasks with real users.",
    "footer.built": "Handmade: HTML, CSS, a bit of JavaScript",
    "work.featured": "Featured",
    "work.highlights": "Highlights",
    "work.metrics": "Numbers",
    "work.code": "Code",
    "work.demo": "Demo",
    "work.more": "More projects",
    "work.lab": "Lab and study projects",
    "work.lessons": "Study and pet projects",
    "skills.note.frontend": "Component thinking, state, animation, accessibility",
    "skills.note.backend": "Local APIs, SSE streams, security, no needless abstractions",
    "skills.note.mobile": "Cross-platform apps, Supabase, client-side crypto",
    "skills.note.ai": "LLM integrations, MCP, agents, questions and permissions",
    "skills.note.design": "Grids, typography, dark themes, design tokens",
    "skills.note.flow": "Vite, TypeScript, linters, tests, CI",
    "skills.frontend": "Frontend",
    "skills.backend": "Services and API",
    "skills.mobile": "Mobile",
    "skills.ai": "AI and agents",
    "skills.design": "Interface and design",
    "skills.flow": "Tooling and flow",
    "typed": [
      "Frontend developer",
      "React engineer",
      "Interface designer",
      "Local services builder",
    ],
    "skillsList": {
      frontend: ["React 19", "TypeScript", "Hooks", "Vite", "React Router", "Motion"],
      backend: ["Node.js", "Express", "REST / JSON", "SSE", "PostgreSQL", "Neo4j"],
      mobile: ["Flutter", "Dart", "Supabase", "Firebase", "FCM", "Crypto"],
      ai: ["OpenCode", "LLM agents", "MCP", "OpenRouter", "Prompts", "RAG"],
      design: ["Figma", "Design tokens", "CSS Grid", "Dark UI", "Animation", "A11y"],
      flow: ["Vite", "TypeScript", "Oxlint", "Vitest", "node:test", "Git"],
    },
    "projectsList": [
      {
        key: "ciel",
        featured: true,
        accent: "#d8f26c",
        year: "2026",
        title: "Ciel",
        titleEn: "Ciel",
        tagline: "A local-first workspace for an AI coding agent",
        taglineEn: "A local-first workspace for an AI coding agent",
        desc: "A calm shell around a local OpenCode install: spaces, files, memory, playbooks and a connected agent with sessions, streaming, models, tools, permissions and diffs.",
        descEn:
          "A calm shell around a local OpenCode install: spaces, files, memory, playbooks and a connected agent with sessions, streaming, models, tools, permissions and diffs.",
        points: [
          "React 19 + Vite, dark theme, RU/KZ i18n, responsive",
          "Node bridge: JSON/SSE proxy to the OpenCode server",
          "Host/Origin checks, loopback-only binding",
          "Session event normalization, agent questions, pending-question restore",
          "node:test suites, Oxlint",
        ],
        pointsEn: [
          "React 19 + Vite, dark theme, RU/KZ i18n, responsive",
          "Node bridge: JSON/SSE proxy to the OpenCode server",
          "Host/Origin checks, loopback-only binding",
          "Session event normalization, agent questions, pending-question restore",
          "node:test suites, Oxlint",
        ],
        metrics: [
          ["~40", "session events normalized"],
          ["2", "streams: JSON and SSE"],
          ["RU/KZ", "interface localization"],
        ],
        links: [{ label: "Live site", labelEn: "Live site", href: "https://ciel-flax.vercel.app" }],
      },
      {
        key: "esep",
        accent: "#f49a70",
        year: "2025—2026",
        title: "ESEP",
        titleEn: "ESEP",
        tagline: "Real-estate appraisal: Flutter + Supabase",
        taglineEn: "Real-estate appraisal: Flutter + Supabase",
        desc: "An appraisal platform: requests, appraiser and company dashboards, documents, reports, payments, egov integration and document signing.",
        descEn:
          "An appraisal platform: requests, appraiser and company dashboards, documents, reports, payments, egov integration and document signing.",
        points: [
          "Flutter 3 for Android, iOS, Web, desktop",
          "Supabase: Auth, per-role RLS, SQL migrations",
          "Client-side crypto, secure storage, local auth",
          "AI module: signature parsing and verification, case chat",
          "Push notifications, payments, deploy script",
        ],
        pointsEn: [
          "Flutter 3 for Android, iOS, Web, desktop",
          "Supabase: Auth, per-role RLS, SQL migrations",
          "Client-side crypto, secure storage, local auth",
          "AI module: signature parsing and verification, case chat",
          "Push notifications, payments, deploy script",
        ],
        metrics: [
          ["6", "platforms from one codebase"],
          ["24+", "screens and flows"],
          ["RLS", "per-role data isolation"],
        ],
        links: [],
      },
      {
        key: "tradepro",
        accent: "#a8c9ff",
        year: "2025",
        title: "TradePro",
        titleEn: "TradePro",
        tagline: "A Telegram Mini App for traders",
        taglineEn: "A Telegram Mini App for traders",
        desc: "An in-Telegram app: dashboard, signals and trade reviews, Telegram SDK auth, Firebase data.",
        descEn:
          "An in-Telegram app: dashboard, signals and trade reviews, Telegram SDK auth, Firebase data.",
        points: [
          "React 19 + TypeScript + Vite",
          "Telegram WebApp SDK: auth, theme, haptics",
          "Firebase: Firestore, Storage, security rules",
          "Motion for transitions and chart animations",
        ],
        pointsEn: [
          "React 19 + TypeScript + Vite",
          "Telegram WebApp SDK: auth, theme, haptics",
          "Firebase: Firestore, Storage, security rules",
          "Motion for transitions and chart animations",
        ],
        metrics: [
          ["TS", "strict type-safe layer"],
          ["1 tap", "Telegram sign-in"],
          ["Rules", "Firestore and Storage under control"],
        ],
        links: [],
      },
      {
        key: "courses",
        accent: "#d8f26c",
        year: "2024",
        title: "Trading Courses",
        titleEn: "Trading Courses",
        tagline: "A course site with lesson progression",
        taglineEn: "A course site with lesson progression",
        desc: "A course catalogue with lesson pages and learning progress, focused on readable content and quick transitions.",
        descEn:
          "A course catalogue with lesson pages and learning progress, focused on readable content and quick transitions.",
        points: [
          "React 19 + TypeScript + Vite, React Router",
          "Motion animations for lists and transitions",
          "Responsive layout and dark theme",
        ],
        pointsEn: [
          "React 19 + TypeScript + Vite, React Router",
          "Motion animations for lists and transitions",
          "Responsive layout and dark theme",
        ],
        metrics: [],
        links: [],
      },
    ],
    "labsList": [
      {
        title: "ML experiments",
        titleEn: "ML experiments",
        desc: "Python: dataset analysis, model training, quality metrics.",
        descEn: "Python: dataset analysis, model training, quality metrics.",
        tag: "Python · pandas · scikit-learn",
      },
      {
        title: "Network visualizer",
        titleEn: "Network visualizer",
        desc: "Rendering topologies and graphs in Python, log parsing.",
        descEn: "Rendering topologies and graphs in Python, log parsing.",
        tag: "Python · networkx · graph",
      },
      {
        title: "Java lab",
        titleEn: "Java lab",
        desc: "Experiments with collections, classes and builds.",
        descEn: "Experiments with collections, classes and builds.",
        tag: "Java · Gradle",
      },
      {
        title: "Bots and utilities",
        titleEn: "Bots and utilities",
        desc: "Small scripts automating everyday tasks.",
        descEn: "Small scripts automating everyday tasks.",
        tag: "Node · Python",
      },
    ],
    "timelineList": [
      {
        when: "2026",
        title: "Ciel — a local AI frontend",
        where: "React · Node · OpenCode",
        desc: "Designed the bridge between the browser and a local agent server: SSE, permissions, agent questions, localization and a dark theme.",
        descEn:
          "Designed the bridge between the browser and a local agent server: SSE, permissions, agent questions, localization and a dark theme.",
      },
      {
        when: "2025",
        title: "ESEP — real-estate appraisal",
        where: "Flutter · Supabase",
        desc: "A cross-platform app with roles, documents and reports, secured by RLS and client-side cryptography.",
        descEn:
          "A cross-platform app with roles, documents and reports, secured by RLS and client-side cryptography.",
      },
      {
        when: "2025",
        title: "TradePro — Telegram Mini App",
        where: "React · TypeScript · Firebase",
        desc: "An in-Telegram app: SDK auth, dashboard and real-time data.",
        descEn: "An in-Telegram app: SDK auth, dashboard and real-time data.",
      },
      {
        when: "2024",
        title: "First React projects and fundamentals",
        where: "JavaScript · CSS",
        desc: "Study projects, a habit of component thinking, an interest in animation and typography.",
        descEn:
          "Study projects, a habit of component thinking, an interest in animation and typography.",
      },
    ],
    "contactsList": [
      {
        label: "Telegram",
        labelEn: "Telegram",
        value: "@arcnosixa",
        href: "https://t.me/arcnosixa",
        icon: "M12 3c-5 0-9 4.4-9 9.5 0 1.6.4 3.2 1.2 4.6L3 21l4-1.1c1.3.7 2.8 1.1 5 1.1 5 0 9-4.4 9-9.5S17 3 12 3Zm4.6 13.2c-.2.5-1 .9-1.4 1-.4.1-.8.2-2.7-.6-2.3-1-3.7-3.3-3.8-3.4-.1-.2-.9-1.2-.9-2.3 0-1.1.6-1.6.8-1.8.2-.2.4-.3.6-.3h.4c.1 0 .3 0 .5.4l.7 1.7c.1.2.1.3 0 .5l-.3.5-.4.4c-.1.1-.3.3-.1.6.2.3.7 1.1 1.5 1.8 1 .9 1.8 1.2 2.1 1.3.3.1.4.1.6-.1l.9-1c.2-.3.4-.2.7-.1l1.7.8c.3.1.5.2.5.3.1.2.1.7-.1 1.2Z",
      },
      {
        label: "GitHub",
        labelEn: "GitHub",
        value: "github.com/arcnosixa",
        href: "https://github.com/arcnosixa",
        icon: "M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.8c-2.8.6-3.4-1.3-3.4-1.3-.4-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.3 1.1 2.9.8.1-.6.4-1.1.6-1.3-2.2-.3-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.6 0 0 .8-.3 2.7 1a9.4 9.4 0 0 1 5 0c1.9-1.3 2.7-1 2.7-1 .5 1.3.2 2.3.1 2.6.6.7 1 1.6 1 2.7 0 3.9-2.4 4.7-4.6 5 .4.3.7.9.7 1.9v2.8c0 .3.2.6.7.5A10 10 0 0 0 12 2Z",
      },
      {
        label: "Email",
        labelEn: "Email",
        value: "hello@arcnosixa.dev",
        href: "mailto:hello@arcnosixa.dev",
        copy: "hello@arcnosixa.dev",
        icon: "M3 6h18v12H3V6Zm0 1.2 9 6 9-6",
      },
    ],
  },
};

const SKILL_ORDER = ["frontend", "backend", "mobile", "ai", "design", "flow"];

const root = document.documentElement;
const langToggle = document.getElementById("langToggle");
const nav = document.getElementById("nav");
const burger = document.getElementById("burger");
const topbar = document.getElementById("topbar");
const progressBar = document.getElementById("progressBar");
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let lang = "ru";
let toastTimer = null;

function t(key) {
  return I18N[lang][key] ?? key;
}

function pick(obj, base) {
  return lang === "en" && obj[`${base}En`] ? obj[`${base}En`] : obj[base];
}

function el(tag, className, html) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html !== undefined) node.innerHTML = html;
  return node;
}

function renderSkills() {
  const grid = document.getElementById("skillsGrid");
  grid.textContent = "";
  const tags = I18N[lang].skillsList;
  const order = [...SKILL_ORDER].sort((a, b) =>
    t(`skills.${a}`).localeCompare(t(`skills.${b}`), lang),
  );
  order.forEach((key, index) => {
    const card = el("article", "skill-card reveal");
    card.dataset.delay = String(index % 3);
    card.appendChild(
      el(
        "div",
        "skill-head",
        `<span class="skill-icon mono">${String(index + 1).padStart(2, "0")}</span><h3 class="skill-title">${t(
          `skills.${key}`,
        )}</h3>`,
      ),
    );
    card.appendChild(el("p", "skill-note", t(`skills.note.${key}`)));
    const list = el("div", "tags");
    tags[key].forEach((tag) => list.appendChild(el("span", "tag", tag)));
    card.appendChild(list);
    grid.appendChild(card);
  });
}

function projectCard(project) {
  const card = el("article", `project reveal${project.featured ? " featured" : ""}`);
  card.style.setProperty("--accent", project.accent);

  const main = el("div", "project-main");
  const top = el("div", "project-top");
  top.appendChild(el("h3", "project-title", pick(project, "title")));
  if (project.featured) {
    top.appendChild(el("span", "chip chip-featured", t("work.featured")));
  }
  top.appendChild(el("span", "chip chip-year mono", project.year));
  main.appendChild(top);
  main.appendChild(el("p", "project-desc", pick(project, "desc")));

  const list = el("ul", "project-list");
  pick(project, "points").forEach((point) => list.appendChild(el("li", null, point)));
  main.appendChild(list);

  const links = el("div", "project-links");
  project.links.forEach((link) => {
    links.appendChild(
      el(
        "a",
        "link",
        `<span>${lang === "en" ? link.labelEn : link.label}</span><svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
      ),
    ).href = link.href;
    links.lastChild.target = "_blank";
    links.lastChild.rel = "noreferrer";
  });
  links.appendChild(el("span", "link link-ghost", project.key));
  main.appendChild(links);

  card.appendChild(main);

  if (project.metrics.length) {
    const side = el("div", "project-side");
    side.appendChild(el("h4", null, t("work.metrics")));
    project.metrics.forEach(([value, label]) => {
      side.appendChild(
        el("div", "metric", `<b>${value}</b><span>${label}</span>`),
      );
    });
    card.appendChild(side);
  }

  return card;
}

function renderProjects() {
  const host = document.getElementById("projects");
  host.textContent = "";
  const list = I18N[lang].projectsList;

  const featured = list.filter((item) => item.featured);
  const rest = list.filter((item) => !item.featured);

  if (featured.length) {
    const wrap = el("div", "projects");
    featured.forEach((item) => wrap.appendChild(projectCard(item)));
    host.appendChild(wrap);
  }

  const moreLabel = el("h3", "sub-label", t("work.more"));
  moreLabel.style.margin = "38px 0 16px";
  host.appendChild(moreLabel);

  const grid = el("div", "grid-projects");
  rest.forEach((item) => grid.appendChild(projectCard(item)));
  host.appendChild(grid);

  const labLabel = el("h3", "sub-label", t("work.lab"));
  labLabel.style.margin = "40px 0 0";
  host.appendChild(labLabel);

  const labs = el("div", "small-projects");
  I18N[lang].labsList.forEach((lab) => {
    labs.appendChild(
      el(
        "article",
        "small-card",
        `<h5>${pick(lab, "title")}</h5><p>${pick(lab, "desc")}</p><span class="mono">${lab.tag}</span>`,
      ),
    );
  });
  host.appendChild(labs);
}

function renderTimeline() {
  const host = document.getElementById("timeline");
  host.textContent = "";
  I18N[lang].timelineList.forEach((item, index) => {
    const li = el(
      "li",
      "tl-item reveal",
      `<div class="tl-when">${item.when}</div>
       <div>
         <h3 class="tl-title">${item.title}</h3>
         <span class="tl-where">${item.where}</span>
         <p class="tl-desc">${pick(item, "desc")}</p>
       </div>`,
    );
    li.dataset.delay = String(index % 3);
    host.appendChild(li);
  });
}

function renderContacts() {
  const host = document.getElementById("contactLinks");
  host.textContent = "";
  I18N[lang].contactsList.forEach((item) => {
    const a = el(
      "a",
      "contact-link",
      `<span class="contact-icon"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="${item.icon}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
       <span class="contact-meta"><b>${pick(item, "label")}</b><span>${item.value}</span></span>`,
    );
    a.href = item.href;
    if (item.href.startsWith("http")) {
      a.target = "_blank";
      a.rel = "noreferrer";
    } else {
      a.addEventListener("click", (event) => {
        event.preventDefault();
        copyText(item.copy);
      });
    }
    host.appendChild(a);
  });
}

function applyStaticText() {
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  document.title =
    lang === "ru" ? "Arcnosixa — frontend / React" : "Arcnosixa — frontend / React";
  document.documentElement.lang = lang;
  document.querySelectorAll("[data-lang-label]").forEach((node) => {
    node.classList.toggle("is-on", node.dataset.langLabel === lang);
  });
}

function renderAll() {
  applyStaticText();
  renderSkills();
  renderProjects();
  renderTimeline();
  renderContacts();
  bindReveal();
  setActiveNav();
  document.dispatchEvent(new CustomEvent("portfolio:render"));
}

function setLang(next) {
  lang = next === "en" ? "en" : "ru";
  try {
    localStorage.setItem("portfolio-lang", lang);
  } catch (error) {
    void error;
  }
  document.body.classList.add("is-swapping");
  renderAll();
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => document.body.classList.remove("is-swapping"));
  });
}

function startTyping() {
  const node = document.getElementById("typed");
  const words = I18N[lang].typed;
  if (!node) return;
  let word = 0;
  let char = 0;
  let erasing = false;

  if (reduced) {
    node.textContent = words[0];
    return;
  }

  const tick = () => {
    const current = words[word];
    char += erasing ? -1 : 1;
    node.textContent = current.slice(0, char);
    const delay = erasing ? 28 : 55;
    if (!erasing && char === current.length) {
      erasing = true;
      window.setTimeout(tick, 1700);
      return;
    }
    if (erasing && char === 0) {
      erasing = false;
      word = (word + 1) % words.length;
    }
    window.setTimeout(tick, delay);
  };

  tick();
}

let revealObserver = null;

function bindReveal() {
  if (revealObserver) revealObserver.disconnect();
  const items = document.querySelectorAll(".reveal:not(.is-in)");
  if (reduced || !("IntersectionObserver" in window)) {
    items.forEach((item) => item.classList.add("is-in"));
    return;
  }
  revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-in");
        revealObserver.unobserve(entry.target);
        if (entry.target.classList.contains("stat")) animateCounters();
      });
    },
    { rootMargin: "0px 0px -12% 0px", threshold: 0.12 },
  );
  items.forEach((item) => revealObserver.observe(item));
}

function animateCounters() {
  document.querySelectorAll(".stat-value").forEach((node) => {
    if (node.dataset.done) return;
    node.dataset.done = "1";
    const target = Number(node.dataset.count || 0);
    if (reduced) {
      node.textContent = String(target);
      return;
    }
    const started = performance.now();
    const step = (now) => {
      const progress = Math.min((now - started) / 1100, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      node.textContent = String(Math.round(target * eased));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

function setActiveNav() {
  const links = [...nav.querySelectorAll("a")];
  const sections = links
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);
  const probe = window.innerHeight * 0.35;

  let current = sections[0];
  sections.forEach((section) => {
    if (section.getBoundingClientRect().top <= probe) current = section;
  });

  links.forEach((link) => {
    link.classList.toggle("is-active", current && link.getAttribute("href") === `#${current.id}`);
  });
}

function onScroll() {
  const top = window.scrollY;
  topbar.classList.toggle("is-stuck", top > 24);
  const max = document.documentElement.scrollHeight - window.innerHeight;
  progressBar.style.width = `${max > 0 ? Math.min(top / max, 1) * 100 : 0}%`;
  setActiveNav();
}

let raf = null;

window.addEventListener(
  "scroll",
  () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      onScroll();
      raf = null;
    });
  },
  { passive: true },
);

window.addEventListener("resize", () => {
  setActiveNav();
  if (window.innerWidth > 940) closeMenu();
});

function closeMenu() {
  nav.classList.remove("is-open");
  burger.setAttribute("aria-expanded", "false");
}

burger.addEventListener("click", () => {
  const open = nav.classList.toggle("is-open");
  burger.setAttribute("aria-expanded", String(open));
});

nav.addEventListener("click", (event) => {
  if (event.target.tagName === "A") closeMenu();
});

langToggle.addEventListener("click", () => {
  setLang(lang === "ru" ? "en" : "ru");
  startTyping();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeMenu();
});

function showToast(message) {
  let toast = document.querySelector(".toast");
  if (!toast) {
    toast = el("div", "toast");
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("is-on");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("is-on"), 2200);
}

function copyText(value) {
  const done = () => showToast(lang === "ru" ? "Скопировано" : "Copied");
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(value).then(done, () => fallbackCopy(value, done));
    return;
  }
  fallbackCopy(value, done);
}

function fallbackCopy(value, done) {
  const area = document.createElement("textarea");
  area.value = value;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  try {
    document.execCommand("copy");
    done();
  } catch (error) {
    void error;
  }
  document.body.removeChild(area);
}

let stored = "ru";
try {
  stored = localStorage.getItem("portfolio-lang") || (navigator.language || "ru").slice(0, 2);
} catch (error) {
  void error;
}

setLang(stored);
startTyping();
document.getElementById("year").textContent = String(new Date().getFullYear());
onScroll();
