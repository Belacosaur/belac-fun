function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

export function crawlerHtml(input: {
  title: string;
  description: string;
  canonical: string;
  asOf?: string;
  illustrative: boolean;
}) {
  const description = input.illustrative
    ? "Sample data. Not a real result."
    : input.description;
  const asOf = input.asOf ? `<meta property="article:modified_time" content="${escapeHtml(input.asOf)}" />` : "";
  return `<!doctype html>
<html lang="en-AU">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(input.title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${escapeHtml(input.canonical)}" />
    ${asOf}
  </head>
  <body>
    <h1>${escapeHtml(input.title)}</h1>
    <p>${escapeHtml(description)}</p>
  </body>
</html>`;
}
