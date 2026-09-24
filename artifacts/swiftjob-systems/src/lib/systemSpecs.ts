export interface SystemSpecEntry {
  label: string;
  value: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function getTechCheckSpecs(
  systemCheck: unknown,
): Record<string, unknown> | null {
  if (!isRecord(systemCheck)) return null;
  const tool = systemCheck.tool;
  if (!isRecord(tool)) return null;
  return isRecord(tool.specs) ? tool.specs : null;
}

function text(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function number(value: unknown, digits = 1): string | null {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toFixed(digits).replace(/(\.\d*?[1-9])0+$|\.0+$/, "$1")
    : null;
}

export function formatSystemSpecEntries(
  specs: Record<string, unknown> | null | undefined,
): SystemSpecEntry[] {
  if (!specs) return [];

  const device = [
    text(specs.deviceType),
    text(specs.manufacturer),
    text(specs.model),
  ]
    .filter((part): part is string => Boolean(part))
    .join(" · ");
  const os = [
    text(specs.os),
    text(specs.osVersion) ? `version ${text(specs.osVersion)}` : null,
    text(specs.osBuild) ? `build ${text(specs.osBuild)}` : null,
    text(specs.systemArchitecture),
  ]
    .filter((part): part is string => Boolean(part))
    .join(" · ");
  const cpu = [
    text(specs.cpu),
  ]
    .filter((part): part is string => Boolean(part))
    .join(" · ");
  const cpuLayout = [
    typeof specs.cores === "number" ? `${specs.cores} cores` : null,
    typeof specs.threads === "number" ? `${specs.threads} logical processors` : null,
    number(specs.cpuMaxGHz, 2)
      ? `up to ${number(specs.cpuMaxGHz, 2)} GHz`
      : null,
  ]
    .filter((part): part is string => Boolean(part))
    .join(" · ");
  const memory = [
    number(specs.ramGB) ? `${number(specs.ramGB)} GB installed` : null,
    number(specs.ramAvailableGB)
      ? `${number(specs.ramAvailableGB)} GB available at check`
      : null,
  ]
    .filter((part): part is string => Boolean(part))
    .join(" · ");
  const storage =
    text(specs.storage) ??
    [
      number(specs.storageTotalGB) ? `${number(specs.storageTotalGB)} GB total` : null,
      number(specs.storageFreeGB) ? `${number(specs.storageFreeGB)} GB free` : null,
    ]
      .filter((part): part is string => Boolean(part))
      .join(" · ");

  const rows: Array<[string, string | null]> = [
    ["Device", device || null],
    ["Operating system", os || null],
    ["Processor", cpu || null],
    ["System architecture", text(specs.systemType)],
    ["CPU configuration", cpuLayout || null],
    ["Memory", memory || null],
    ["Graphics", text(specs.gpu)],
    ["Storage", storage || null],
    ["Performance rating", text(specs.benchmark)],
    [
      "Check recorded",
      text(specs.checkedAt)
        ? new Date(String(specs.checkedAt)).toLocaleString()
        : null,
    ],
  ];

  return rows
    .filter((row): row is [string, string] => Boolean(row[1]))
    .map(([label, value]) => ({ label, value }));
}
