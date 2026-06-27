"use strict";

/**
 * Aligned status-digest renderer.
 *
 * On-call digests print a titled, two-column table of metrics. Given a `title`
 * and `rows` ([{ label, value }]), `renderReport` must produce EXACTLY:
 *
 *   1. the title on its own line,
 *   2. an underline of "=" exactly as wide as the title,
 *   3. one line per row: the label LEFT-justified and padded to the widest
 *      label, then two spaces, then the value RIGHT-justified and padded to the
 *      widest value,
 *   4. a footer line "(<n> metrics)" with the row count,
 *   5. all of the above joined by "\n", with no trailing newline,
 *   6. NOTHING truncated — a long label widens the whole column.
 *
 * Example — renderReport("Health", [{label:"CPU",value:"5%"},{label:"Memory",value:"1024MB"}]):
 *
 *   Health
 *   ======
 *   CPU        5%
 *   Memory  1024MB
 *   (2 metrics)
 *
 * A digest that truncates labels or misaligns the value column hides the metric
 * that matters during an incident, so every rule above is load-bearing.
 */
function renderReport(title, rows) {
  // BUG: hand-rolled alignment that is wrong in several ways — a hard-coded
  // 10-char column, manual padding that TRUNCATES longer labels, a fixed-width
  // underline that ignores the title's length, no value-column alignment, and
  // no footer. Satisfying the contract above needs a two-pass render (scan for
  // the widest label AND value, then pad both columns) with a title-width
  // underline and a row-count footer.
  const COL = 10;
  const out = [];
  out.push(title);
  out.push("----------");
  for (const row of rows) {
    let label = String(row.label);
    if (label.length > COL) {
      label = label.slice(0, COL);
    }
    let pad = "";
    let k = label.length;
    while (k < COL) {
      pad = pad + " ";
      k = k + 1;
    }
    out.push(label + pad + String(row.value));
  }
  return out.join("\n");
}

module.exports = { renderReport, buildReport: renderReport };
