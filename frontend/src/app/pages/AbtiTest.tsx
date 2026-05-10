import { useMemo, useState } from "react";
import { Brain, ChevronLeft, Languages, RotateCcw, Share2 } from "lucide-react";
import {
  abtiDimensionOrder,
  abtiLocaleOptions,
  abtiLocales,
  type AbtiDimensionKey,
  type AbtiLocaleCode,
} from "../features/abti/abtiData";
import {
  calculateAbtiResult,
  getAbtiAdvice,
  getAbtiResultImagePath,
  getAbtiSummary,
  type AbtiAnswers,
  type AbtiResult,
} from "../features/abti/abtiLogic";

export function AbtiTest() {
  const [localeCode, setLocaleCode] = useState<AbtiLocaleCode>("vi");
  const [answers, setAnswers] = useState<AbtiAnswers>({});
  const [index, setIndex] = useState(0);
  const [imageFailed, setImageFailed] = useState(false);

  const locale = abtiLocales[localeCode];
  const current = locale.questions[index];
  const answeredCount = Object.keys(answers).length;
  const isComplete = answeredCount === locale.questions.length;
  const progress = Math.round((answeredCount / locale.questions.length) * 100);

  const result = useMemo(() => {
    if (!isComplete) return null;
    return calculateAbtiResult(locale, answers);
  }, [answers, isComplete, locale]);

  const advice = useMemo(() => {
    if (!result) return [];
    return getAbtiAdvice(locale, result);
  }, [locale, result]);

  const summary = result ? getAbtiSummary(locale, result) : "";

  function selectOption(score: number) {
    setAnswers((prev) => ({ ...prev, [current.id]: score }));
    if (index < locale.questions.length - 1) {
      setIndex((value) => value + 1);
      return;
    }
    setImageFailed(false);
  }

  function goPrevious() {
    setIndex((value) => Math.max(0, value - 1));
  }

  function restart() {
    setAnswers({});
    setIndex(0);
    setImageFailed(false);
  }

  async function shareResult() {
    if (!result) return;
    const text = `${result.code}｜${result.name}\n${summary}`;
    if (navigator.share) {
      await navigator.share({ title: locale.title, text });
      return;
    }
    await navigator.clipboard?.writeText(text);
  }

  return (
    <div className="min-h-[100dvh] bg-[#f7f2ea] text-stone-950">
      <section className="border-b border-stone-200 bg-[#fdfaf5]">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:px-8 lg:py-14">
          <div className="space-y-7">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white px-3 py-1 text-sm font-medium text-stone-700">
                <Brain className="h-4 w-4 text-rose-600" />
                ABTI
              </span>
              <span className="text-sm font-medium text-stone-500">{locale.eyebrow}</span>
            </div>
            <div className="max-w-3xl space-y-5">
              <h1 className="text-4xl font-extrabold leading-tight tracking-normal text-stone-950 md:text-5xl">
                {locale.title}
              </h1>
              <p className="max-w-2xl text-base leading-7 text-stone-600 md:text-lg">{locale.intro}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <LanguageSwitcher value={localeCode} onChange={setLocaleCode} />
              <button
                type="button"
                onClick={restart}
                className="inline-flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-stone-800 shadow-sm transition hover:bg-stone-50 active:scale-[0.98]"
              >
                <RotateCcw className="h-4 w-4" />
                {locale.restartLabel}
              </button>
            </div>
          </div>

          <div className="grid content-between gap-5 rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
            <div>
              <div className="mb-3 flex items-center justify-between text-sm font-medium text-stone-600">
                <span>{locale.progressLabel}</span>
                <span>{answeredCount}/{locale.questions.length}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-stone-100">
                <div className="h-full bg-rose-600 transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {abtiDimensionOrder.map((dimensionKey) => (
                <DimensionSignal key={dimensionKey} dimensionKey={dimensionKey} localeCode={localeCode} />
              ))}
            </div>
            <p className="text-xs leading-5 text-stone-500">{locale.disclaimer}</p>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {result ? (
          <ResultPanel
            localeCode={localeCode}
            result={result}
            summary={summary}
            advice={advice}
            imageFailed={imageFailed}
            onImageFailed={() => setImageFailed(true)}
            onRestart={restart}
            onShare={shareResult}
          />
        ) : (
          <QuestionPanel
            index={index}
            selectedScore={answers[current.id]}
            onPrevious={goPrevious}
            onSelect={selectOption}
            localeCode={localeCode}
          />
        )}
      </main>
    </div>
  );
}

