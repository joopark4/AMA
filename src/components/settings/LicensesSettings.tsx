import { useState } from 'react';
import { useTranslation } from 'react-i18next';

type LocalizedText = {
  ko: string;
  en: string;
};

type LicenseItem = {
  name: string;
  usage: LocalizedText;
  license: LocalizedText;
  link: string;
};

const OPEN_SOURCE_LICENSES: LicenseItem[] = [
  {
    name: 'Tauri',
    usage: { ko: '데스크톱 앱 프레임워크', en: 'Desktop app framework' },
    license: { ko: 'Apache-2.0 OR MIT', en: 'Apache-2.0 OR MIT' },
    link: 'https://github.com/tauri-apps/tauri',
  },
  {
    name: 'React',
    usage: { ko: 'UI 프레임워크', en: 'UI framework' },
    license: { ko: 'MIT', en: 'MIT' },
    link: 'https://github.com/facebook/react',
  },
  {
    name: 'Three.js',
    usage: { ko: '3D 렌더링', en: '3D rendering' },
    license: { ko: 'MIT', en: 'MIT' },
    link: 'https://github.com/mrdoob/three.js',
  },
  {
    name: '@react-three/fiber',
    usage: { ko: 'React-Three 통합', en: 'React-Three integration' },
    license: { ko: 'MIT', en: 'MIT' },
    link: 'https://github.com/pmndrs/react-three-fiber',
  },
  {
    name: '@pixiv/three-vrm',
    usage: { ko: 'VRM 로더/런타임', en: 'VRM loader/runtime' },
    license: { ko: 'MIT', en: 'MIT' },
    link: 'https://github.com/pixiv/three-vrm',
  },
  {
    name: 'Zustand',
    usage: { ko: '전역 상태 관리', en: 'Global state management' },
    license: { ko: 'MIT', en: 'MIT' },
    link: 'https://github.com/pmndrs/zustand',
  },
  {
    name: 'i18next',
    usage: { ko: '다국어(i18n)', en: 'Internationalization (i18n)' },
    license: { ko: 'MIT', en: 'MIT' },
    link: 'https://github.com/i18next/i18next',
  },
];

const MODEL_AND_SERVICE_LICENSES: LicenseItem[] = [
  {
    name: 'Ollama',
    usage: { ko: '로컬 LLM 서버', en: 'Local LLM server' },
    license: { ko: 'MIT', en: 'MIT' },
    link: 'https://github.com/ollama/ollama',
  },
  {
    name: 'LocalAI',
    usage: { ko: '로컬 OpenAI 호환 서버', en: 'Local OpenAI-compatible server' },
    license: { ko: 'MIT', en: 'MIT' },
    link: 'https://github.com/mudler/LocalAI',
  },
  {
    name: 'Claude API',
    usage: { ko: '클라우드 LLM', en: 'Cloud LLM' },
    license: { ko: 'Anthropic 서비스 약관', en: 'Anthropic service terms' },
    link: 'https://www.anthropic.com/claude',
  },
  {
    name: 'OpenAI API',
    usage: { ko: '클라우드 LLM', en: 'Cloud LLM' },
    license: { ko: 'OpenAI 서비스 약관', en: 'OpenAI service terms' },
    link: 'https://platform.openai.com',
  },
  {
    name: 'Gemini API',
    usage: { ko: '클라우드 LLM', en: 'Cloud LLM' },
    license: { ko: 'Google 서비스 약관', en: 'Google service terms' },
    link: 'https://ai.google.dev',
  },
  {
    name: 'ONNX Runtime Web',
    usage: { ko: 'Supertonic 추론 런타임', en: 'Supertonic inference runtime' },
    license: { ko: 'MIT', en: 'MIT' },
    link: 'https://github.com/microsoft/onnxruntime',
  },
  {
    name: 'whisper.cpp',
    usage: { ko: 'STT 엔진 (whisper-cli)', en: 'STT engine (whisper-cli)' },
    license: { ko: 'MIT', en: 'MIT' },
    link: 'https://github.com/ggml-org/whisper.cpp',
  },
  {
    name: 'Whisper (OpenAI)',
    usage: { ko: 'STT 모델 계열', en: 'STT model family' },
    license: { ko: 'MIT', en: 'MIT' },
    link: 'https://github.com/openai/whisper',
  },
  {
    name: 'GGML Whisper models',
    usage: { ko: '앱 로컬 STT 모델', en: 'Local STT models for app' },
    license: { ko: '배포처 라이선스 준수', en: 'Follow source distribution license' },
    link: 'https://huggingface.co/ggerganov/whisper.cpp',
  },
  {
    name: 'Supertonic code',
    usage: { ko: 'TTS 엔진 구현', en: 'TTS engine implementation' },
    license: { ko: 'MIT', en: 'MIT' },
    link: 'https://github.com/supertone-inc/supertonic',
  },
  {
    name: 'Supertonic models',
    usage: { ko: '앱 로컬 TTS 모델', en: 'Local TTS models for app' },
    license: { ko: 'BigScience Open RAIL-M', en: 'BigScience Open RAIL-M' },
    link: 'https://huggingface.co/Supertone/supertonic',
  },
];

