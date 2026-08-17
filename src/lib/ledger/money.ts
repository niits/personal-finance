const maxSafeInteger = BigInt(Number.MAX_SAFE_INTEGER);
const minSafeInteger = BigInt(Number.MIN_SAFE_INTEGER);

export function assertSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${label} must be a safe integer`);
  }
}

export function safeNumber(value: bigint, label: string): number {
  if (value > maxSafeInteger || value < minSafeInteger) {
    throw new Error(`${label} is outside Number safe range`);
  }
  return Number(value);
}

export function safeSum(values: number[], label: string): number {
  const total = values.reduce((sum, value) => {
    assertSafeInteger(value, label);
    return sum + BigInt(value);
  }, BigInt(0));
  return safeNumber(total, label);
}

export function safeDifference(left: number, right: number, label: string): number {
  assertSafeInteger(left, label);
  assertSafeInteger(right, label);
  return safeNumber(BigInt(left) - BigInt(right), label);
}
