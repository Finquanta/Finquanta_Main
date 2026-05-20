export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

export function formatPercentChange(current: number, previous: number): string {
  if (previous === 0) {
    return current === 0 ? '+0%' : '+100%';
  }

  const change = ((current - previous) / Math.abs(previous)) * 100;
  const sign = change >= 0 ? '+' : '';
  return `${sign}${Number(change.toFixed(1))}%`;
}

export function changeType(current: number, previous: number): 'positive' | 'negative' {
  return current >= previous ? 'positive' : 'negative';
}

export function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }

  const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