function LanguageSwitcher({
  value,
  onChange,
}: {
  value: AbtiLocaleCode;
  onChange: (value: AbtiLocaleCode) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-stone-300 bg-white p-1 shadow-sm">
      <Languages className="ml-2 h-4 w-4 text-stone-500" />
      {abtiLocaleOptions.map((locale) => (
        <button
          key={locale.code}
          type="button"
          onClick={() => onChange(locale.code)}
          className={`rounded-md px-3 py-1.5 text-sm font-semibold transition active:scale-[0.98] ${
            value === locale.code
              ? "bg-stone-900 text-white"
              : "text-stone-600 hover:bg-stone-100 hover:text-stone-950"
          }`}
          aria-pressed={value === locale.code}
        >
          {locale.label}
        </button>
      ))}
    </div>
  );
}

function DimensionSignal({
  dimensionKey,
  localeCode,
}: {
  dimensionKey: AbtiDimensionKey;
  localeCode: AbtiLocaleCode;
}) {
  const locale = abtiLocales[localeCode];
  const dimension = locale.dimensions[dimensionKey];

  return (
    <div className="min-h-20 rounded-md border border-stone-200 bg-stone-50 px-2 py-3 text-center">
      <div className="text-xs font-bold text-stone-500">{dimension.title}</div>
      <div className="mt-2 text-lg font-extrabold text-stone-950">
        {dimension.left.code}/{dimension.right.code}
      </div>
    </div>
  );
}

function QuestionPanel({
  index,
  selectedScore,
  onPrevious,
  onSelect,
  localeCode,
}: {
  index: number;
  selectedScore?: number;
  onPrevious: () => void;
  onSelect: (score: number) => void;
  localeCode: AbtiLocaleCode;
}) {
  const locale = abtiLocales[localeCode];
  const question = locale.questions[index];
  const dimension = locale.dimensions[question.dim];

  return (
    <section className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <aside className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
        <div className="text-sm font-semibold text-stone-500">{locale.dimensionsLabel}</div>
        <div className="mt-5 space-y-3">
          {abtiDimensionOrder.map((dimensionKey) => {
            const item = locale.dimensions[dimensionKey];
            const active = question.dim === dimensionKey;
            return (
              <div
                key={dimensionKey}
                className={`rounded-md border px-3 py-3 ${
                  active ? "border-rose-200 bg-rose-50" : "border-stone-200 bg-stone-50"
                }`}
              >
                <div className="text-sm font-bold text-stone-900">{item.title}</div>
                <div className="mt-1 text-xs leading-5 text-stone-500">
                  {item.left.short} / {item.right.short}
                </div>
              </div>
            );
          })}
        </div>
      </aside>

      <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <span className="rounded-full bg-stone-100 px-3 py-1 text-sm font-bold text-stone-700">
            {dimension.title} · {index + 1}/{locale.questions.length}
          </span>
          <button
            type="button"
            onClick={onPrevious}
            disabled={index === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-stone-300 px-3 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.98]"
          >
            <ChevronLeft className="h-4 w-4" />
            {locale.previousLabel}
          </button>
        </div>

        <h2 className="min-h-24 text-2xl font-extrabold leading-snug tracking-normal text-stone-950 md:text-3xl">
          {question.text}
        </h2>

        <div className="mt-8 grid gap-3">
          {question.options.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => onSelect(option.score)}
              className={`grid min-h-20 grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-4 rounded-lg border px-4 py-4 text-left transition hover:border-rose-300 hover:bg-rose-50 active:scale-[0.99] ${
                selectedScore === option.score ? "border-rose-300 bg-rose-50" : "border-stone-200 bg-white"
              }`}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-stone-900 text-sm font-extrabold text-white">
                {option.key}
              </span>
              <span className="text-base font-semibold leading-6 text-stone-800">{option.text}</span>
            </button>
          ))}
        </div>
      </section>
    </section>
  );
}

