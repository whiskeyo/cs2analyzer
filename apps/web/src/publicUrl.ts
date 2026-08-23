/** Prefix a file under `public/` with Vite's base (subdirectory deploys). */
export function publicUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`;
}
