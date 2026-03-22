export function parseCsvHeader(text: string): string[] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < firstLine.length; index += 1) {
    const character = firstLine[index];

    if (character === '"') {
      const nextCharacter = firstLine[index + 1];
      if (inQuotes && nextCharacter === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += character;
  }

  if (current.length > 0 || firstLine.endsWith(",")) {
    values.push(current.trim());
  }

  return values.filter(Boolean);
}

export async function extractCsvColumns(file: File): Promise<string[]> {
  const text = await file.text();
  return parseCsvHeader(text);
}
