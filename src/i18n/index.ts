import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ko from './ko.json';
import en from './en.json';
import ja from './ja.json';

i18n.use(initReactI18next).init({
  resources: {
    ko: { translation: ko },
    en: { translation: en },
    ja: { translation: ja },
  },
  lng: 'ko',
  fallbackLng: 'ko',
  interpolation: {
    escapeValue: false,
  },
});

if (import.meta.hot) {
  import.meta.hot.accept(['./ko.json', './en.json', './ja.json'], (mods) => {
    if (!mods) return;
    const [koMod, enMod, jaMod] = mods as Array<{ default: Record<string, unknown> } | undefined>;
    if (koMod) i18n.addResourceBundle('ko', 'translation', koMod.default, true, true);
    if (enMod) i18n.addResourceBundle('en', 'translation', enMod.default, true, true);
    if (jaMod) i18n.addResourceBundle('ja', 'translation', jaMod.default, true, true);
    void i18n.changeLanguage(i18n.language);
  });
}

export default i18n;
