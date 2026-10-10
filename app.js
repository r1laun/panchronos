import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.44.4';
import { t, getLang, setLang, applyI18n } from './i18n.js';

const LAG = 14;
const WARMUP_MAX = LAG; // записи №1–14: ответ неактивен, появится на №15
const cfg = (window.__PANCHRONOS_CONFIG || {});
const SUPABASE_URL = cfg.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = cfg.SUPABASE_ANON_KEY || '';

const $ = (id) => document.getElementById(id);
const page = document.body.dataset.page || 'write';
let supabase = null;
let authMode = 'login';
let countdownTimer = null;

function esc(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function showNotice(kind, text) {
  const box = $('notice');
  if (!box) return;
  box.innerHTML = text
    ? `<div class="notice ${kind === 'error' ? 'error' : kind === 'ok' ? 'ok' : ''}">${esc(text)}</div>`
    : '';
}

function utcTodayStr() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD в UTC
}

function msUntilUtcMidnight() {
  const now = new Date();
  const next = Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0,
  );
  return Math.max(0, next - now.getTime());
}

function startCountdown(el) {
  const tick = () => {
    const ms = msUntilUtcMidnight();
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    el.textContent = t('done.next', { h, m });
  };
  tick();
  clearInterval(countdownTimer);
  countdownTimer = setInterval(tick, 30_000);
}

function isEmailConfirmed(user) {
  return Boolean(user && (user.email_confirmed_at || user.confirmed_at));
}

function setVisible(id, visible) {
  const el = $(id);
  if (el) el.hidden = !visible;
}

// --- lang switch ---
function initLang() {
  document.documentElement.lang = getLang();
  document.querySelectorAll('[data-lang]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.lang === getLang());
    btn.onclick = () => {
      setLang(btn.dataset.lang);
      document.documentElement.lang = getLang();
      applyI18n(document);
      initLangActive();
      boot(true); // перерисовать динамические строки
    };
  });
}

function initLangActive() {
  document.querySelectorAll('[data-lang]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.lang === getLang());
  });
}

// --- auth UI ---
function initAuthForms() {
  const tabLogin = $('tabLogin');
  const tabSignup = $('tabSignup');
  if (!tabLogin) return;

  const syncTabs = () => {
    tabLogin.classList.toggle('active', authMode === 'login');
    tabSignup.classList.toggle('active', authMode === 'signup');
    $('authSubmit').textContent = t(authMode === 'login' ? 'auth.submit.login' : 'auth.submit.signup');
    $('passwordInput').setAttribute('autocomplete', authMode === 'login' ? 'current-password' : 'new-password');
  };
  tabLogin.onclick = () => { authMode = 'login'; syncTabs(); };
  tabSignup.onclick = () => { authMode = 'signup'; syncTabs(); };
  syncTabs();

  $('authForm').onsubmit = async (e) => {
    e.preventDefault();
    showNotice('', '');
    const email = $('emailInput').value.trim();
    const password = $('passwordInput').value;
    try {
      if (authMode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await boot(true);
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        // До подтверждения сессии может не быть — это нормально.
        if (data.session) await boot(true);
        else showNotice('ok', t('auth.signup.ok'));
      }
    } catch (err) {
      showNotice('error', t('auth.error') + (err.message || err));
    }
  };

  $('resetToggle').onclick = () => {
    $('authForm').hidden = true;
    $('resetToggle').hidden = true;
    $('resetForm').hidden = false;
  };
  $('resetBack').onclick = () => {
    $('resetForm').hidden = true;
    $('authForm').hidden = false;
    $('resetToggle').hidden = false;
  };
  $('resetForm').onsubmit = async (e) => {
    e.preventDefault();
    showNotice('', '');
    try {
      const email = $('resetEmailInput').value.trim();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + window.location.pathname,
      });
      if (error) throw error;
      showNotice('ok', t('auth.reset.ok'));
    } catch (err) {
      showNotice('error', t('auth.error') + (err.message || err));
    }
  };

  const logoutBtn = $('logoutBtn');
  if (logoutBtn) {
    logoutBtn.onclick = async () => {
      await supabase.auth.signOut();
      window.location.href = './index.html';
    };
  }
}