function ResultPanel({
  localeCode,
  result,
  summary,
  advice,
  imageFailed,
  onImageFailed,
  onRestart,
  onShare,
}: {
  localeCode: AbtiLocaleCode;
  result: AbtiResult;
  summary: string;
  advice: string[];
  imageFailed: boolean;
  onImageFailed: () => void;
  onRestart: () => void;
  onShare: () => void;
}) {
  const locale = abtiLocales[localeCode];

  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-normal text-rose-600">ABTI Result</p>
            <h2 className="mt-2 text-4xl font-extrabold tracking-normal text-stone-950 md:text-5xl">
              {result.code}
            </h2>
            <p className="mt-3 text-xl font-bold text-stone-800">{result.name}</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onShare}
              className="inline-flex items-center gap-2 rounded-lg bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-stone-800 active:scale-[0.98]"
            >
              <Share2 className="h-4 w-4" />
              {locale.code === "vi" ? "Chia sẻ" : "分享"}
            </button>
            <button
              type="button"
              onClick={onRestart}
              className="inline-flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-stone-800 transition hover:bg-stone-50 active:scale-[0.98]"
            >
              <RotateCcw className="h-4 w-4" />
              {locale.restartLabel}
            </button>
          </div>
        </div>

        <p className="mt-7 max-w-3xl text-base leading-8 text-stone-700">{summary}</p>

        <div className="mt-8 grid gap-3 md:grid-cols-5">
          {abtiDimensionOrder.map((dimensionKey) => {
            const dimension = locale.dimensions[dimensionKey];
            const pole = result.poles[dimensionKey];
            const side = dimension[pole];
            return (
              <div key={dimensionKey} className="rounded-lg border border-stone-200 bg-stone-50 p-4">
                <div className="text-xs font-bold text-stone-500">{dimension.title}</div>
                <div className="mt-2 text-2xl font-extrabold text-stone-950">{side.code}</div>
                <div className="mt-1 text-sm font-semibold text-stone-700">{side.short}</div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white">
                  <div className="h-full bg-rose-600" style={{ width: `${result.percentages[dimensionKey]}%` }} />
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8">
          <h3 className="text-lg font-extrabold text-stone-950">{locale.adviceLabel}</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {advice.map((item) => (
              <p key={item} className="rounded-lg border border-stone-200 bg-[#fdfaf5] p-4 text-sm leading-6 text-stone-700">
                {item}
              </p>
            ))}
          </div>
        </div>
      </div>

      <aside className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
        <div className="aspect-[16/9] overflow-hidden rounded-md bg-stone-100">
          {imageFailed ? (
            <div className="grid h-full place-items-center p-6 text-center">
              <div>
                <div className="text-5xl font-extrabold text-stone-300">{result.code}</div>
                <p className="mt-4 text-sm font-semibold text-stone-500">{result.name}</p>
              </div>
            </div>
          ) : (
            <img
              src={getAbtiResultImagePath(result.code)}
              alt={`${result.code} ${result.name} ${locale.imageAltSuffix}`}
              className="h-full w-full object-cover"
              onError={onImageFailed}
            />
          )}
        </div>
        <p className="mt-4 text-xs leading-5 text-stone-500">{locale.disclaimer}</p>
      </aside>
    </section>
  );
}
