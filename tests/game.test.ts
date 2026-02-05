import { describe, expect, test } from "vitest";
import { evaluateAnswer, generateQuestion } from "../game";

function createRng(values: number[]) {
  let index = 0;
  return () => {
    const value = values[index % values.length];
    index += 1;
    return value;
  };
}

describe("generateQuestion", () => {
  test("subtraction never produces negative results", () => {
    const rng = createRng([0.1, 0.9]);
    const question = generateQuestion(rng, "sub");
    const [left, right] = question.text.split(" - ").map(Number);

    expect(question.answer).toBeGreaterThanOrEqual(0);
    expect(left).toBeGreaterThanOrEqual(right);
  });

  test("mul1 factors stay within 2-9", () => {
    const rng = createRng([0, 0.5]);
    const question = generateQuestion(rng, "mul1");
    const [left, right] = question.text.split(" × ").map(Number);

    expect(left).toBeGreaterThanOrEqual(2);
    expect(left).toBeLessThanOrEqual(9);
    expect(right).toBeGreaterThanOrEqual(2);
    expect(right).toBeLessThanOrEqual(9);
  });

  test("mul2 ranges stay within bounds", () => {
    const rng = createRng([0, 0.75]);
    const question = generateQuestion(rng, "mul2");
    const [left, right] = question.text.split(" × ").map(Number);

    expect(left).toBeGreaterThanOrEqual(10);
    expect(left).toBeLessThanOrEqual(99);
    expect(right).toBeGreaterThanOrEqual(2);
    expect(right).toBeLessThanOrEqual(9);
  });
});

describe("evaluateAnswer", () => {
  const baseQuestion = { text: "1 + 1", answer: 2, type: "add" as const };
  const initialStats = { score: 2, streak: 1, totalAnswered: 3, totalCorrect: 2 };

  test("invalid input leaves stats unchanged", () => {
    const result = evaluateAnswer("3.9", baseQuestion, initialStats);
    expect(result.status).toBe("invalid");
    expect(result.stats).toEqual(initialStats);
    expect(initialStats.totalAnswered).toBe(3);
  });

  test("correct answer updates totals and streak", () => {
    const result = evaluateAnswer("2", baseQuestion, initialStats);
    expect(result.status).toBe("correct");
    expect(result.stats.score).toBe(initialStats.score + 1);
    expect(result.stats.streak).toBe(initialStats.streak + 1);
    expect(result.stats.totalAnswered).toBe(initialStats.totalAnswered + 1);
    expect(result.stats.totalCorrect).toBe(initialStats.totalCorrect + 1);
  });

  test("wrong answer resets streak but tracks attempts", () => {
    const result = evaluateAnswer("5", baseQuestion, initialStats);
    expect(result.status).toBe("wrong");
    expect(result.stats.score).toBe(initialStats.score);
    expect(result.stats.streak).toBe(0);
    expect(result.stats.totalAnswered).toBe(initialStats.totalAnswered + 1);
    expect(result.stats.totalCorrect).toBe(initialStats.totalCorrect);
  });
});
