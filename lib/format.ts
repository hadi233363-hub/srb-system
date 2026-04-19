const nf = new Intl.NumberFormat("en-US");

export function formatQAR(amount: number, sign = false): string {
  const abs = Math.round(Math.abs(amount));
  const prefix = amount < 0 ? "−" : sign && amount > 0 ? "+" : "";
  return `${prefix}${nf.format(abs)} ر.ق`;
}

export function formatNumber(n: number): string {
  return nf.format(Math.round(n));
}

export function formatPercent(n: number, digits = 0): string {
  return `${n.toFixed(digits)}%`;
}

export function formatRelativeSim(atSim: number, nowSim: number): string {
  const diffMs = Math.max(0, nowSim - atSim);
  const min = diffMs / 60000;
  if (min < 1) return "الحين";
  if (min < 60) return `قبل ${Math.floor(min)}د`;
  const hr = min / 60;
  if (hr < 24) return `قبل ${Math.floor(hr)}س`;
  const d = hr / 24;
  if (d < 30) return `قبل ${Math.floor(d)}ي`;
  return `قبل ${Math.floor(d / 30)}ش`;
}

export function formatSimDay(startedAt: number, now: number): string {
  const days = Math.floor((now - startedAt) / (24 * 60 * 60 * 1000));
  return `اليوم ${days}`;
}

export function formatSimClock(simTime: number): string {
  const d = new Date(simTime);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}
