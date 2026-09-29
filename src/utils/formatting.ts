import pc from "picocolors";

export function formatNumber(num: number): string {
  return new Intl.NumberFormat().format(num);
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(amount);
}

export function renderBanner(): string {
  return pc.cyan(`
  ██████╗ ███████╗███████╗██████╗ 
  ██╔══██╗██╔════╝██╔════╝██╔══██╗
  ██████╔╝█████╗  █████╗  ██████╔╝
  ██╔═══╝ ██╔══╝  ██╔══╝  ██╔═══╝ 
  ██║     ███████╗███████╗██║     
  ╚═╝     ╚══════╝╚══════╝╚═╝     
  Peripheral Evaluation & Execution Proxy
  The Open-Source Token Shield for Autonomous Agents
`);
}

export function renderTable(
  headers: string[],
  rows: string[][],
  title?: string
): string {
  const colWidths = headers.map((h, i) => {
    const maxRow = rows.reduce(
      (max, row) => Math.max(max, (row[i] || "").length),
      h.length
    );
    return Math.max(maxRow, h.length) + 2;
  });

  const separator = colWidths.map((w) => "─".repeat(w)).join("┼");
  const headerLine = headers
    .map((h, i) => pc.bold(h.padEnd(colWidths[i])))
    .join("│");

  const formattedRows = rows
    .map((row) =>
      row.map((cell, i) => (cell || "").padEnd(colWidths[i])).join("│")
    )
    .join("\n");

  let out = "";
  if (title) {
    out += pc.bold(pc.yellow(`\n${title}\n`));
  }
  out += `\n${headerLine}\n${separator}\n${formattedRows}\n`;
  return out;
}
