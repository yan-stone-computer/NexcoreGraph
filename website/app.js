const featureData = {
  intake: {
    image: 'assets/app-intake.webp',
    width: 1320,
    height: 2848,
    alt: '启核图策拍照入库界面，识别物品后选择目标资源库',
    label: '01 / 拍照入库',
    title: '先看见，再开始管理。',
    description: '识别名称、数量、位置与保质期，缺的字段由你补齐。确认之前，没有任何内容会被写进库存。',
    facts: [['输入', '拍照或相册'], ['处理', '视觉识别与结构化'], ['边界', '用户确认后入库']],
    caption: '拍照识别后选择目标库'
  },
  ai: {
    image: 'assets/app-tablet-ai.webp',
    width: 2880,
    height: 1920,
    alt: '启核图策 HarmonyOS 平板端 AI 面板',
    label: '02 / 可信 AI',
    title: '答案来自库存，不来自猜测。',
    description: '高频事实由本地规则直接回答，复杂问题才交给模型。行动建议以确认卡出现，用户点头后才生效。',
    facts: [['快答', '4 类事实 0 次模型'], ['生成', '主备模型自动降级'], ['写入', '先预览，确认后执行']],
    caption: 'AI 工作台与库存证据'
  },
  graph: {
    image: 'assets/graph-screenshot.webp',
    width: 1440,
    height: 900,
    alt: '启核图策 Web 端资源知识图谱界面',
    label: '03 / 资源图谱',
    title: '每一条回答，都能追到依据。',
    description: '物品、位置、期限与菜谱关系组成个人资源图谱。local、global、multi-hop 三种检索让回答可以继续追问。',
    facts: [['本体', '13 类节点 / 14 类边'], ['模式', 'local / global / multi-hop'], ['降级', '证据不可用时回退事实行']],
    caption: '个人资源图谱与证据路径'
  },
  family: {
    image: 'assets/app-phone-workbench.webp',
    width: 1320,
    height: 2848,
    alt: '启核图策 HarmonyOS 手机端家庭协作工作台',
    label: '04 / 家庭协作',
    title: '不是各记各的，而是一起更新。',
    description: '同一账号的改动自动落地到另一台设备。版本冲突不静默覆盖，由用户选择保留哪一份。',
    facts: [['协议', '全量快照 + 版本号'], ['冲突', '409 由用户决定'], ['实测', '7 秒内自动落地']],
    caption: '家庭协作与多设备状态'
  }
};

const menuButton = document.getElementById('menuToggle');
const primaryNav = document.getElementById('primaryNav');
const featureTabs = [...document.querySelectorAll('[data-feature]')];
const featureImage = document.getElementById('featureImage');
const featureLabel = document.getElementById('featureLabel');
const featureTitle = document.getElementById('featureTitle');
const featureDescription = document.getElementById('featureDescription');
const featureFacts = document.getElementById('featureFacts');
const featureZoom = document.getElementById('featureZoom');
const lightbox = document.getElementById('lightbox');
const lightboxImage = document.getElementById('lightboxImage');
const lightboxTitle = document.getElementById('lightboxTitle');
const lightboxCaption = document.getElementById('lightboxCaption');
const lightboxClose = document.getElementById('lightboxClose');

let currentFeature = 'intake';

function setFeature(key) {
  const data = featureData[key];
  if (!data) return;
  currentFeature = key;
  featureTabs.forEach((tab) => {
    tab.setAttribute('aria-selected', String(tab.dataset.feature === key));
  });
  featureImage.src = data.image;
  featureImage.width = data.width;
  featureImage.height = data.height;
  featureImage.alt = data.alt;
  featureLabel.textContent = data.label;
  featureTitle.textContent = data.title;
  featureDescription.textContent = data.description;
  featureFacts.replaceChildren(...data.facts.map(([term, value]) => {
    const row = document.createElement('div');
    const dt = document.createElement('dt');
    const dd = document.createElement('dd');
    dt.textContent = term;
    dd.textContent = value;
    row.append(dt, dd);
    return row;
  }));
  featureZoom.setAttribute('aria-label', `放大查看${data.caption}`);
}

featureTabs.forEach((tab, index) => {
  tab.addEventListener('click', () => setFeature(tab.dataset.feature));
  tab.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const next = (index + (event.key === 'ArrowDown' ? 1 : -1) + featureTabs.length) % featureTabs.length;
    featureTabs[next].focus();
    setFeature(featureTabs[next].dataset.feature);
  });
});

function toggleMenu(force) {
  const open = typeof force === 'boolean' ? force : !document.body.classList.contains('menu-open');
  document.body.classList.toggle('menu-open', open);
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label', open ? '关闭导航' : '打开导航');
}

menuButton.addEventListener('click', () => toggleMenu());
primaryNav.addEventListener('click', (event) => {
  if (event.target.closest('a')) toggleMenu(false);
});

function openLightbox(source, title, caption, alt, width, height) {
  lightboxImage.src = source;
  lightboxImage.alt = alt;
  lightboxImage.width = width;
  lightboxImage.height = height;
  lightboxTitle.textContent = title;
  lightboxCaption.textContent = caption;
  document.body.classList.add('dialog-open');
  lightbox.showModal();
}

featureZoom.addEventListener('click', () => {
  const data = featureData[currentFeature];
  openLightbox(data.image, data.title, data.caption, data.alt, data.width, data.height);
});

lightboxClose.addEventListener('click', () => lightbox.close());
lightbox.addEventListener('click', (event) => {
  if (event.target === lightbox) lightbox.close();
});
lightbox.addEventListener('close', () => document.body.classList.remove('dialog-open'));

const revealTargets = [
  '.problem-heading',
  '.problem-statements',
  '.resource-photo',
  '.section-heading',
  '.experience-workbench',
  '.trusted-copy',
  '.trusted-ledger',
  '.answer-console',
  '.graph-copy',
  '.graph-stage',
  '.device-heading',
  '.device-collage',
  '.proof-heading',
  '.proof-ledger',
  '.proof-boundary'
];

document.querySelectorAll(revealTargets.join(',')).forEach((element) => element.classList.add('reveal'));

if ('IntersectionObserver' in window) {
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      revealObserver.unobserve(entry.target);
    });
  }, { threshold: 0.14 });
  document.querySelectorAll('.reveal').forEach((element) => revealObserver.observe(element));

  const navLinks = [...primaryNav.querySelectorAll('a')];
  const navObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const id = `#${entry.target.id}`;
      navLinks.forEach((link) => link.classList.toggle('is-current', link.getAttribute('href') === id));
    });
  }, { rootMargin: '-35% 0px -55% 0px', threshold: 0 });
  document.querySelectorAll('main section[id]').forEach((section) => navObserver.observe(section));
} else {
  document.querySelectorAll('.reveal').forEach((element) => element.classList.add('is-visible'));
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && document.body.classList.contains('menu-open')) toggleMenu(false);
});
