/* 旧站数字存档 · Vue 3 单页（本地预览）
   版式对标 www.hz2hs.cn：顶栏40 / 页头65 / 导航44 / 焦点图600 / 公告浮条90
   部署时把 SITE 改为 '' 即使用相对链接 */
const SITE = 'https://h2zbmh.cn';
const { createApp, ref, onMounted, onBeforeUnmount } = Vue;
const DATA = await fetch('/assets/data/site.json').then(r => r.json());
const NEWS = await fetch('/assets/data/news.json').then(r => r.json());
const SNAP = s => SITE + '/snapshots/' + s + '.html';

const useTimer = (fn, ms) => {
  let t = null;
  onMounted(() => { t = setInterval(fn, ms); });
  onBeforeUnmount(() => clearInterval(t));
};

/* icons */
const ICON = {
  phone: '<svg viewBox="0 0 24 24"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.6.1.4 0 .8-.2 1l-2.3 2.2z"/></svg>',
  mail: '<svg viewBox="0 0 24 24"><path d="M3 5h18c.6 0 1 .4 1 1v12c0 .6-.4 1-1 1H3c-.6 0-1-.4-1-1V6c0-.6.4-1 1-1zm9 7.2L4.6 7h14.8L12 12.2z"/></svg>',
  globe: '<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm6.9 6h-2.6a15 15 0 0 0-1.2-3.4A8 8 0 0 1 18.9 8zM12 4.1c.6 1 1.2 2.3 1.6 3.9h-3.2c.4-1.6 1-2.9 1.6-3.9zM4.3 14a8 8 0 0 1 0-4h2.8a17 17 0 0 0 0 4H4.3zm.8 2h2.6c.3 1.2.7 2.4 1.2 3.4A8 8 0 0 1 5.1 16zm2.6-8H5.1a8 8 0 0 1 3.8-3.4A15 15 0 0 0 7.7 8zM12 19.9c-.6-1-1.2-2.3-1.6-3.9h3.2c-.4 1.6-1 2.9-1.6 3.9zM14 14h-4a15 15 0 0 1 0-4h4a15 15 0 0 1 0 4zm1.1 5.4c.5-1 1-2.2 1.2-3.4h2.6a8 8 0 0 1-3.8 3.4zM16.9 14a17 17 0 0 0 0-4h2.8a8 8 0 0 1 0 4h-2.8z"/></svg>',
  search: '<svg viewBox="0 0 24 24"><path d="M15.5 14h-.8l-.3-.3a6.5 6.5 0 1 0-.7.7l.3.3v.8l5 5 1.5-1.5-5-5zm-6 0a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9z"/></svg>',
  pin: '<svg viewBox="0 0 24 24"><path d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z"/></svg>',
  house: '<svg viewBox="0 0 64 64"><path d="M8 30 L32 10 L56 30"/><path d="M14 30 V54 H50 V30"/><path d="M26 54 V40 H38 V54"/></svg>',
  book: '<svg viewBox="0 0 64 64"><path d="M32 16 C26 11 14 11 10 13 V50 C16 48 26 48 32 52"/><path d="M32 16 C38 11 50 11 54 13 V50 C48 48 38 48 32 52"/><path d="M32 16 V52"/></svg>'
};

const TopBar = {
  template: `
  <div class="topbar">
    <div class="wrap">
      <span class="item"><i v-html="ICON.phone" style="display:flex"></i>联系我们：0571-86798900</span>
      <span class="sep">|</span>
      <span class="item"><i v-html="ICON.mail" style="display:flex"></i>校长信箱：——</span>
      <span class="sep">|</span>
      <div class="langdrop">
        <span class="item cur"><i v-html="ICON.globe" style="display:flex"></i>中文</span>
        <div class="sub">
          <a class="on" href="/">中文</a>
          <a href="/en/" hreflang="en">English</a>
          <a href="/fr/" hreflang="fr">Français</a>
          <a href="/ru/" hreflang="ru">Русский</a>
          <a href="/es/" hreflang="es">Español</a>
          <a href="/ar/" hreflang="ar">العربية</a>
          <a href="/ja/" hreflang="ja">日本語</a>
          <a href="/ko/" hreflang="ko">한국어</a>
          <a href="/de/" hreflang="de">Deutsch</a>
          <a href="/pt/" hreflang="pt">Português</a>
          <a href="/it/" hreflang="it">Italiano</a>
        </div>
      </div>
      <div class="right">
        <i v-html="ICON.search" style="display:flex"></i>
        <input :value="q" @input="q = $event.target.value" @keyup.enter="go" placeholder="搜索">
        <button @click="go">搜索</button>
      </div>
    </div>
  </div>`,
  setup(){
    const q = ref('');
    const go = () => { const v = q.value.trim(); if (v) location.href = SITE + '/archive.html?q=' + encodeURIComponent(v); };
    return { ICON, q, go };
  }
};

