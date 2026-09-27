/** Replace `{name}` placeholders. Unknown names stay in the string. */
export function translate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{([A-Za-z0-9_]+)\}/g, (token, key: string) => {
    if (!Object.prototype.hasOwnProperty.call(vars, key)) return token;
    return String(vars[key]);
  });
}