function LicenseTable({
  items,
  lang,
  nameLabel,
  usageLabel,
  licenseLabel,
  linkLabel,
}: {
  items: LicenseItem[];
  lang: 'ko' | 'en';
  nameLabel: string;
  usageLabel: string;
  licenseLabel: string;
  linkLabel: string;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full text-xs">
        <thead className="bg-gray-100 text-gray-700">
          <tr>
            <th className="px-3 py-2 text-left font-semibold">{nameLabel}</th>
            <th className="px-3 py-2 text-left font-semibold">{usageLabel}</th>
            <th className="px-3 py-2 text-left font-semibold">{licenseLabel}</th>
            <th className="px-3 py-2 text-left font-semibold">{linkLabel}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white text-gray-700">
          {items.map((item) => (
            <tr key={item.name}>
              <td className="px-3 py-2 align-top">{item.name}</td>
              <td className="px-3 py-2 align-top">{item.usage[lang]}</td>
              <td className="px-3 py-2 align-top">{item.license[lang]}</td>
              <td className="px-3 py-2 align-top">
                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-700 underline underline-offset-2 break-all"
                >
                  {item.link}
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function LicensesSettings() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === 'ko' ? 'ko' : 'en';
  const [isOpenSourceExpanded, setIsOpenSourceExpanded] = useState(false);
  const [isModelExpanded, setIsModelExpanded] = useState(false);

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">{t('settings.licenses.description')}</p>

      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setIsOpenSourceExpanded((prev) => !prev)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors"
        >
          <span className="text-sm font-medium text-gray-700">{t('settings.licenses.openSourceTitle')}</span>
          <span className="text-xs text-gray-500">
            {isOpenSourceExpanded ? t('settings.licenses.collapse') : t('settings.licenses.expand')}
          </span>
        </button>

        {isOpenSourceExpanded && (
          <LicenseTable
            items={OPEN_SOURCE_LICENSES}
            lang={lang}
            nameLabel={t('settings.licenses.columns.name')}
            usageLabel={t('settings.licenses.columns.usage')}
            licenseLabel={t('settings.licenses.columns.license')}
            linkLabel={t('settings.licenses.columns.link')}
          />
        )}
      </div>

      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setIsModelExpanded((prev) => !prev)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors"
        >
          <span className="text-sm font-medium text-gray-700">{t('settings.licenses.modelTitle')}</span>
          <span className="text-xs text-gray-500">
            {isModelExpanded ? t('settings.licenses.collapse') : t('settings.licenses.expand')}
          </span>
        </button>

        {isModelExpanded && (
          <LicenseTable
            items={MODEL_AND_SERVICE_LICENSES}
            lang={lang}
            nameLabel={t('settings.licenses.columns.name')}
            usageLabel={t('settings.licenses.columns.usage')}
            licenseLabel={t('settings.licenses.columns.license')}
            linkLabel={t('settings.licenses.columns.link')}
          />
        )}
      </div>

      <p className="text-xs text-gray-500">{t('settings.licenses.note')}</p>
    </div>
  );
}
