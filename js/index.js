(() => {
  window.AD_CONFIG.layer = (() => {
    let cbs = [];
    
    return {
      add: (cb) => {
        if(cbs.includes(cb)) {
          return false;
        }
        cbs.push(cb);
        return true;
      },
      remove: (cb) => {
        let index = cbs.indexOf(cb);
        if(index === -1) {
          return false;
        }
        cbs.splice(index, 1);
        return true;
      },
      // trigger before layer to be closed
      trigger: () => {
        cbs.forEach(cb => cb());
        cbs = [];
      }
    }
  })();

  const loadScript = (src) => {
    let exists = false;
  
    return () => new Promise((resolve) => {
      if(exists) return resolve();
      // 防止没有触发下方的onload时候, 又调用此函数重复加载
      exists = true;
      // 开始加载
      let script = document.createElement('script');
      script.src = src;
      script.type = 'text/javascript';
      script.async = 'async';
      script.onerror = (ev) => {
        // 加载失败: 允许外部再次加载
        script.remove();
        exists = false;
        resolve(false);
      };
      script.onload = () => {
        // 加载成功: exists一直为true, 不会多次加载
        resolve(true);
      };
      document.body.appendChild(script);
    });
  };

  const { root } = window.AD_CONFIG;

  // load after DOM built
  const documentSrcs = [
    'js/copy.js',
    'js/layer.js',
    'js/scroll.js',
    'js/backTop.js',
    'js/time.js',
    'js/header.js',
    'js/passage.js',
    'js/share.js',
    'js/reward.js',
  ].map(item => `${root}${item}`);

  // load after all srcs loaded
  const windowSrcs = [
    'js/leancloud.js',
    'js/mathjax.js',
  ].map(item => `${root}${item}`);

  const documentSrcScripts = documentSrcs.map(src => loadScript(src));
  const windowSrcScripts = windowSrcs.map(src => loadScript(src));

  document.addEventListener('DOMContentLoaded', () => {
    documentSrcScripts.forEach(script => script());
  });

  window.addEventListener('load', () => {
    windowSrcScripts.forEach(script => script());
  });
})();
(() => {
  const { leancloud, welcome } = window.AD_CONFIG;
  let totalVisit = 0;
  welcome.interval = Math.abs(parseInt(welcome.interval, 10)) || 30;

  function getPsgID(pathname) {
    if(!pathname) {
      pathname = window.location.pathname;
    }

    let names = pathname.split('/');
    for(let i = names.length - 1; i >= 0; --i) {
      let name = names[i].trim();
      if(name.length > 0 && name !== '/' && name !== 'index.html') {
        return name;
      }
    }
    return '/';
  }

  function _updateCommentNum() {
    const infoDOM = document.querySelector('#site-comment-info'),
      url = getPsgID(),
      _ts = 1000;
    let running = false;

    return (ts = _ts) => {
      if(running) {
        return;
      }
      setTimeout(() => {
        running = true;
        let query = new AV.Query('Comment');
        query.equalTo('url', url);
        query.count()
          .then(num => {
            infoDOM.innerHTML = `共${num}条评论`;
            running = false;
          });
      }, ts);
    }
  }

  function active() {
    if(leancloud.comment === false && leancloud.count === false) {
      return false;
    }
    return true;
  }

  function init() {
    try {
      window.AV.init(leancloud.appid, leancloud.appkey);
      return true;
    } catch(error) {
      return false;
    }
  }

  function log() {
    let pathname = decodeURIComponent(window.location.pathname);
    !pathname.endsWith('/') && (pathname = pathname + '/');

    let Counter = AV.Object.extend('Counter');
    let counter = new Counter();
    counter.set('visit_time', new Date().getTime().toString());
    counter.set('user_agent', window.navigator.userAgent);
    counter.set('identity_path', pathname);
    counter.set('more_info', JSON.stringify(window.location));

    let acl = new AV.ACL();
    acl.setPublicReadAccess(true);
    acl.setPublicWriteAccess(false);

    counter.setACL(acl);
    counter.save();
  }

  function count() {
    let query = new AV.Query('Counter');
    return new Promise(resolve => {
      query
        .count()
        .then(
          res => resolve(res + 1), 
          error => {
            console.log('Error occurs when count in leancloud.js:', error.message);
            resolve(0);
          }
        );
    });
  }

  function showWelcome() {
    const day = 60 * 60 * 24 * 1000;
    const layer = document.querySelector('#site-layer'),
      welcomeDOM = document.querySelector('#site-layer-welcome'),
      title = document.querySelector('#site-layer-title');
  
    let visitTime = parseInt(atob(window.localStorage.getItem('visit_time')), 10),
      now = Date.now(),
      offsetDays = 0;
    
    window.localStorage.setItem('visit_time', btoa(now.toString()));
  
    if(layer.style.display !== 'none' || !totalVisit) {
      return;
    }

    offsetDays = Math.ceil((now - visitTime) / day);
  
    if(isNaN(offsetDays)) {
      layer.style.display = 'block';
      title.innerHTML = '欢迎到来';
      welcomeDOM.innerHTML = `您是本站的第${totalVisit}位访问者`;
      welcomeDOM.style.display = 'flex';
    } else if (offsetDays >= welcome.interval) {
      layer.style.display = 'block';
      title.innerHTML = '欢迎回来';
      welcomeDOM.innerHTML = '您很久没来小站看看啦';
      welcomeDOM.style.display = 'flex';
    } else {
      return;
    }
  
    window.AD_CONFIG.layer.add(() => {
      title.innerHTML = '';
      welcomeDOM.innerHTML = '';
      welcomeDOM.style.display = 'none';
    });
  }

  if(!active()) {
    return;
  }

  if(!init()) {
    return;
  }

  if(leancloud.count === true) {
    count().then(res => {
      document.querySelector('#site-count').innerHTML = res;
      totalVisit = res;
      welcome.enable && showWelcome();
    });
    log();
  }

  if(leancloud.comment === true) {
    const commentDOM = document.querySelector('#site-comment');
    if(!commentDOM) {
      return;
    }

    const updateCommentNum = _updateCommentNum();
    updateCommentNum(0);

    new Valine({
      el: '#site-comment',
      appId: leancloud.appid,
      appKey: leancloud.appkey,
      notify: false,
      verify: false,
      avatar: "robohash",
      placeholder: "正确填写邮箱, 才能及时收到回复哦♪(^∇^*)",
      path: getPsgID()
    });

    document.querySelector('.vsubmit.vbtn').addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      updateCommentNum(1000);
    });
  }
})();
(() => {
  const { mathjax } = window.AD_CONFIG;
  if(!mathjax) {
    return;
  }

  const mathjaxConfig = {
    showProcessingMessages: false, //关闭js加载过程信息
    messageStyle: "none", //不显示信息
    jax: ["input/TeX", "output/HTML-CSS"],
    tex2jax: {
      inlineMath: [["$", "$"], ["\\(", "\\)"]], //行内公式选择符
      displayMath: [["$$", "$$"], ["\\[", "\\]"]], //段内公式选择符
      skipTags: ["script", "noscript", "style", "textarea", "pre", "code", "a"] //避开某些标签
    },
    "HTML-CSS": {
      availableFonts: ["STIX", "TeX"], //可选字体
      showMathMenu: false //关闭右击菜单显示
    }
  };

  window.MathJax.Hub.Config(mathjaxConfig);
  window.MathJax.Hub.Queue(["Typeset", MathJax.Hub, document.querySelector('main')]);
})();
(() => {
  const auth = () => {
    const day = 60 * 60 * 24 * 1000;
    const { is_post, lock, passwords, root } = window.AD_CONFIG;

    if(is_post === false || lock === false) {
      return;
    }

    let [password, expires] = atob(window.localStorage.getItem('auth')).split(':'),
      now = new Date().getTime();

    if(passwords.includes(password) && now < expires) {
      return; 
    }

    password = prompt('输入文章访问密码（密码可发anjiejo@qq.com邮件获取）');
    password = sha256(password || '');

    if(passwords.includes(password)) {
      expires = now + day * 3;
      window.localStorage.setItem('auth', btoa(`${password}:${expires}`));
    } else {
      alert('您没有阅读权限');
      window.location.href = root;
    }
  };

  // print github and demo info
  console.log(
    '\n%c Theme-AD v2.6.0 %c' + 
    ' 🎉 https://github.com/dongyuanxin/theme-ad 🎉\n' + 
    '\n%c Preview Online %c' + 
    ' 🔍 https://godbmw.com/ 🔍  \n' +
    '\n  Welcome Page ' + 
    ' 😃 你好！欢迎来到本站！ 😃  \n' +
    '  📧 站长反馈邮箱：anjiejo@qq.com  📧 \n', 
    'color: #fadfa3; background: #030307; padding:3px 0;', '', 'color: #fadfa3; background: #030307; padding:3px 0;', ''
  );

  // article password auth
  auth();
})();
(() => {
  const rewardDOM = document.querySelector('#site-reward');
  if(!rewardDOM) {
    return;
  }

  const layer = document.querySelector('#site-layer'),
    title = document.querySelector('#site-layer-title'),
    rewardContainerDOM = document.querySelector('#site-layer-reward');
  
  if(!rewardContainerDOM) {
    return;
  }

  rewardDOM.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    layer.style.display = 'block';
    title.innerHTML = '打赏赞助';
    rewardContainerDOM.style.display = 'flex';

    window.AD_CONFIG.layer.add(() => {
      title.innerHTML = '';
      rewardContainerDOM.style.display = 'none';
    });
  });
})();
(() => {
  const handleScoll = (() => {
    const process = document.querySelector('#site-process');
    let isRunning = false;
    
    return () => {
      if (isRunning) return;
      isRunning = true;

      window.requestAnimationFrame(ts => {
        let scrollTop = document.documentElement.scrollTop || document.body.scrollTop,
          scrollHeight = document.documentElement.scrollHeight || document.body.scrollHeight,
          clientHeight = document.documentElement.clientHeight || document.body.clientHeight;

        isRunning = false;

        let percent = 100 * scrollTop / (scrollHeight - clientHeight);
        if(percent > 99) {
          percent = 100;
        } else if (percent < 1) {
          percent = 0;
        }

        process.style.width = `${percent}%`;
      });
    };
  })();

  // Refresh Page
  handleScoll();

  document.addEventListener('scroll', handleScoll, false);
})();
(() => {
  function stringfy(params = {}) {
    let str = '?';
    for(let key of Reflect.ownKeys(params)) {
      let value = !!params[key] ? encodeURIComponent(params[key]) : ''; 
      str = `${str}${key}=${value}&`;
    }
    return str.slice(0, str.length - 1);
  }

  function toggleShareBtn() {
    let show = false;
    const shareBtnDOM = document.querySelector('#share-btn');

    return (e) => {
      e.stopPropagation();
      e.preventDefault();
      show = !show;
      shareBtnDOM.style.display = show ? 'flex' : 'none';
    };
  }

  const mapSocialToUrl = (() => {
    const baseUrls = {
      twitter: 'https://twitter.com/intent/tweet',
      facebook: 'https://www.facebook.com/sharer/sharer.php',
      qq: 'http://connect.qq.com/widget/shareqq/index.html',
      weibo: 'http://service.weibo.com/share/share.php'
    };

    const title = document.title;
    const description = document.querySelector("meta[name='description']").getAttribute('content');
    const url = `${window.location.origin}${window.location.pathname}`;

    const params = {
      twitter: {
        url,
        text: `${title}\n\n${description}\n\n`,
        via: window.location.origin
      },
      facebook: {
        u: url
      },
      weibo: {
        url,
        title: `${title}\n\n${description}`
      },
      qq: {
        url,
        title,
        desc: description
      },
    };

    return {
      twitter: `${baseUrls.twitter}${stringfy(params.twitter)}`,
      facebook: `${baseUrls.facebook}${stringfy(params.facebook)}`,
      weibo: `${baseUrls.weibo}${stringfy(params.weibo)}`,
      qq: `${baseUrls.qq}${stringfy(params.qq)}`,
    }
  })();

  const pfxCls = '#share-btn';
  const { share } = window.AD_CONFIG;
  const socials = Reflect.ownKeys(share).filter(social => share[social]);

  for(let social of socials) {
    if(social === 'wechat') {
      continue;
    }
    document
      .querySelector(`${pfxCls}-${social}`)
      .setAttribute('href', mapSocialToUrl[social]);
  }

  if(!socials.includes('wechat')) {
    return;
  }

  // wechat share by qrcode
  document.querySelector('#share-btn-wechat').addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    const layer = document.querySelector('#site-layer'),
      container = document.querySelector('#site-layer-container'),
      title = document.querySelector('#site-layer-title'),
      newDOM = document.createElement('div');

    layer.style.display = 'block';
    title.innerHTML = '微信分享';
    container.appendChild(newDOM);

    const qrcode = new QRCode(newDOM, {
      text: `${window.location.origin}${window.location.pathname}`,
      width: 256,
      height: 256,
      colorDark: "#000000",
      colorLight: "#ffffff",
      correctLevel : QRCode.CorrectLevel.H
    });

    window.AD_CONFIG.layer.add(() => {
      title.innerHTML = '';
      qrcode.clear();
      newDOM.remove();
    });
  });

  // control btn panel if show in mobile phone
  if(socials.length > 0) {
    document.querySelector('#site-toggle-share-btn').addEventListener('click', toggleShareBtn());
  }
})();
(() => {
  function update(id = '', start = {}) {
    const dom = document.querySelector(id);
    const ts = new Date(start.year, start.month - 1, start.day).getTime();

    return () => {
      let offset = parseInt((new Date().getTime() - ts) / 1000, 10)
      
      if(offset < 0) {
        dom.innerHTML = "0天0时0分0秒";
        return;
      }

      let day = Math.floor(offset / 86400),
        hour = Math.floor((offset % 86400) / 3600),
        minute = Math.floor(((offset % 86400) % 3600) / 60),
        second = Math.floor(((offset % 86400) % 3600) % 60);

      dom.innerHTML = day + "天" + hour + "时" + minute + "分" + second + "秒";
    };
  }

  const { start_time } = window.AD_CONFIG;
  const [startYear, startMonth, startDay] = start_time.split('-');
  const startTime = {
    year: parseInt(startYear, 10),
    month: parseInt(startMonth, 10),
    day: parseInt(startDay, 10)
  };

  isNaN(startTime.year) && (startTime.year = 2018);
  isNaN(startTime.month) && (startTime.month = 2);
  isNaN(startTime.day) && (startTime.day = 10);

  const timeUpdate = update('#site-time', startTime);
  timeUpdate();
  setInterval(timeUpdate, 1000);
})();