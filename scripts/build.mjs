#!/usr/bin/env node
/**
 * 杭州二中白马湖学校官网静态站生成器
 * - 内容：source/_posts/*.md（YAML front matter，Hexo 约定）
 * - 输出：public/（首页、文章页、归档页、标签页、数据 JSON）
 * - 用法：node scripts/build.mjs [--watch] [--serve] [--port 8080]
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import MarkdownIt from 'markdown-it';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'source');
const POSTS = path.join(SRC, '_posts');
const PAGES = path.join(SRC, '_pages');
const I18N = path.join(SRC, '_i18n');


const PUBLIC = path.join(ROOT, 'public');

const argv = process.argv.slice(2);
const WATCH = argv.includes('--watch');
const SERVE = argv.includes('--serve');
const PORT = Number((argv[argv.indexOf('--port') + 1] || 8080)) || 8080;

// 媒体外链前缀：图片/大头资源放对象存储，页面只引用链接
// 置空字符串则全部随站点一起发布
const MEDIA = process.env.MEDIA_BASE ?? 'https://cn-sy1.rains3.com/h2zbmh';

const md = new MarkdownIt({ html: true, linkify: true, breaks: false });

/* ------------------------------------------------------------------ utils */
const read = (p) => fs.readFileSync(p, 'utf8');
const ensure = (d) => fs.mkdirSync(d, { recursive: true });

/* 多语言：联合国六种工作语言，中文为默认 */
const LANGS = [
  { code: 'zh', path: '/',    label: '中文',   dir: 'ltr', hreflang: 'zh-CN' },
  { code: 'en', path: '/en/', label: 'English', dir: 'ltr', hreflang: 'en' },
  { code: 'fr', path: '/fr/', label: 'Français', dir: 'ltr', hreflang: 'fr' },
  { code: 'ru', path: '/ru/', label: 'Русский', dir: 'ltr', hreflang: 'ru' },
  { code: 'es', path: '/es/', label: 'Español', dir: 'ltr', hreflang: 'es' },
  { code: 'ar', path: '/ar/', label: 'العربية', dir: 'rtl', hreflang: 'ar' },
];
const I18N_PAGES = (() => {
  const f = path.join(I18N, 'pages.json');
  return fs.existsSync(f) ? JSON.parse(read(f)) : {};
})();
const UI = (() => {
  const f = path.join(I18N, 'ui.json');
  return fs.existsSync(f) ? JSON.parse(read(f)) : {};
})();
const tr = (lang, key) => (UI[lang] && UI[lang][key]) || (UI.zh && UI.zh[key]) || key;
const THEME = path.join(ROOT, 'theme');
const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function copyDir(from, to) {
  if (!fs.existsSync(from)) return;
  ensure(to);
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, e.name), b = path.join(to, e.name);
    if (e.isDirectory()) copyDir(a, b);
    else fs.copyFileSync(a, b);
  }
}

/** 极简 YAML front matter 解析：支持 key: value / [a, b] / 引号 */
function parseFrontMatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  const data = {};
  let body = raw;
  if (m) {
    body = raw.slice(m[0].length);
    for (const line of m[1].split(/\r?\n/)) {
      const i = line.indexOf(':');
      if (i < 0) continue;
      const k = line.slice(0, i).trim();
      let v = line.slice(i + 1).trim();
      if (!k) continue;
      if (v.startsWith('[') && v.endsWith(']')) {
        v = v.slice(1, -1).split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
      } else {
        v = v.replace(/^['"]|['"]$/g, '');
      }
      data[k] = v;
    }
  }
  return { data, body };
}

const pad = (n) => String(n).padStart(2, '0');
function fmtDate(d) {
  const t = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(t.getTime())) return '';
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
}
function permalink(post) {
  const t = new Date(post.date);
  return `${t.getFullYear()}/${pad(t.getMonth() + 1)}/${pad(t.getDate())}/${post.slug}/`;
}
const plain = (s) => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