function renderRail(next, needsAnswer) {
  const rail = $('lagRail');
  if (!rail) return;
  let html = '';
  for (let i = 0; i <= LAG; i++) {
    const n = next - LAG + i;
    const cls = i === LAG ? 'is-today' : (i === 0 && needsAnswer) ? 'is-answering' : '';
    html += `<li class="${cls}${n < 1 ? ' is-void' : ''}" style="--i:${i}"></li>`;
  }
  rail.innerHTML = html;
  $('railFrom').textContent = needsAnswer ? '№' + (next - LAG) : '';
  $('railTo').textContent = '№' + next;
}

// --- write page ---
async function bootWrite(user) {
  setVisible('authSection', !user);
  setVisible('verifySection', Boolean(user && !isEmailConfirmed(user)));
  setVisible('writeSection', false);
  setVisible('doneSection', false);
  if ($('logoutBtn')) $('logoutBtn').hidden = !user;
  if (!user || !isEmailConfirmed(user)) return;

  showNotice('', t('common.loading'));
  try {
    // Последняя запись пользователя: для max(entry_number) и проверки "уже писал сегодня".
    const { data: lastRows, error: lastErr } = await supabase
      .from('entries')
      .select('entry_number,entry_day')
      .order('entry_number', { ascending: false })
      .limit(1);
    if (lastErr) throw lastErr;

    const maxNumber = lastRows.length ? lastRows[0].entry_number : 0;
    const today = utcTodayStr();
    const wroteToday = lastRows.length > 0 && lastRows[0].entry_day === today;

    // Надёжнее: явная проверка записи за сегодняшние UTC-сутки.
    let todayEntry = null;
    if (!wroteToday) {
      const { data, error } = await supabase
        .from('entries')
        .select('id')
        .eq('entry_day', today)
        .limit(1);
      if (error) throw error;
      todayEntry = data.length ? data[0] : null;
    }

    showNotice('', '');
    if (wroteToday || todayEntry) {
      setVisible('doneSection', true);
      startCountdown($('countdownText'));
      return;
    }

    const next = maxNumber + 1;
    setVisible('writeSection', true);
    $('entryNo').textContent = '№' + next;

    const needsAnswer = next > WARMUP_MAX;
    renderRail(next, needsAnswer);
    setVisible('earlyHint', !needsAnswer);

    const answerInput = $('answerInput');
    answerInput.disabled = !needsAnswer;
    answerInput.value = '';
    answerInput.placeholder = needsAnswer
      ? t('write.answer.ph.active', { n: next - LAG })
      : t('write.answer.ph.locked');

    $('thoughtInput').value = '';
    $('questionInput').value = '';

    // Контекст N−14: только thought + question той записи, без её answer.
    const ctxBlock = $('contextBlock');
    if (needsAnswer) {
      const target = next - LAG;
      const { data, error } = await supabase
        .from('entries')
        .select('thought,question')
        .eq('entry_number', target)
        .limit(1);
      if (error) throw error;
      if (data.length) {
        $('contextNo').textContent = '№' + target;
        $('contextText').textContent = data[0].thought + '\n\n' + data[0].question;
        ctxBlock.hidden = false;
      } else {
        ctxBlock.hidden = true;
      }
    } else {
      ctxBlock.hidden = true;
    }

    $('writeForm').onsubmit = (e) => handleSave(e, next, needsAnswer);
  } catch (err) {
    showNotice('error', t('write.error.generic') + (err.message || err));
  }
}

async function handleSave(e, next, needsAnswer) {
  e.preventDefault();
  showNotice('', '');
  const answer = $('answerInput').value.trim();
  const thought = $('thoughtInput').value.trim();
  const question = $('questionInput').value.trim();

  if (!thought || !question || (needsAnswer && !answer)) {
    showNotice('error', t('write.error.empty'));
    return;
  }

  const btn = document.querySelector('#writeForm button[type="submit"]');
  btn.disabled = true;
  try {
    await insertWithRetry({
      entry_number: next,
      answer: needsAnswer ? answer : null,
      thought,
      question,
    });
    showNotice('ok', t('write.saved', { n: next }));
    setVisible('writeSection', false);
    setVisible('doneSection', true);
    startCountdown($('countdownText'));
  } catch (err) {
    // Дубль за сутки (сработал unique user_id+entry_day): показываем countdown.
    if (err && (err.code === '23505')) {
      setVisible('writeSection', false);
      setVisible('doneSection', true);
      startCountdown($('countdownText'));
    } else {
      showNotice('error', t('write.error.generic') + (err.message || err));
    }
  } finally {
    btn.disabled = false;
  }
}