const Header = {
  template: `
  <div class="hd">
    <div class="wrap">
      <div class="campus">
        <a :href="SITE + '/mecbmh/bmhxx/homepage/'"><i v-html="ICON.pin" style="display:flex"></i>总校</a>
        <span class="sep">|</span>
        <a :href="SITE + '/mecbmh/bmhprimary/homepage/'"><i v-html="ICON.pin" style="display:flex"></i>小学部</a>
        <span class="sep">|</span>
        <a :href="SITE + '/mecbmh/bmhmiddle/homepage/'"><i v-html="ICON.pin" style="display:flex"></i>初中部</a>
      </div>
      <a class="logo" :href="SITE + '/'" style="color:inherit">
        <img class="logoimg" src="https://cn-sy1.rains3.com/h2zbmh/assets/img/logo.png" alt="杭州二中白马湖学校">
      </a>
      <div class="empty"></div>
    </div>
  </div>`,
  setup(){ return { SITE, ICON }; }
};

const Nav = {
  template: `
  <div class="nav">
    <div class="wrap">
      <div class="nv" v-for="it in items" :key="it.key" :class="{ on: it.key === 'home' }">
        <a :href="it.href || 'javascript:;'">{{ it.label }}</a>
        <div class="sub" v-if="it.sub"><a v-for="s in it.sub" :key="s.label" :href="s.href">{{ s.label }}</a></div>
      </div>
    </div>
  </div>`,
  setup(){
    const years = DATA.years.map(y => ({ label: y.y + ' 年', href: SITE + '/archive.html#y' + y.y }));
    return {
      items: [
        { key:'home', label:'首页', href: SITE + '/' },
        { key:'about', label:'学校概况', href: SITE + '/about/' },
        { key:'news', label:'校园新闻', href: SITE + '/archives/' },
        { key:'contact', label:'联系我们', href: SITE + '/contact/' },
        { key:'campus', label:'多彩校园', href: SITE + '/#gallery' },
        { key:'privacy', label:'隐私政策', href: SITE + '/privacy/' },
        { key:'archive', label:'存档', sub:[
            { label:'存档总览', href: SITE + '/archive/' },
            { label:'存档清单', href: SITE + '/archive/pages/' },
            { label:'还原站点', href: SITE + '/archive/mirror/' },
            { label:'页面快照', href: SITE + '/snapshots/' } ] }
      ]
    };
  }
};

const Banner = {
  template: `
  <div class="banner">
    <div class="slide" v-for="(s, i) in slides" :key="i" :class="{ on: cur === i }" :style="{ backgroundImage: 'url(' + s.img + ')' }"></div>
    <div class="veil"></div>
    <div class="txt">
      <h1>{{ slides[cur].t }}</h1>
      <p>{{ slides[cur].en }}</p>
    </div>
    <div class="pn"><span @click="prev">‹</span><span @click="next">›</span></div>
    <div class="dots"><i v-for="(s, i) in slides" :key="i" :class="{ on: cur === i }" @click="cur = i"></i></div>
  </div>`,
  setup(){
    const slides = [
      { img: 'https://cn-sy1.rains3.com/h2zbmh/assets/img/wp-hero-1.jpg', t: '让每个孩子都有人生出彩的机会', en: 'HANGZHOU NO.2 HIGH SCHOOL OF BAIMAHU' },
      { img: 'https://cn-sy1.rains3.com/h2zbmh/assets/img/wp-hero-2.jpg', t: '白马湖校超 · 让身上有汗 眼里有光', en: 'BAIMAHU CAMPUS LEAGUE' },
      { img: 'https://cn-sy1.rains3.com/h2zbmh/assets/img/wp-hero-3.jpg', t: '科技进课堂 · 让学习真实发生', en: 'SCIENCE & TECHNOLOGY IN CLASS' }
    ];
    const cur = ref(0);
    const next = () => { cur.value = (cur.value + 1) % slides.length; };
    const prev = () => { cur.value = (cur.value - 1 + slides.length) % slides.length; };
    useTimer(next, 5500);
    return { SITE, slides, cur, next, prev };
  }
};

