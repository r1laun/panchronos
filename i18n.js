// Панхронос: минимальный bilingual словарь RU/EN.
// Использование: import { t, getLang, setLang, applyI18n } from './i18n.js'

const STRINGS = {
  ru: {
    'app.name': 'Панхронос',
    'app.tagline': 'Ответ — Мысль — Вопрос. Вопрос сегодня, ответ через 14 записей.',
    'nav.write': 'Сегодня',
    'nav.archive': 'Архив',
    'nav.logout': 'Выйти',
    'lang.label': 'Язык',

    'auth.title': 'Вход / Регистрация',
    'auth.login': 'Вход',
    'auth.signup': 'Регистрация',
    'auth.reset': 'Забыли пароль?',
    'auth.email': 'Email',
    'auth.password': 'Пароль',
    'auth.submit.login': 'Войти',
    'auth.submit.signup': 'Зарегистрироваться',
    'auth.submit.reset': 'Отправить ссылку для сброса',
    'auth.back.login': '← Назад ко входу',
    'auth.signup.ok': 'Проверьте почту: мы отправили ссылку для подтверждения email. До подтверждения дневник недоступен.',
    'auth.reset.ok': 'Если такой email зарегистрирован, мы отправили ссылку для сброса пароля.',
    'auth.error': 'Ошибка: ',

    'verify.title': 'Подтвердите email',
    'verify.text': 'Вы вошли, но email ещё не подтверждён. Перейдите по ссылке из письма — до подтверждения дневник недоступен.',

    'write.title': 'Запись',
    'write.context.title': 'Контекст из записи',
    'write.answer': 'Ответ',
    'write.thought': 'Мысль',
    'write.question': 'Вопрос',
    'write.answer.ph.active': 'Ответ на вопрос из записи {n}…',
    'write.answer.ph.locked': 'Появится на записи №15',
    'write.thought.ph': 'О чём думается сегодня…',
    'write.question.ph': 'Вопрос себе через 14 записей…',
    'write.submit': 'Сохранить запись',
    'write.saved': 'Запись №{n} сохранена. Её нельзя будет изменить или удалить.',
    'write.hint.early': 'Записи №1–14: поле «Ответ» пока неактивно. Оно появится на записи №15.',
    'write.error.empty': 'Заполните все активные поля.',
    'write.error.generic': 'Не удалось сохранить: ',

    'done.title': 'На сегодня всё',
    'done.text': 'Запись на сегодня уже сделана.',
    'done.next': 'Следующая запись доступна через {h} ч {m} мин (до полуночи UTC).',

    'archive.title': 'Архив',
    'archive.empty': 'Пока пусто. Напишите первую запись на вкладке «Сегодня».',
    'archive.meta': '№{n} · {d}',
    'archive.question.note': 'На этот вопрос вы ответите в записи №{n}.',

    'common.loading': 'Загрузка…',
    'common.config.missing': 'Не задан SUPABASE_URL / SUPABASE_ANON_KEY. Скопируйте config.example.js в config.js и впишите ключи (см. README).',
  },
  en: {
    'app.name': 'Panchronos',
    'app.tagline': 'Answer — Thought — Question. A question today, an answer 14 entries later.',
    'nav.write': 'Today',
    'nav.archive': 'Archive',
    'nav.logout': 'Sign out',
    'lang.label': 'Language',

    'auth.title': 'Sign in / Sign up',
    'auth.login': 'Sign in',
    'auth.signup': 'Sign up',
    'auth.reset': 'Forgot password?',
    'auth.email': 'Email',
    'auth.password': 'Password',
    'auth.submit.login': 'Sign in',
    'auth.submit.signup': 'Sign up',
    'auth.submit.reset': 'Send reset link',
    'auth.back.login': '← Back to sign in',
    'auth.signup.ok': 'Check your inbox: we sent an email confirmation link. The diary stays locked until you confirm.',
    'auth.reset.ok': 'If this email is registered, we sent a password reset link.',
    'auth.error': 'Error: ',

    'verify.title': 'Confirm your email',
    'verify.text': 'You are signed in, but your email is not confirmed yet. Follow the link from the email — the diary stays locked until then.',

    'write.title': 'Entry',
    'write.context.title': 'Context from entry',
    'write.answer': 'Answer',
    'write.thought': 'Thought',
    'write.question': 'Question',
    'write.answer.ph.active': 'Answer to the question from entry {n}…',
    'write.answer.ph.locked': 'Available from entry #15',
    'write.thought.ph': 'What is on your mind today…',
    'write.question.ph': 'A question for yourself 14 entries later…',
    'write.submit': 'Save entry',
    'write.saved': 'Entry #{n} saved. It cannot be edited or deleted afterwards.',
    'write.hint.early': 'Entries #1–14: the “Answer” field is not active yet. It unlocks at entry #15.',
    'write.error.empty': 'Please fill in all active fields.',
    'write.error.generic': 'Could not save: ',

    'done.title': 'Done for today',
    'done.text': 'Today’s entry is already saved.',
    'done.next': 'Next entry available in {h}h {m}m (until UTC midnight).',

    'archive.title': 'Archive',
    'archive.empty': 'Nothing here yet. Write your first entry on the “Today” tab.',
    'archive.meta': '№{n} · {d}',
    'archive.question.note': 'You will answer this question in entry №{n}.',

    'common.loading': 'Loading…',
    'common.config.missing': 'SUPABASE_URL / SUPABASE_ANON_KEY is not set. Copy config.example.js to config.js and fill in the keys (see README).',
  },
};

export function getLang() {
  const v = (localStorage.getItem('panchronos.lang') || 'ru').toLowerCase();
  return v === 'en' ? 'en' : 'ru';
}

export function setLang(lang) {
  localStorage.setItem('panchronos.lang', lang === 'en' ? 'en' : 'ru');
}

// t('write.submit') или t('done.next', {h: 3, m: 12})
export function t(key, vars) {
  const lang = getLang();
  let s = (STRINGS[lang] && STRINGS[lang][key]) ?? STRINGS.ru[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.replaceAll('{' + k + '}', String(v));
    }
  }
  return s;
}

// Проставляет всем [data-i18n] текстовое содержимое, а [data-i18n-ph] — placeholder.
export function applyI18n(root) {
  const scope = root || document;
  scope.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  scope.querySelectorAll('[data-i18n-ph]').forEach((el) => {
    el.setAttribute('placeholder', t(el.getAttribute('data-i18n-ph')));
  });
}