/* 全站导航（首页由 Vue 渲染，其余页面用这份静态导航） */
const NAV_ITEMS = [
  { key: 'home', label: 'nav_home', href: '/' },
  { key: 'about', label: 'nav_about', href: '/about/' },
  { key: 'news', label: 'nav_news', href: '/archives/' },
  { key: 'contact', label: 'nav_contact', href: '/contact/' },
  { key: 'campus', label: 'nav_campus', href: '/#gallery' },
  { key: 'privacy', label: 'nav_privacy', href: '/privacy/' },
  { key: 'archive', label: 'nav_archive', href: '/archive/', sub: [
    { label: 'nav_archive_hub', href: '/archive/' },
    { label: 'nav_archive_pages', href: '/archive/pages/' },
    { label: 'nav_archive_mirror', href: '/archive/mirror/' },
    { label: 'nav_snapshots', href: '/snapshots/' },
  ] },
];

const NAV_KEYS = {
  home: 'nav_home', about: 'nav_about', news: 'nav_news', contact: 'nav_contact',
  campus: 'nav_campus', privacy: 'nav_privacy', archive: 'nav_archive',
};

function renderNav(active = '', lang = 'zh') {
  const prefix = lang === 'zh' ? '' : `/${lang}`;
  const items = NAV_ITEMS.map(it => {
    const on = it.key === active ? ' on' : '';
    const label = tr(lang, it.label);
    const href = it.key === 'home' ? (lang === 'zh' ? '/' : `/${lang}/`)
      : it.key === 'archive' && lang !== 'zh' ? '/' : it.href;
    const sub = it.sub
      ? `<div class="sub">${it.sub.map(x => `<a href="${x.href}">${esc(tr(lang, x.label))}</a>`).join('')}</div>`
      : '';
    return `<div class="nv${on}"><a href="${href}">${esc(label)}</a>${sub}</div>`;
  }).join('');
  const langs = LANGS.map(l =>
    `<a class="lg${l.code === lang ? ' on' : ''}" href="${l.path}" hreflang="${l.hreflang}">${esc(l.label)}</a>`
  ).join('');
  return `<div class="nav"><div class="wrap">${items}<div class="langs">${langs}</div></div></div>`;
}

