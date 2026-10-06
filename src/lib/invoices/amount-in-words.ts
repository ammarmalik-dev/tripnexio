const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function belowHundred(n: number): string {
  if (n < 20) return ONES[n];
  return `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ""}`;
}

function belowThousand(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  return [hundreds ? `${ONES[hundreds]} Hundred` : "", rest ? belowHundred(rest) : ""].filter(Boolean).join(" ");
}

/** Indian numbering (crore / lakh / thousand) for a whole number. */
export function integerInWords(value: number): string {
  let n = Math.floor(Math.abs(value));
  if (n === 0) return "Zero";
  const parts: string[] = [];
  const crore = Math.floor(n / 10_000_000);
  n %= 10_000_000;
  const lakh = Math.floor(n / 100_000);
  n %= 100_000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  if (crore) parts.push(`${integerInWords(crore)} Crore`);
  if (lakh) parts.push(`${belowHundred(lakh)} Lakh`);
  if (thousand) parts.push(`${belowHundred(thousand)} Thousand`);
  if (n) parts.push(belowThousand(n));
  return parts.join(" ");
}

/** "Indian Rupees Five Thousand Eight Hundred Sixty Only" (with "and N Paise" when there are paise). Other currencies use their code. */
export function amountInWords(amount: number, currencyCode = "INR"): string {
  const rounded = Math.round(Math.abs(amount) * 100);
  const whole = Math.floor(rounded / 100);
  const fraction = rounded % 100;
  const unit = currencyCode === "INR" ? "Indian Rupees" : currencyCode;
  const minor = currencyCode === "INR" ? "Paise" : "Cents";
  return `${unit} ${integerInWords(whole)}${fraction ? ` and ${belowHundred(fraction)} ${minor}` : ""} Only`;
}