const NoticeBar = {
  template: `
  <div class="notice">
    <div class="bar">
      <span class="lb">通知公告</span>
      <div class="line">
        <div class="it" v-for="(n, i) in items" :key="i" :class="{ on: cur === i }">
          <span class="d">{{ n.d }}</span>
          <a class="t" :href="SITE + '/' + n.href">{{ n.t }}</a>
        </div>
      </div>
      <div class="dots"><i v-for="(n, i) in items" :key="i" :class="{ on: cur === i }" @click="cur = i"></i></div>
    </div>
  </div>`,
  setup(){
    const items = [
      { d: '——', t: '——————————————', href: 'about.html' },
      { d: '——', t: '——————————————', href: 'about.html' },
      { d: '——', t: '——————————————', href: 'about.html' }
    ];
    const cur = ref(0);
    useTimer(() => { cur.value = (cur.value + 1) % items.length; }, 5000);
    return { SITE, items, cur };
  }
};

const News = {
  template: `
  <section class="news" id="news">
    <div class="wrap">
      <div class="hdrow">
        <h2>校园新闻</h2>
        <div class="r">
          <span>更多新闻</span>
          <a class="btn" href="#news-all">Read More</a>
        </div>
      </div>
      <div class="body">
        <div class="left">
          <div class="cards">
            <a class="card" v-for="it in cards" :key="it.slug" :href="it.url">
              <div class="im"><img v-if="it.cover" :src="it.cover" :alt="it.title"></div>
              <h3>{{ it.title }}</h3>
              <div class="d">{{ it.date }}</div>
            </a>
          </div>
        </div>
        <div class="right">
          <ul>
            <li v-for="it in side" :key="it.slug">
              <a :href="it.url"><h3>{{ it.title }}</h3></a>
              <div class="d">{{ it.date }}</div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </section>`,
  setup(){
    const cards = NEWS.slice(0, 4);
    const side = NEWS.slice(4, 10);
    return { cards, side };
  }
};

const Pair = {
  template: `
  <section class="pair">
    <a class="c a" :href="SITE + '/about/'">
      <span class="ico" v-html="ICON.house"></span>
      <h3>德育之窗</h3>
      <p>——————————————————————</p>
    </a>
    <a class="c b" :href="SITE + '/archive/mirror/'">
      <span class="ico" v-html="ICON.book"></span>
      <h3>教育科研</h3>
      <p>——————————————————————</p>
    </a>
  </section>`,
  setup(){ return { SITE, ICON }; }
};

const Mosaic = {
  template: `
  <section class="mosaic">
    <div class="grid">
      <a class="ph wide" :href="SITE + '/mecbmh/bmhxx/homepage/'">
        <img src="https://cn-sy1.rains3.com/h2zbmh/assets/img/wp-mos-big.jpg" alt="总校首页存档"><span>总校首页</span>
      </a>
      <a class="card" :href="SITE + '/about/'">
        <div class="a">——</div>
        <h3>办学成绩</h3>
        <div class="ln"></div>
        <p>————————<br>————————</p>
      </a>
      <a class="ph small" :href="SITE + '/mecbmh/bmhprimary/homepage/'">
        <img src="https://cn-sy1.rains3.com/h2zbmh/assets/img/wp-mos-s1.jpg" alt="小学部"><span>小学部</span>
      </a>
      <a class="ph third" :href="SITE + '/mecbmh/bmhmiddle/homepage/'">
        <img src="https://cn-sy1.rains3.com/h2zbmh/assets/img/wp-mos-r1.jpg" alt="初中部"><span>初中部</span>
      </a>
      <a class="ph third" :href="SITE + '/archive/'">
        <img src="https://cn-sy1.rains3.com/h2zbmh/assets/img/wp-mos-r2.jpg" alt="校园新闻"><span>校园新闻</span>
      </a>
      <a class="ph third" :href="SITE + '/mecbmh/'">
        <img src="https://cn-sy1.rains3.com/h2zbmh/assets/img/wp-mos-r3.jpg" alt="学生活动"><span>学生活动</span>
      </a>
    </div>
  </section>`,
  setup(){ return { SITE }; }
};

const Gallery = {
  template: `
  <section class="gallery">
    <div class="cap">
      <h2>多彩校园</h2>
      <p>——————————————————</p>
    </div>
    <div class="gal">
      <a v-for="(it, i) in items" :key="i" :class="{ wide: i === 0 || i === 5 }" :href="SITE + '/' + it.href">
        <img :src="'https://cn-sy1.rains3.com/h2zbmh/assets/img/wp-gal-' + (i + 1) + '.jpg'" :alt="it.name">
        <span>{{ it.name }}</span>
      </a>
    </div>
  </section>`,
  setup(){ return { SITE, items: DATA.gallery }; }
};

