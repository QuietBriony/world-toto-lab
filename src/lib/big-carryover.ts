export type BigCarryoverInput = {
  carryoverYen: number | null;
  returnRate: number;
  salesYen: number | null;
  spendYen: number | null;
};

export type BigCarryoverSummary = {
  approxEvMultiple: number | null;
  breakEvenCarryoverYen: number | null;
  breakEvenGapYen: number | null;
  carryoverUplift: number | null;
  expectedProfitYen: number | null;
  overBreakEven: number | null;
  overReturnRate: number | null;
};

function isKnownPositiveNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isKnownNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function calculateBigCarryoverSummary(
  input: BigCarryoverInput,
): BigCarryoverSummary {
  const salesYen = isKnownPositiveNumber(input.salesYen) ? input.salesYen : null;
  const carryoverYen = isKnownNumber(input.carryoverYen) ? input.carryoverYen : null;
  const spendYen = isKnownNumber(input.spendYen) ? input.spendYen : null;
  const returnRate = isKnownNumber(input.returnRate) ? input.returnRate : 0.5;

  if (salesYen === null || carryoverYen === null) {
    return {
      approxEvMultiple: null,
      breakEvenCarryoverYen: salesYen !== null ? salesYen * (1 - returnRate) : null,
      breakEvenGapYen: null,
      carryoverUplift: null,
      expectedProfitYen: null,
      overBreakEven: null,
      overReturnRate: null,
    };
  }

  const carryoverUplift = carryoverYen / salesYen;
  const approxEvMultiple = returnRate + carryoverUplift;
  const breakEvenCarryoverYen = salesYen * (1 - returnRate);
  const breakEvenGapYen = carryoverYen - breakEvenCarryoverYen;
  const overBreakEven = approxEvMultiple - 1;
  const overReturnRate = approxEvMultiple - returnRate;
  const expectedProfitYen =
    spendYen !== null ? spendYen * (approxEvMultiple - 1) : null;

  return {
    approxEvMultiple,
    breakEvenCarryoverYen,
    breakEvenGapYen,
    carryoverUplift,
    expectedProfitYen,
    overBreakEven,
    overReturnRate,
  };
}

export function buildBigCarryoverScenarioRows(input: {
  approxEvMultiple: number | null;
  spendOptionsYen?: number[];
}) {
  const spendOptions = input.spendOptionsYen ?? [1_000, 10_000, 50_000, 100_000];

  return spendOptions.map((spendYen) => ({
    expectedProfitYen:
      input.approxEvMultiple !== null
        ? Math.round(spendYen * (input.approxEvMultiple - 1))
        : null,
    spendYen,
  }));
}