// entry_number = max+1 подвержен гонке при двойном клике: при 23505 на
// (user_id, entry_number) один раз пересчитываем max и повторяем.
async function insertWithRetry(row) {
  const attempt = async (entryNumber) => {
    const { error } = await supabase.from('entries').insert({
      entry_number: entryNumber,
      answer: row.answer,
      thought: row.thought,
      question: row.question,
    });
    if (error) throw error;
  };
  try {
    await attempt(row.entry_number);
  } catch (err) {
    if (err.code !== '23505') throw err;
    const { data, error } = await supabase
      .from('entries')
      .select('entry_number')
      .order('entry_number', { ascending: false })
      .limit(1);
    if (error) throw error;
    const fresh = data.length ? data[0].entry_number + 1 : 1;
    // Если конфликт был по entry_day (вторая запись за сутки), а не по номеру —
    // не повторяем вставку, отдаём ошибку выше для показа countdown.
    if (fresh !== row.entry_number + 1 && fresh <= row.entry_number) throw err;
    await attempt(fresh);
  }
}

// --- archive page ---
async function bootArchive(user) {
  if ($('logoutBtn')) $('logoutBtn').hidden = !user;
  const list = $('archiveList');
  if (!user) {
    window.location.href = './index.html';
    return;
  }
  if (!isEmailConfirmed(user)) {
    list.innerHTML = `<div class="card"><p>${esc(t('verify.text'))}</p></div>`;
    return;
  }
  list.innerHTML = `<p class="muted">${esc(t('common.loading'))}</p>`;
  const { data, error } = await supabase
    .from('entries')
    .select('entry_number,answer,thought,question,created_at')
    .order('entry_number', { ascending: false });
  if (error) {
    showNotice('error', t('write.error.generic') + error.message);
    return;
  }
  if (!data.length) {
    list.innerHTML = `<p>${esc(t('archive.empty'))}</p>`;
    return;
  }
  list.innerHTML = data.map((row) => {
    const date = new Date(row.created_at).toISOString().slice(0, 10);
    // Единый текст без ярлыков: абзацы Ответ? + Мысль + Вопрос (цвет — только намёк).
    const paras = [];
    if (row.answer) paras.push(`<p class="a">${esc(row.answer)}</p>`);
    paras.push(`<p>${esc(row.thought)}</p>`);
    paras.push(`<p class="q">${esc(row.question)}</p>`);
    return `<article class="entry">
      <header class="entry-head"><span class="entry-no">№${row.entry_number}</span><time datetime="${date}">${date}</time></header>
      <div class="entry-body">${paras.join('')}</div>
      <p class="entry-note">${esc(t('archive.question.note', { n: row.entry_number + LAG }))}</p>
    </article>`;
  }).join('');
}

// --- boot ---
async function boot(isReboot) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || SUPABASE_URL.includes('YOUR_')) {
    showNotice('error', t('common.config.missing'));
    return;
  }
  if (!supabase) {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  const { data: { session } } = await supabase.auth.getSession();
  const user = session ? session.user : null;

  // Кнопка входа/регистрации — динамическая (без data-i18n), обновляем при смене языка.
  const authSubmit = $('authSubmit');
  if (authSubmit) {
    authSubmit.textContent = t(authMode === 'login' ? 'auth.submit.login' : 'auth.submit.signup');
  }

  if (page === 'archive') await bootArchive(user);
  else await bootWrite(user);

  if (!isReboot) {
    supabase.auth.onAuthStateChange(() => boot(true));
  }
}

initLang();
applyI18n(document);
initAuthForms();
boot(false);