const Achieve = {
  template: `
  <section class="achv">
    <div class="cap">
      <h2>办学成就</h2>
      <p>——————————————————</p>
    </div>
    <div class="grid">
      <div class="ph"><img src="https://cn-sy1.rains3.com/h2zbmh/assets/img/wp-achv.jpg" alt="存档影像"></div>
      <div class="num"><b>150</b><span>历史快照总数</span></div>
      <a class="blk" :href="SITE + '/mecbmh/'"></a>
    </div>
  </section>`,
  setup(){ return { SITE }; }
};

const Cols = {
  template: `
  <section class="cols">
    <div class="wrap">
      <div class="grid"><span v-for="c in items" :key="c">{{ c }}</span></div>
    </div>
  </section>`,
  setup(){ return { items: DATA.columns }; }
};

const FootMap = {
  template: `
  <div class="footmap">
    <div class="wrap">
      <div class="grid">
        <div><h4>校园站点</h4><ul>
          <li><a :href="SITE + '/mecbmh/bmhxx/homepage/'">总校首页</a></li>
          <li><a :href="SITE + '/mecbmh/bmhprimary/homepage/'">小学部首页</a></li>
          <li><a :href="SITE + '/mecbmh/bmhmiddle/homepage/'">初中部首页</a></li>
          <li><a :href="SITE + '/mecbmh/'">站点目录</a></li>
        </ul></div>
        <div><h4>分部站点</h4><ul>
          <li><a :href="SITE + '/mecbmh/bmhxx/homepage/'">总校</a></li>
          <li><a :href="SITE + '/mecbmh/bmhprimary/homepage/'">小学部</a></li>
          <li><a :href="SITE + '/mecbmh/bmhmiddle/homepage/'">初中部</a></li>
          <li><a :href="SITE + '/mecbmh/'">/mecbmh 目录树</a></li>
        </ul></div>
        <div><h4>关于</h4><ul>
          <li><a :href="SITE + '/about/'">站点概况</a></li>
          <li><a :href="SITE + '/about/'">——</a></li>
          <li><a href="https://web.archive.org/" target="_blank" rel="noopener">Internet Archive</a></li>
        </ul></div>
        <div><h4>友情链接</h4><ul>
          <li><a href="https://blog.nanoturtle.cn/" target="_blank" rel="noopener">NanoTurtle的小窝</a></li>
          <li><a href="https://www.hopestudio.top/" target="_blank" rel="noopener">希望工作室 · Hope Studio</a></li>
          <li><a href="http://www.hz2hs.cn/" target="_blank" rel="noopener">浙江省杭州第二中学</a></li>
          <li><a :href="SITE + '/links/'">友情链接说明</a></li>
        </ul></div>
      </div>
    </div>
  </div>`,
  setup(){ return { SITE }; }
};

const Footer = {
  template: `
  <div class="foot">
    <div class="wrap">
      <span>© 浙江省杭州二中白马湖学校版权所有</span><span>|</span>
      <span>备案证编号：浙ICP备15017196</span><span>|</span>
      <span>地址：滨江区天马路 500 号　电话：0571-86798900</span>
      <div class="r">
        <a :href="SITE + '/about/'">网站地图</a>
        <a :href="SITE + '/links/'">友情链接</a>
        <a :href="SITE + '/about/'">法律声明</a>
      </div>
    </div>
  </div>`,
  setup(){ return { SITE }; }
};

createApp({
  components: {
    'top-bar': TopBar, 'site-header': Header, 'main-nav': Nav, 'banner-box': Banner,
    'notice-bar': NoticeBar, 'news-block': News, 'pair-block': Pair, 'mosaic-block': Mosaic,
    'gallery-block': Gallery, 'achieve-block': Achieve, 'cols-block': Cols,
    'foot-map': FootMap, 'site-footer': Footer
  },
  template: `
  <div>
    <top-bar></top-bar>
    <site-header></site-header>
    <main-nav></main-nav>
    <banner-box></banner-box>
    <notice-bar></notice-bar>
    <news-block></news-block>
    <pair-block></pair-block>
    <mosaic-block></mosaic-block>
    <gallery-block></gallery-block>
    <achieve-block></achieve-block>
    <cols-block></cols-block>
    <foot-map></foot-map>
    <site-footer></site-footer>
  </div>`
}).mount('#app');
