export function unescapeUnicode(str: string): string {
  const trimmed = str.startsWith(" \\u") ? str.slice(1) : str;
  return trimmed.replace(/\\u([0-9A-Fa-f]{4})/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16))
  );
}

export function escapeUnicode(str: string): string {
  let result = "";
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code > 127) {
      result += "\\u" + code.toString(16).toUpperCase().padStart(4, "0");
    } else {
      result += str[i];
    }
  }
  if (result.startsWith("\\u")) {
    result = " " + result;
  }
  return result;
}
