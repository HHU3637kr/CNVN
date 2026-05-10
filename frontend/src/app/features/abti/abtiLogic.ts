import {
  abtiDimensionOrder,
  type AbtiDimensionKey,
  type AbtiLocale,
  type AbtiPole,
} from "./abtiData";

export type AbtiAnswers = Record<number, number>;

export type AbtiResult = {
  raw: Record<AbtiDimensionKey, number>;
  poles: Record<AbtiDimensionKey, AbtiPole>;
  percentages: Record<AbtiDimensionKey, number>;
  code: string;
  name: string;
};

export function calculateAbtiResult(locale: AbtiLocale, answers: AbtiAnswers): AbtiResult {
  const raw = emptyDimensionNumberMap();
  const counts = emptyDimensionNumberMap();

  locale.questions.forEach((question) => {
    const answer = answers[question.id];
    if (answer === undefined) return;

    raw[question.dim] += answer;
    counts[question.dim] += 1;
  });

  const poles = {} as Record<AbtiDimensionKey, AbtiPole>;
  const percentages = emptyDimensionNumberMap();
  let code = "";

  abtiDimensionOrder.forEach((dimensionKey) => {
    const maxAbs = counts[dimensionKey] * 2 || 1;
    const score = raw[dimensionKey];
    const side: AbtiPole = score >= 0 ? "left" : "right";

    poles[dimensionKey] = side;
    percentages[dimensionKey] = Math.round((Math.abs(score) / maxAbs) * 100);
    code += locale.dimensions[dimensionKey][side].code;
  });

  return {
    raw,
    poles,
    percentages,
    code,
    name: locale.archetypeNames[code] ?? locale.emptyResultName,
  };
}

export function getAbtiSummary(locale: AbtiLocale, result: AbtiResult) {
  const parts = abtiDimensionOrder.map((dimensionKey) => locale.summary[dimensionKey][result.poles[dimensionKey]]);

  if (locale.code === "vi") {
    return `Kiểu ABTI của bạn là ${result.code}｜${result.name}. ${parts.join("; ")}. Nói ngắn gọn: bạn vẫn đang vận hành trong hiện thực, có lúc tụt khung hình nhưng chưa hề rời khỏi màn chơi.`;
  }

  return `你的 ABTI 类型是 ${result.code}｜${result.name}。${parts.join("；")}。简单说，你不是普通地活着，你是在现实这台旧机器里一边掉帧，一边继续运行。`;
}

export function getAbtiAdvice(locale: AbtiLocale, result: AbtiResult) {
  return abtiDimensionOrder.map((dimensionKey) => locale.advice[dimensionKey][result.poles[dimensionKey]]);
}

export function getAbtiResultImagePath(code: string) {
  return `/assets/abti/results/${code}.jpg`;
}

function emptyDimensionNumberMap(): Record<AbtiDimensionKey, number> {
  return {
    self: 0,
    emotion: 0,
    action: 0,
    social: 0,
    world: 0,
  };
}
