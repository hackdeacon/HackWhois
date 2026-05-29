/**
 * i18n — lightweight internationalization module.
 * Supports zh-CN and en. Auto-detects browser language.
 */
const I18n = (() => {
  const STORAGE_KEY = 'hackwhois_lang';

  const translations = {
    en: {
      // Nav
      'nav.lookup': 'Lookup',
      'nav.batch': 'Batch',
      'nav.history': 'History',

      // Hero
      'hero.headline': 'Domain Intelligence.',
      'hero.sub': 'RDAP / WHOIS / DNS / Hosting — one lookup, full picture.',
      'hero.placeholder': 'google.com / 8.8.8.8 / AS15169',
      'hero.btn': 'Lookup',
      'hero.hint': 'Enter a domain name, IP address, or ASN number',

      // Tabs
      'tab.single': 'Single Query',
      'tab.batch': 'Batch Query',
      'tab.history': 'History',

      // Loading / Error
      'loading.text': 'Running intelligence lookup...',
      'error.icon': '!',

      // Result actions
      'action.copy': 'Copy Raw',
      'action.exportJson': 'Export JSON',
      'action.exportCsv': 'Export CSV',

      // Section labels
      'section.status': 'Domain Status',
      'section.registration': 'Registration',
      'section.dns': 'DNS Records',
      'section.hosting': 'Hosting & Infrastructure',
      'section.http': 'HTTP Probe',
      'section.ssl': 'SSL Certificate',
      'section.raw': 'Raw Data',

      // WHOIS fields
      'field.domain': 'Domain',
      'field.registrar': 'Registrar',
      'field.created': 'Created',
      'field.expires': 'Expires',
      'field.updated': 'Updated',
      'field.registrant': 'Registrant',
      'field.organization': 'Organization',
      'field.country': 'Country',
      'field.dnssec': 'DNSSEC',
      'field.source': 'Source',
      'field.ip': 'IP',
      'field.netRange': 'Net Range',
      'field.cidr': 'CIDR',
      'field.netName': 'Net Name',
      'field.asn': 'ASN',
      'field.name': 'Name',
      'field.subject': 'Subject',
      'field.issuer': 'Issuer',
      'field.validFrom': 'Valid From',
      'field.validTo': 'Valid To',
      'field.protocol': 'Protocol',
      'field.sans': 'SANs',
      'field.cdn': 'CDN',
      'field.provider': 'Provider',
      'field.ipAddresses': 'IP Addresses',
      'field.redirectChain': 'Redirect Chain',

      // DNS type tabs
      'dns.all': 'All',
      'dns.a': 'A',
      'dns.aaaa': 'AAAA',
      'dns.mx': 'MX',
      'dns.ns': 'NS',
      'dns.txt': 'TXT',
      'dns.cname': 'CNAME',
      'dns.soa': 'SOA',
      'dns.noData': 'No DNS data',
      'dns.loading': 'Loading DNS...',

      // Empty states
      'empty.noDns': 'No DNS data',
      'empty.noHosting': 'No hosting data',
      'empty.noSsl': 'No SSL data',
      'empty.noHistory': 'No query history yet.',

      // Batch
      'batch.placeholder': 'Enter multiple domains / IPs / ASNs, one per line:\ngoogle.com\ngithub.com\n8.8.8.8\nAS15169',
      'batch.upload': 'Upload File',
      'batch.start': 'Start Batch Query',
      'batch.stop': 'Stop',
      'batch.exportAllJson': 'Export All JSON',
      'batch.exportAllCsv': 'Export All CSV',
      'batch.th.query': 'Query',
      'batch.th.type': 'Type',
      'batch.th.registrar': 'Registrar / Org',
      'batch.th.expiration': 'Expiration / Country',
      'batch.th.source': 'Source',
      'batch.th.action': 'Action',
      'batch.view': 'View',
      'batch.error': 'Error',

      // History
      'history.clear': 'Clear History',

      // Footer
      'footer.version': 'HackWHOIS v2.0',
      'footer.detecting': 'Detecting API...',
      'footer.apiServer': 'API: Server (Full Intelligence)',
      'footer.apiPublic': 'API: Public (RDAP/WHOIS only)',

      // Theme
      'theme.light': 'Light',
      'theme.dark': 'Dark',
      'theme.system': 'System',

      // Month names for date formatting
      'month.01': 'Jan', 'month.02': 'Feb', 'month.03': 'Mar',
      'month.04': 'Apr', 'month.05': 'May', 'month.06': 'Jun',
      'month.07': 'Jul', 'month.08': 'Aug', 'month.09': 'Sep',
      'month.10': 'Oct', 'month.11': 'Nov', 'month.12': 'Dec',
    },

    'zh-CN': {
      'nav.lookup': '查询',
      'nav.batch': '批量',
      'nav.history': '历史',

      'hero.headline': '域名情报',
      'hero.sub': 'RDAP / WHOIS / DNS / Hosting — 一次查询，全貌掌握。',
      'hero.placeholder': 'google.com / 8.8.8.8 / AS15169',
      'hero.btn': '查询',
      'hero.hint': '输入域名、IP 地址或 ASN 编号',

      'tab.single': '单条查询',
      'tab.batch': '批量查询',
      'tab.history': '查询历史',

      'loading.text': '正在执行情报查询...',
      'error.icon': '!',

      'action.copy': '复制原始数据',
      'action.exportJson': '导出 JSON',
      'action.exportCsv': '导出 CSV',

      'section.status': '域名状态',
      'section.registration': '注册信息',
      'section.dns': 'DNS 记录',
      'section.hosting': '托管与基础设施',
      'section.http': 'HTTP 探测',
      'section.ssl': 'SSL 证书',
      'section.raw': '原始数据',

      'field.domain': '域名',
      'field.registrar': '注册商',
      'field.created': '创建时间',
      'field.expires': '到期时间',
      'field.updated': '更新时间',
      'field.registrant': '注册人',
      'field.organization': '组织',
      'field.country': '国家',
      'field.dnssec': 'DNSSEC',
      'field.source': '数据源',
      'field.ip': 'IP',
      'field.netRange': '网段范围',
      'field.cidr': 'CIDR',
      'field.netName': '网络名称',
      'field.asn': 'ASN',
      'field.name': '名称',
      'field.subject': '主体',
      'field.issuer': '颁发者',
      'field.validFrom': '生效日期',
      'field.validTo': '到期日期',
      'field.protocol': '协议',
      'field.sans': 'SANs',
      'field.cdn': 'CDN',
      'field.provider': '服务商',
      'field.ipAddresses': 'IP 地址',
      'field.redirectChain': '重定向链',

      'dns.all': '全部',
      'dns.a': 'A',
      'dns.aaaa': 'AAAA',
      'dns.mx': 'MX',
      'dns.ns': 'NS',
      'dns.txt': 'TXT',
      'dns.cname': 'CNAME',
      'dns.soa': 'SOA',
      'dns.noData': '无 DNS 数据',
      'dns.loading': '正在加载 DNS...',

      'empty.noDns': '无 DNS 数据',
      'empty.noHosting': '无托管数据',
      'empty.noSsl': '无 SSL 数据',
      'empty.noHistory': '暂无查询历史。',

      'batch.placeholder': '输入多个域名 / IP / ASN，每行一个：\ngoogle.com\ngithub.com\n8.8.8.8\nAS15169',
      'batch.upload': '上传文件',
      'batch.start': '开始批量查询',
      'batch.stop': '停止',
      'batch.exportAllJson': '导出全部 JSON',
      'batch.exportAllCsv': '导出全部 CSV',
      'batch.th.query': '查询项',
      'batch.th.type': '类型',
      'batch.th.registrar': '注册商 / 组织',
      'batch.th.expiration': '到期 / 国家',
      'batch.th.source': '数据源',
      'batch.th.action': '操作',
      'batch.view': '查看',
      'batch.error': '错误',

      'history.clear': '清空历史',

      'footer.version': 'HackWHOIS v2.0',
      'footer.detecting': '正在检测 API...',
      'footer.apiServer': 'API: 服务器模式（完整情报）',
      'footer.apiPublic': 'API: 公共模式（仅 RDAP/WHOIS）',

      'theme.light': '浅色',
      'theme.dark': '深色',
      'theme.system': '跟随系统',

      'month.01': '1月', 'month.02': '2月', 'month.03': '3月',
      'month.04': '4月', 'month.05': '5月', 'month.06': '6月',
      'month.07': '7月', 'month.08': '8月', 'month.09': '9月',
      'month.10': '10月', 'month.11': '11月', 'month.12': '12月',
    },
  };

  let currentLang = localStorage.getItem(STORAGE_KEY) || detectLang();

  function detectLang() {
    const nav = navigator.language || navigator.userLanguage || 'en';
    if (nav.startsWith('zh')) return 'zh-CN';
    return 'en';
  }

  function t(key) {
    return translations[currentLang]?.[key] || translations.en[key] || key;
  }

  function setLang(lang) {
    if (!translations[lang]) return;
    currentLang = lang;
    localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang;
    applyToDOM();
  }

  function getLang() {
    return currentLang;
  }

  function applyToDOM() {
    // Elements with data-i18n attribute → textContent
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const text = t(key);
      if (text) el.textContent = text;
    });

    // Elements with data-i18n-placeholder → placeholder
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      const text = t(key);
      if (text) el.placeholder = text;
    });

    // Elements with data-i18n-title → title
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      const text = t(key);
      if (text) el.title = text;
    });

    // Elements with data-i18n-aria → aria-label
    document.querySelectorAll('[data-i18n-aria]').forEach(el => {
      const key = el.getAttribute('data-i18n-aria');
      const text = t(key);
      if (text) el.setAttribute('aria-label', text);
    });
  }

  function formatDate(iso) {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      if (currentLang === 'zh-CN') {
        return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
      }
      const mon = t(`month.${String(d.getMonth() + 1).padStart(2, '0')}`);
      return `${mon} ${d.getDate()}, ${d.getFullYear()}`;
    } catch { return iso; }
  }

  // Init: set lang attribute and apply
  function init() {
    document.documentElement.lang = currentLang;
    applyToDOM();
  }

  return { t, setLang, getLang, init, applyToDOM, formatDate, detectLang };
})();
