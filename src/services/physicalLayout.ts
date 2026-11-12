export interface LayoutModule { id: string; label: string }
export interface PhysicalLayoutDraft { id: string; name: string; modules: LayoutModule[] }

export function layoutStorageKey(plantCode: string) {
  return `solar-monitoring:physical-layout:v1:${encodeURIComponent(plantCode)}`;
}

export function decodeLayouts(raw: string | null): PhysicalLayoutDraft[] {
  if (raw === null) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed) || parsed.length > 100) throw new Error("Format draf layout tidak valid.");
  const ids = new Set<string>();
  for (const value of parsed) {
    if (!value || typeof value.id !== "string" || !value.id || ids.has(value.id) ||
        typeof value.name !== "string" || !value.name.trim() || value.name.length > 80 ||
        !Array.isArray(value.modules) || value.modules.length > 500) throw new Error("Format draf layout tidak valid.");
    ids.add(value.id);
    const moduleIds = new Set<string>();
    for (const module of value.modules) {
      if (!module || typeof module.id !== "string" || !module.id || moduleIds.has(module.id) ||
          typeof module.label !== "string" || !module.label.trim() || module.label.length > 80) throw new Error("Format modul draf tidak valid.");
      moduleIds.add(module.id);
    }
  }
  return parsed;
}