/* ------------------------------------------------------------------ load posts */
function loadPosts() {
  if (!fs.existsSync(POSTS)) return [];
  const posts = [];
  for (const f of fs.readdirSync(POSTS).filter(f => /\.md$/i.test(f))) {
    const raw = read(path.join(POSTS, f));
    const { data, body } = parseFrontMatter(raw);
    const slug = path.basename(f, path.extname(f));
    const date = data.date || fs.statSync(path.join(POSTS, f)).mtime.toISOString();
    let html = md.render(body)
      .replace(/src="(?:\/)?images\//g, 'src="/images/')
      .replace(/href="(?:\/)?images\//g, 'href="/images/');
    const text = plain(html);
    posts.push({
      file: f, slug,
      title: data.title || slug,
      date: fmtDate(date),
      timestamp: new Date(date).getTime(),
      categories: data.categories || [],
      tags: data.tags || [],
      cover: data.cover ? data.cover.replace(/^\.?\//, '') : '',
      excerpt: data.excerpt || text.slice(0, 110),
      html, text,
      words: text.replace(/\s/g, '').length,
      url: permalink({ date, slug }),
    });
  }
  return posts.sort((a, b) => b.timestamp - a.timestamp);
}

/* ------------------------------------------------------------------ pages */
function loadPages() {
  if (!fs.existsSync(PAGES)) return [];
  const out = [];
  for (const f of fs.readdirSync(PAGES).filter(f => /\.md$/i.test(f))) {
    const raw = read(path.join(PAGES, f));
    const { data, body } = parseFrontMatter(raw);
    const slug = path.basename(f, path.extname(f));
    const permalinkPath = (data.permalink || `/${slug}/`).replace(/^\/+|\/+$/g, '');
    let html = md.render(body).replace(/src="(?:\/)?images\//g, 'src="/images/');
    const text = plain(html);
    out.push({
      slug, title: data.title || slug, desc: data.desc || text.slice(0, 90),
      nav: data.nav === 'true' || data.nav === true,
      url: '/' + permalinkPath + '/',
      html, words: text.replace(/\s/g, '').length,
    });
  }
  return out;
}

/* ------------------------------------------------------------------ templates */
const T = (name) => read(path.join(THEME, 'templates', name));
let ARTICLE_TPL = '', SITE = null;

function renderPost(post, prev, next) {
  const cover = post.cover ? `/${post.cover}` : '';
  return ARTICLE_TPL
    .replaceAll('{{TITLE}}', esc(post.title))
    .replaceAll('{{DESC}}', esc(post.excerpt))
    .replaceAll('{{DATE}}', post.date)
    .replaceAll('{{WORDS}}', String(post.words))
    .replaceAll('{{CATEGORY}}', esc(post.categories[0] || '校园新闻'))
    .replaceAll('{{BODY}}', post.html)
    .replaceAll('{{TAGS}}', post.tags.map(t => `<a href="/tags/${encodeURIComponent(t)}/">#${esc(t)}</a>`).join('') || '<a href="/archives/">#校园新闻</a>')
    .replaceAll('{{PREV}}', prev ? `<a href="/${prev.url}"><small>← 上一篇</small><strong>${esc(prev.title)}</strong></a>` : '<span></span>')
    .replaceAll('{{NEXT}}', next ? `<a class="right" href="/${next.url}"><small>下一篇 →</small><strong>${esc(next.title)}</strong></a>` : '<span></span>')
    .replaceAll('{{COVER_META}}', cover ? `<meta property="og:image" content="${esc(cover)}">` : '')
    .replaceAll('{{NAV}}', renderNav('news'));
}

function renderArchive(posts) {
  const years = {};
  for (const p of posts) (years[p.date.slice(0, 4)] ||= []).push(p);
  const blocks = Object.keys(years).sort().reverse().map(y => {
    const items = years[y].map(p => `      <li><span class="d">${p.date.slice(5)}</span><a href="/${p.url}">${esc(p.title)}</a></li>`).join('\n');
    return `  <section class="arch-year"><h2>${y}<small>${years[y].length} 篇</small></h2><ul>\n${items}\n  </ul></section>`;
  }).join('\n');
  return T('archive.html')
    .replaceAll('{{COUNT}}', String(posts.length))
    .replaceAll('{{NAV}}', renderNav('news'))
    .replaceAll('{{YEARS}}', blocks);
}

function renderTags(posts) {
  const tags = {};
  for (const p of posts) for (const t of p.tags) (tags[t] ||= []).push(p);
  const cards = Object.keys(tags).sort().map(t => {
    const items = tags[t].map(p => `<li><span class="d">${p.date}</span><a href="/${p.url}">${esc(p.title)}</a></li>`).join('');
    return `<section class="tag-block" id="${esc(t)}"><h2>#${esc(t)}<small>${tags[t].length} 篇</small></h2><ul>${items}</ul></section>`;
  }).join('\n');
  return T('tags.html').replaceAll('{{NAV}}', renderNav('news')).replaceAll('{{TAGS}}', cards);
}

/* ------------------------------------------------------------------ build */
function build() {
  const t0 = Date.now();
  const posts = loadPosts();
  ARTICLE_TPL = T('post.html');

  fs.rmSync(PUBLIC, { recursive: true, force: true });
  ensure(PUBLIC);

  // 文章页
  posts.forEach((p, i) => {
    const dir = path.join(PUBLIC, p.url);
    ensure(dir);
    fs.writeFileSync(path.join(dir, 'index.html'), renderPost(p, posts[i + 1], posts[i - 1]));
  });

  // 独立页面（source/_pages/*.md）
  const PAGES_TPL = T('page.html');
  for (const pg of loadPages()) {
    const dir = path.join(PUBLIC, pg.url);
    ensure(dir);
    fs.writeFileSync(path.join(dir, 'index.html'), PAGES_TPL
      .replaceAll('{{TITLE}}', esc(pg.title))
      .replaceAll('{{DESC}}', esc(pg.desc))
      .replaceAll('{{BODY}}', pg.html)
      .replaceAll('{{NAV}}', renderNav(
        pg.url === '/about/' ? 'about' : pg.url === '/privacy/' ? 'privacy' : pg.url === '/contact/' ? 'contact' : '')));
  }

  // 归档 / 标签
  ensure(path.join(PUBLIC, 'archives'));
  fs.writeFileSync(path.join(PUBLIC, 'archives', 'index.html'), renderArchive(posts));
  ensure(path.join(PUBLIC, 'tags'));
  fs.writeFileSync(path.join(PUBLIC, 'tags', 'index.html'), renderTags(posts));

  // 静态资源
  copyDir(path.join(THEME, 'assets'), path.join(PUBLIC, 'assets'));
  if (MEDIA) {
    // 图片已放对象存储，发布目录里只保留代码与数据
    for (const d of [path.join(PUBLIC, 'assets', 'img'), path.join(PUBLIC, 'images')]) {
      fs.rmSync(d, { recursive: true, force: true });
    }
  }
  copyDir(path.join(ROOT, 'static'), PUBLIC);   // 存档页 / 镜像树 / CNAME / .nojekyll
  if (!MEDIA) copyDir(path.join(SRC, 'images'), path.join(PUBLIC, 'images'));

  // 首页数据（Vue 首页读取）
  ensure(path.join(PUBLIC, 'assets', 'data'));
  const news = posts.slice(0, 14).map(p => ({
    slug: p.slug, title: p.title, date: p.date,
    url: '/' + p.url,
    cover: p.cover ? '/' + p.cover : '',
    excerpt: p.excerpt, tags: p.tags,
  }));
  fs.writeFileSync(path.join(PUBLIC, 'assets', 'data', 'news.json'), JSON.stringify(news, null, 1));

  const years = {};
  for (const p of posts) years[p.date.slice(0, 4)] = (years[p.date.slice(0, 4)] || 0) + 1;
  const site = {
    stats: { posts: posts.length, years: Object.keys(years).length, tags: new Set(posts.flatMap(p => p.tags)).size },
    latest: news,
    years: Object.keys(years).sort().reverse().map(y => ({ y, n: years[y] })),
  };
  fs.writeFileSync(path.join(PUBLIC, 'assets', 'data', 'site.json'), JSON.stringify(site, null, 1));

  // 首页
  fs.writeFileSync(path.join(PUBLIC, 'index.html'), read(path.join(THEME, 'templates', 'index.html')));

  relocateArchive();

  // 快照索引 /snapshots/
  const snapDir = path.join(PUBLIC, 'snapshots');
  if (fs.existsSync(snapDir)) {
    const items = fs.readdirSync(snapDir).filter(f => /\.html?$/i.test(f))
      .map(f => ({ f, t: f.replace(/\.html?$/i, '') }))
      .sort((a, b) => a.t.localeCompare(b.t));
    const rows = items.map(it => `<li><a href="/snapshots/${encodeURI(it.f)}">${esc(it.t)}</a></li>`).join('\n');
    ensure(snapDir);
    fs.writeFileSync(path.join(snapDir, 'index.html'), `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>页面快照 · 浙江省杭州二中白马湖学校</title>
<link rel="icon" href="/assets/img/favicon.png"><link rel="stylesheet" href="/assets/styles.css">
<style>
.snap-wrap{width:900px;max-width:100%;margin:0 auto;padding:40px 20px 70px}
.snap-hd{margin-bottom:26px;border-bottom:1px solid #eee;padding-bottom:18px}
.snap-hd h1{font-size:30px;color:#1a1a1a}
.snap-hd p{color:#888;font-size:14px;margin-top:10px}
.snap-list li{padding:11px 4px;border-bottom:1px dashed #e8e8e8;font-size:15px}
.snap-list a{color:#333} .snap-list a:hover{color:#0c8066}
</style></head><body>
<div class="topbar"><div class="wrap"><span class="item">联系我们：0571-86798900</span><span class="sep">|</span><span class="item">校长信箱：——</span></div></div>
<div class="hd"><div class="wrap" style="grid-template-columns:1fr auto 1fr"><div class="campus"><a href="/">总校</a><span class="sep">|</span><a href="/">小学部</a><span class="sep">|</span><a href="/">初中部</a></div><a class="logo" href="/" style="color:inherit"><img class="logoimg" src="/assets/img/logo.png" alt="杭州二中白马湖学校"></a><div class="empty"></div></div></div>
${renderNav('archive')}
<div class="snap-wrap">
  <div class="snap-hd"><h1>页面快照</h1><p>共 ${items.length} 份旧站页面快照，点击可直接查看</p></div>
  <ul class="snap-list">
${rows}
  </ul>
  <p style="margin-top:26px"><a href="/archive/" style="color:#0c8066">← 返回存档</a></p>
</div>
</body></html>`);
  }

  // 多语言页面 + 首页
  renderI18n();

  // 存档清单（新样式，数据来自旧存档页）
  const archiveListHtml = renderArchiveList(renderNav('archive'));
  if (archiveListHtml) {
    const dir = path.join(PUBLIC, 'archive', 'pages');
    ensure(dir);
    fs.writeFileSync(path.join(dir, 'index.html'), archiveListHtml);
  }

  // 还原站点清单（新样式）
  const mirrorHtml = renderMirrorList(renderNav('archive'));
  if (mirrorHtml) {
    const dir = path.join(PUBLIC, 'archive', 'mirror');
    ensure(dir);
    fs.writeFileSync(path.join(dir, 'index.html'), mirrorHtml);
  }

  // 存档中心 /archive/
  const hubData = JSON.parse(fs.readFileSync(path.join(PUBLIC, 'assets', 'data', 'site.json'), 'utf8'));
  const yearLinks = (hubData.years || []).map(y => `<a href="/archives/#y${y.y}"><b>${y.y}</b><span>${y.n} 篇</span></a>`).join('');
  ensure(path.join(PUBLIC, 'archive'));
  fs.writeFileSync(path.join(PUBLIC, 'archive', 'index.html'),
    T('archive-hub.html').replaceAll('{{NAV}}', renderNav('archive')).replaceAll('{{YEARS}}', yearLinks));
  if (MEDIA) rewriteMedia(PUBLIC, MEDIA);

  console.log(`✓ build ${posts.length} posts → public/  (${Date.now() - t0} ms)`);
}

/* ------------------------------------------------------------------ archive list */
/** 从旧存档清单页解析出按年份分组的数据 */
function parseArchiveList() {
  const file = path.join(ROOT, 'static', 'archive.html');
  if (!fs.existsSync(file)) return null;
  const html = read(file);
  const blocks = html.split(/<section class="year-block" id="y(\d{4})">/).slice(1);
  const years = [];
  for (let i = 0; i < blocks.length; i += 2) {
    const year = blocks[i];
    const seg = blocks[i + 1].split('</section>')[0];
    const head = (seg.match(/<div class="yh">([\s\S]*?)<\/div>/) || [, ''])[1];
    const meta = plain(head).replace(/^\d{4}\s*/, '');
    const rows = [];
    const re = /<div class="row">\s*<a class="title" href="([^"]+)">([\s\S]*?)<\/a>\s*<div class="sec">([\s\S]*?)<\/div>\s*<div class="ts">([\s\S]*?)<\/div>\s*<div class="act">([\s\S]*?)<\/div>\s*<\/div>/g;
    let m;
    while ((m = re.exec(seg))) {
      const [, href, title, sec, ts, act] = m;
      const org = act.match(/href="(https:\/\/web\.archive\.org\/[^"]+)"/);
      const date = act.match(/(20\d{2}-\d{2}-\d{2})/);
      rows.push({
        href: href.replace(/^snapshots\//, '/snapshots/'),
        title: plain(title), sec: plain(sec).replace(/\s*·\s*$/, ''),
        ts: plain(ts), org: org ? org[1] : '', date: date ? date[1] : '',
      });
    }
    years.push({ year, meta, rows });
  }
  return years;
}

function renderArchiveList(nav) {
  const years = parseArchiveList();
  if (!years) return null;
  const summary = plain(read(path.join(ROOT, 'static', 'archive.html'))
    .match(/<section class="page-hd">[\s\S]*?<p>([\s\S]*?)<\/p>/)?.[1] || '');
  const mPages = summary.match(/(\d+)\s*个页面/);
  const mSnaps = summary.match(/(\d+)\s*份/);
  const mRange = summary.match(/(20\d{2})\s*[—-]\s*(20\d{2})/);
  const pages = mPages ? Number(mPages[1]) : years.reduce((n, y) => n + y.rows.length, 0);
  const snaps = mSnaps ? Number(mSnaps[1]) : 0;
  const range = mRange ? `${mRange[1]}—${mRange[2]}`
    : `${years.map(y => y.year).sort()[0]}—${years.map(y => y.year).sort().slice(-1)[0]}`;
  const yearNav = years.map(y => `<a href="#y${y.year}">${y.year}</a>`).join('');
  const blocks = years.map(y => `
  <section class="ap-year" id="y${y.year}">
    <h2>${y.year}<span>${esc(y.meta)}</span></h2>
    <div class="ap-list">
      <div class="ap-head"><div>页面</div><div>分部 / 类型</div><div>快照</div><div>操作</div></div>
      ${y.rows.map(r => `<div class="ap-row">
        <a class="t" href="${esc(r.href)}">${esc(r.title)}</a>
        <div class="ap-sec">${esc(r.sec)}</div>
        <div class="ap-ts">${esc(r.ts)}</div>
        <div class="ap-act"><a href="${esc(r.href)}">查看快照</a>${r.org ? `<a class="alt" href="${esc(r.org)}" target="_blank" rel="noopener">原始档案</a>` : ''}<span>${esc(r.date)}</span></div>
      </div>`).join('')}
    </div>
  </section>`).join('\n');
  return T('archive-pages.html')
    .replaceAll('{{NAV}}', nav)
    .replaceAll('{{PAGES}}', String(pages))
    .replaceAll('{{SNAPS}}', String(snaps))
    .replaceAll('{{RANGE}}', range)
    .replaceAll('{{YEARNAV}}', yearNav)
    .replaceAll('{{BLOCKS}}', blocks);
}


/** 从旧「还原站点清单」解析表格数据 */
function parseMirrorList() {
  const file = path.join(ROOT, 'static', 'mirror-index.html');
  if (!fs.existsSync(file)) return null;
  const html = read(file);
  const sections = html.split(/<h2[^>]*>/).slice(1);
  const out = [];
  for (const sec of sections) {
    const title = plain(sec.split('</h2>')[0]).trim();
    const rows = [];
    const rowRe = /<tr>([\s\S]*?)<\/tr>/g;
    let m;
    while ((m = rowRe.exec(sec.split('</table>')[0]))) {
      const cells = [...m[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map(x => x[1]);
      if (!cells.length) continue;
      if (/原路径/.test(plain(cells[0]))) continue;
      const link = cells[0].match(/href="([^"]+)"/);
      rows.push({
        path: plain(cells[0]).trim(),
        href: link ? link[1] : '',
        status: cells[1] ? plain(cells[1]).trim() : '',
        snaps: cells[2] ? plain(cells[2]).trim() : '',
      });
    }
    if (title) out.push({ title, rows });
  }
  return out;
}

function renderMirrorList(nav) {
  const sections = parseMirrorList();
  if (!sections) return null;
  const total = sections.reduce((n, s2) => n + s2.rows.length, 0);
  const blocks = sections.map(sec => `
  <section class="ap-year">
    <h2>${esc(sec.title)}<span>${sec.rows.length} 项</span></h2>
    <div class="ap-list">
      <div class="ap-head"><div>原路径</div><div>状态</div><div>快照</div><div>操作</div></div>
      ${sec.rows.map(r => `<div class="ap-row">
        <a class="t" href="${esc(r.href || '#')}">${esc(r.path)}</a>
        <div class="ap-sec">${esc(r.status)}</div>
        <div class="ap-ts">${esc(r.snaps)}</div>
        <div class="ap-act">${r.href ? `<a href="${esc(r.href)}">打开页面</a>` : '<span>无快照</span>'}</div>
      </div>`).join('')}
    </div>
  </section>`).join('\n');
  return T('archive-pages.html')
    .replaceAll('{{NAV}}', nav)
    .replaceAll('{{PAGES}}', String(total))
    .replaceAll('{{SNAPS}}', '—')
    .replaceAll('{{RANGE}}', '按原始路径还原')
    .replaceAll('{{YEARNAV}}', '')
    .replaceAll('<h1 class="ap-title">存档清单</h1>', '<h1 class="ap-title">还原站点清单</h1>')
    .replaceAll('/archive/pages/">存档清单', '/archive/mirror/">还原站点')
    .replaceAll('{{BLOCKS}}', blocks);
}


/* ------------------------------------------------------------------ i18n */
function renderI18n() {
  const PAGE_TPL = T('page-i18n.html');
  const HOME_TPL = T('home-i18n.html');
  const media = MEDIA || '';
  const news = JSON.parse(read(path.join(PUBLIC, 'assets', 'data', 'news.json')));

  const altLinks = (lang) => LANGS
    .map(l => `<link rel="alternate" hreflang="${l.hreflang}" href="https://h2zbmh.cn${langPath(l.code, '')}">`)
    .join('\n');

  for (const L of LANGS.filter(x => x.code !== 'zh')) {
    const lang = L.code;
    const pages = I18N_PAGES[lang] || {};

    // 各内容页
    for (const [slug, pg] of Object.entries(pages)) {
      const dir = path.join(PUBLIC, lang, slug);
      ensure(dir);
      const html = PAGE_TPL
        .replaceAll('{{LANG}}', lang)
        .replaceAll('{{DIR}}', L.dir)
        .replaceAll('{{LANG_LABEL}}', esc(L.label))
        .replaceAll('{{ALT}}', altLinks(lang))
        .replaceAll('{{TITLE}}', esc(pg.title))
        .replaceAll('{{DESC}}', esc(pg.desc || ''))
        .replaceAll('{{BODY}}', md.render(pg.body || ''))
        .replaceAll('{{NAV}}', renderNav(slug === 'contact' ? 'contact' : slug, lang))
        .replaceAll('{{T_TOP_CONTACT}}', esc(tr(lang, 'top_contact')))
        .replaceAll('{{T_TOP_MAIL}}', esc(tr(lang, 'top_mail')))
        .replaceAll('{{T_CAMPUS_MAIN}}', esc(tr(lang, 'campus_main')))
        .replaceAll('{{T_CAMPUS_PRIMARY}}', esc(tr(lang, 'campus_primary')))
        .replaceAll('{{T_CAMPUS_MIDDLE}}', esc(tr(lang, 'campus_middle')))
        .replaceAll('{{T_NAV_HOME}}', esc(tr(lang, 'nav_home')))
        .replaceAll('{{T_NAV_ABOUT}}', esc(tr(lang, 'nav_about')))
        .replaceAll('{{T_NAV_CONTACT}}', esc(tr(lang, 'nav_contact')))
        .replaceAll('{{T_NAV_PRIVACY}}', esc(tr(lang, 'nav_privacy')))
        .replaceAll('{{T_FOOT_LINKS}}', esc(tr(lang, 'foot_links')))
        .replaceAll('{{T_FOOT_COPY}}', esc(tr(lang, 'foot_copyright')))
        .replaceAll('{{T_FOOT_ICP}}', esc(tr(lang, 'foot_icp')))
        .replaceAll('{{T_FOOT_PRIVACY}}', esc(tr(lang, 'foot_privacy')));
      fs.writeFileSync(path.join(dir, 'index.html'), html);
    }

    // 语言首页
    const dir = path.join(PUBLIC, lang);
    ensure(dir);
    const newsHtml = news.slice(0, 8).map(n =>
      `<a href="https://h2zbmh.cn${n.url}"><div class="d">${esc(n.date)}</div><div class="t">${esc(n.title)}</div></a>`
    ).join('');
    const home = HOME_TPL
      .replaceAll('{{LANG}}', lang)
      .replaceAll('{{DIR}}', L.dir)
      .replaceAll('{{LANG_LABEL}}', esc(L.label))
      .replaceAll('{{ALT}}', altLinks(lang))
      .replaceAll('{{MEDIA}}', media)
      .replaceAll('{{NAV}}', renderNav('home', lang))
      .replaceAll('{{T_TOP_CONTACT}}', esc(tr(lang, 'top_contact')))
      .replaceAll('{{T_TOP_MAIL}}', esc(tr(lang, 'top_mail')))
      .replaceAll('{{T_CAMPUS_MAIN}}', esc(tr(lang, 'campus_main')))
      .replaceAll('{{T_CAMPUS_PRIMARY}}', esc(tr(lang, 'campus_primary')))
      .replaceAll('{{T_CAMPUS_MIDDLE}}', esc(tr(lang, 'campus_middle')))
      .replaceAll('{{T_HERO_TITLE}}', esc(tr(lang, 'hero_title')))
      .replaceAll('{{T_HERO_SUB}}', esc(tr(lang, 'hero_sub')))
      .replaceAll('{{T_NEWS_TITLE}}', esc(tr(lang, 'news_title')))
      .replaceAll('{{T_NEWS_MORE}}', esc(tr(lang, 'news_more')))
      .replaceAll('{{T_NAV_ABOUT}}', esc(tr(lang, 'nav_about')))
      .replaceAll('{{T_NAV_CONTACT}}', esc(tr(lang, 'nav_contact')))
      .replaceAll('{{T_NAV_PRIVACY}}', esc(tr(lang, 'nav_privacy')))
      .replaceAll('{{T_FOOT_COPY}}', esc(tr(lang, 'foot_copyright')))
      .replaceAll('{{T_FOOT_ICP}}', esc(tr(lang, 'foot_icp')))
      .replaceAll('{{T_FOOT_PRIVACY}}', esc(tr(lang, 'foot_privacy')))
      .replaceAll('<!--NEWS-->', newsHtml)
      .replace('{{NEWS}}', newsHtml)
      .replace('{{NEWS_NOTE}}', `<div class="note">${esc(tr(lang, 'news_note'))}</div>`)
      .replace('{{T_ABOUT_SUM}}', esc((pages.about?.desc) || ''))
      .replace('{{T_CONTACT_SUM}}', esc((pages.contact?.desc) || ''))
      .replace('{{T_PRIVACY_SUM}}', esc((pages.privacy?.desc) || ''));
    fs.writeFileSync(path.join(dir, 'index.html'), home);
  }
}

function langPath(code, slug) {
  return (code === 'zh' ? '/' : `/${code}/`) + (slug ? slug + '/' : '');
}

/* ------------------------------------------------------------------ archive */
/** 把存档相关页面统一收进 /archive/，并在原地址留跳转 */
function relocateArchive() {
  const moves = [];
  const fix = (html) => html
    .replace(/(href|src)="assets\//g, '$1="/assets/')
    .replace(/(href|src)="snapshots\//g, '$1="/snapshots/')
    .replace(/href="mecbmh\//g, 'href="/mecbmh/')
    .replace(/href="bmhenrol\//g, 'href="/bmhenrol/')
    .replace(/href="about\.html"/g, 'href="/about/"')
    .replace(/href="archive\.html/g, 'href="/archive/pages/')
    .replace(/href="mirror-index\.html"/g, 'href="/archive/mirror/"');

  for (const m of moves) {
    const src = path.join(PUBLIC, m.from);
    if (!fs.existsSync(src)) continue;
    const html = fix(read(src));
    const dst = path.join(PUBLIC, m.to);
    ensure(path.dirname(dst));
    fs.writeFileSync(dst, html);
    // 原地址 → 跳转
    fs.writeFileSync(src, `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">`
      + `<title>页面已迁移</title><meta http-equiv="refresh" content="0;url=/${m.to.replace(/index\.html$/, '')}">`
      + `<link rel="canonical" href="/${m.to.replace(/index\.html$/, '')}"></head>`
      + `<body><p>页面已迁移至 <a href="/${m.to.replace(/index\.html$/, '')}">/${m.to.replace(/index\.html$/, '')}</a></p></body></html>`);
  }
}

/* ------------------------------------------------------------------ media rewrite */
/** 把页面里的本地图片引用替换成对象存储外链，仓库只留源码与页面 */
function rewriteMedia(dir, base) {
  const exts = new Set(['.html', '.css', '.js', '.json']);
  const patterns = [
    [/src="\/images\//g, `src="${base}/images/`],
    [/href="\/images\//g, `href="${base}/images/`],
    [/url\((['"]?)\/images\//g, `url($1${base}/images/`],
    [/src="\/assets\/img\//g, `src="${base}/assets/img/`],
    [/href="\/assets\/img\//g, `href="${base}/assets/img/`],
    [/url\((['"]?)\/assets\/img\//g, `url($1${base}/assets/img/`],
    [/"\/images\//g, `"${base}/images/`],
    [/'\/images\//g, `'${base}/images/`],
    [/"\/assets\/img\//g, `"${base}/assets/img/`],
    [/'\/assets\/img\//g, `'${base}/assets/img/`],
  ];
  let changed = 0;
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) { walk(full); continue; }
      if (!exts.has(path.extname(e.name).toLowerCase())) continue;
      let txt = fs.readFileSync(full, 'utf8');
      const before = txt;
      for (const [re, rep] of patterns) txt = txt.replace(re, rep);
      if (txt !== before) { fs.writeFileSync(full, txt); changed++; }
    }
  })(dir);
  if (changed) console.log(`  media → ${base}  (${changed} files rewritten)`);
}

/* ------------------------------------------------------------------ serve / watch */
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

function serve(port) {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const f = path.join(PUBLIC, p);
    if (!f.startsWith(PUBLIC) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h1>404</h1>');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  server.listen(port, '127.0.0.1', () => console.log(`→ http://127.0.0.1:${port}/`));
}

build();
if (WATCH) {
  let timer = null;
  const rebuild = () => { clearTimeout(timer); timer = setTimeout(() => { try { build(); } catch (e) { console.error('build error:', e.message); } }, 120); };
  fs.watch(path.join(SRC, '_posts'), rebuild);
  fs.watch(path.join(THEME, 'templates'), rebuild);
  fs.watch(path.join(THEME, 'assets'), { recursive: true }, rebuild);
  console.log('watching source/_posts, theme/ …');
}
if (SERVE || WATCH) serve(PORT);
