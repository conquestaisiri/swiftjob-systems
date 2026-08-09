import { useState, useCallback, useRef } from "react";
import * as XLSX from "xlsx";
import {
  X,
  Loader2,
  AlertCircle,
  FileUp,
  CheckCircle2,
  UploadCloud,
  Table2,
} from "lucide-react";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

export interface ImportRow {
  fullName: string;
  email?: string;
  referredBy?: string;
  jobTitle?: string;
  meetingUrl?: string;
  phone?: string;
  city?: string;
  country?: string;
  address?: string;
  zipCode?: string;
  source?: string;
  notes?: string;
}

interface ColumnMap {
  fullName: number;
  email: number;
  referredBy?: number;
  jobTitle?: number;
  meetingUrl?: number;
  phone?: number;
  city?: number;
  country?: number;
  address?: number;
  zipCode?: number;
  source?: number;
  notes?: number;
}

function normHeader(h: string): string {
  return h
    .toLowerCase()
    .trim()
    .replace(/[_\s]+/g, " ");
}

function detectColumnMap(headers: string[]): ColumnMap {
  const idx = headers.map(normHeader);
  const find = (keys: string[]) => idx.findIndex((h) => keys.includes(h));

  let fullName = find([
    "full name",
    "name",
    "candidate name",
    "applicant name",
  ]);
  const email = find(["email", "email address", "e mail"]);
  const referredBy = find([
    "referred by",
    "referrer",
    "referral",
    "referred",
    "who referred you",
  ]);
  const jobTitle = find([
    "job title",
    "job",
    "position",
    "role",
    "position title",
  ]);
  const meetingUrl = find([
    "meeting link",
    "meeting url",
    "next step link",
    "invite link",
    "link",
  ]);
  const phone = find([
    "phone number",
    "phone",
    "telephone",
    "mobile",
    "phone #",
    "cell",
  ]);
  const city = find(["city", "town"]);
  const country = find(["country", "region", "state", "province"]);
  const address = find([
    "address",
    "street",
    "street address",
    "home address",
    "location",
  ]);
  const zipCode = find([
    "zip code",
    "zip",
    "postcode",
    "postal code",
    "postal",
  ]);
  const source = find(["source", "source #", "source number", "lead source"]);
  const notes = find(["notes", "note", "comments", "remark", "remarks"]);

  const firstIdx = find(["first name", "first"]);
  const lastIdx = find(["last name", "last", "surname"]);
  if (fullName < 0 && firstIdx >= 0 && lastIdx >= 0) {
    fullName = firstIdx;
  }

  return {
    fullName,
    email,
    referredBy: referredBy >= 0 ? referredBy : undefined,
    jobTitle: jobTitle >= 0 ? jobTitle : undefined,
    meetingUrl: meetingUrl >= 0 ? meetingUrl : undefined,
    phone: phone >= 0 ? phone : undefined,
    city: city >= 0 ? city : undefined,
    country: country >= 0 ? country : undefined,
    address: address >= 0 ? address : undefined,
    zipCode: zipCode >= 0 ? zipCode : undefined,
    source: source >= 0 ? source : undefined,
    notes: notes >= 0 ? notes : undefined,
  };
}

function cell(row: (string | number)[], c: number | undefined): string {
  if (c === undefined || c < 0) return "";
  const v = row[c];
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function parseGrid(rows: (string | number)[][], map: ColumnMap): ImportRow[] {
  const out: ImportRow[] = [];
  const headers = (rows[0] ?? []).map((h) => String(h ?? "").trim());
  const firstIdx = headers.findIndex((h) => {
    const n = normHeader(h);
    return n === "first name" || n === "first";
  });
  const lastIdx = headers.findIndex((h) => {
    const n = normHeader(h);
    return n === "last name" || n === "last" || n === "surname";
  });

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;
    const hasFullNameCol = map.fullName >= 0;
    const fullName = hasFullNameCol
      ? cell(row, map.fullName) ||
        [
          cell(row, firstIdx >= 0 ? firstIdx : undefined),
          cell(row, lastIdx >= 0 ? lastIdx : undefined),
        ]
          .filter(Boolean)
          .join(" ")
          .trim()
      : [
          cell(row, firstIdx >= 0 ? firstIdx : undefined),
          cell(row, lastIdx >= 0 ? lastIdx : undefined),
        ]
          .filter(Boolean)
          .join(" ")
          .trim();
    if (!fullName) continue;
    out.push({
      fullName,
      email: cell(row, map.email) || undefined,
      referredBy: cell(row, map.referredBy) || undefined,
      jobTitle: cell(row, map.jobTitle) || undefined,
      meetingUrl: cell(row, map.meetingUrl) || undefined,
      phone: cell(row, map.phone) || undefined,
      city: cell(row, map.city) || undefined,
      country: cell(row, map.country) || undefined,
      address: cell(row, map.address) || undefined,
      zipCode: cell(row, map.zipCode) || undefined,
      source: cell(row, map.source) || undefined,
      notes: cell(row, map.notes) || undefined,
    });
  }
  return out;
}

function parsePasted(text: string): ImportRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return [];
  const rows: ImportRow[] = [];
  for (const line of lines) {
    const cells = line.includes("\t")
      ? line.split("\t")
      : line.split(",").map((c) => c.trim());
    const vals = cells.map((c) => c.replace(/^"|"$/g, "").trim());
    const fullName = vals[0] ?? "";
    const email = vals[1] ?? "";
    if (!fullName) continue;
    rows.push({
      fullName,
      email: email || undefined,
      referredBy: vals[2] || undefined,
      jobTitle: vals[3] || undefined,
      meetingUrl: vals[4] || undefined,
    });
  }
  return rows;
}

function MappedBadge({ label, found }: { label: string; found: boolean }) {
  return (
    <span className={`import-map-badge ${found ? "" : "unmapped"}`}>
      {found ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
      {label}
    </span>
  );
}

export function ImportModal({
  onClose,
  onDone,
  existingCount,
  token,
}: {
  onClose: () => void;
  onDone: (created: number, updated: number, skipped: string[]) => void;
  existingCount: number;
  token: string;
}) {
  const [raw, setRaw] = useState("");
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<ImportRow[]>([]);
  const [detected, setDetected] = useState<{
    foundName: boolean;
    foundEmail: boolean;
    foundPhone: boolean;
    foundAddress: boolean;
    foundZip: boolean;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const applyRows = useCallback((rows: ImportRow[]) => {
    setPreview((prev) => {
      const seen = new Set(prev.map((r) => `${r.fullName}|${r.email ?? ""}`));
      const merged = [...prev];
      for (const row of rows) {
        const key = `${row.fullName}|${row.email ?? ""}`;
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(row);
      }
      return merged;
    });
  }, []);

  const updateRaw = (text: string) => {
    setRaw(text);
    setDetected(null);
    setPreview(parsePasted(text));
  };

  const handleFile = async (file: File) => {
    setError("");
    setFileName(file.name);
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    try {
      let rows: (string | number)[][] = [];
      if (ext === "csv" || ext === "tsv" || ext === "txt") {
        const text = await file.text();
        if (ext === "tsv") {
          rows = text
            .split(/\r?\n/)
            .filter((l) => l.trim().length)
            .map((l) => l.split("\t"));
        } else {
          const wb = XLSX.read(text, { type: "string" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });
        }
      } else {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });
      }
      if (!rows.length) {
        setError("This file appears to be empty.");
        return;
      }
      const map = detectColumnMap(
        (rows[0] ?? []).map((h) => String(h ?? "").trim()),
      );
      setDetected({
        foundName: map.fullName >= 0,
        foundEmail: map.email >= 0,
        foundPhone: (map.phone ?? -1) >= 0,
        foundAddress: (map.address ?? -1) >= 0,
        foundZip: (map.zipCode ?? -1) >= 0,
      });
      setRaw("");
      setPreview(parseGrid(rows, map));
    } catch (err) {
      setError(
        err instanceof Error
          ? `Could not read ${file.name}: ${err.message}`
          : "Could not read file.",
      );
    }
  };

  const importRows = async () => {
    if (!preview.length) {
      setError("No rows detected. Upload a file or paste contacts first.");
      return;
    }
    setBusy(true);
    setError("");
    const rows = preview.map((r) => ({
      fullName: r.fullName,
      email: r.email,
      phone: r.phone,
      address: r.address,
      zipCode: r.zipCode,
    }));
    try {
      const res = await fetch(`${API_BASE}/api/admin/contacts/import`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ rows }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to import");
      onDone(
        data.created?.length ?? 0,
        data.updated?.length ?? 0,
        data.skipped ?? [],
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import");
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content shortlist-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h2>Import contacts</h2>
            <span className="modal-position">{existingCount} existing</span>
          </div>
          <button onClick={onClose} className="modal-close" aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="modal-body">
          <div className="modal-section">
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
                <AlertCircle size={16} /> {error}
              </div>
            )}

            <div className="mb-4">
              <label className="admin-field-label">Upload spreadsheet</label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="import-dropzone"
              >
                <UploadCloud size={22} />
                <span>
                  {fileName ? (
                    <>
                      <strong>{fileName}</strong>
                      <small>Click to choose a different file.</small>
                    </>
                  ) : (
                    <>
                      <strong>Choose an .xlsx, .csv, or .tsv file</strong>
                      <small>
                        We'll read the columns and arrange them for you
                        automatically.
                      </small>
                    </>
                  )}
                </span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.tsv,.txt"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  e.target.value = "";
                }}
              />
            </div>

            {detected && (
              <div className="mb-4">
                <label className="admin-field-label">
                  Auto-detected columns{" "}
                  <span className="opt">— from your file's header row</span>
                </label>
                <div className="import-map-badges">
                  <MappedBadge label="Full name" found={detected.foundName} />
                  <MappedBadge label="Email" found={detected.foundEmail} />
                  <MappedBadge label="Phone" found={detected.foundPhone} />
                  <MappedBadge label="Address" found={detected.foundAddress} />
                  <MappedBadge label="Zip code" found={detected.foundZip} />
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Rows with the wrong order are corrected automatically.
                  Anything marked red means that column wasn't found — you can
                  set a default below, or add it to your file.
                </p>
              </div>
            )}

            <div className="mb-4">
              <label className="admin-field-label">
                Paste contacts <span className="opt">(alternative)</span>
              </label>
              <p className="text-xs text-slate-500 mb-2">
                One person per line, tab- or comma-separated:{" "}
                <code className="text-slate-700">
                  Full Name, Email, Phone (optional), Address (optional), Zip
                  code (optional)
                </code>
              </p>
              <textarea
                value={raw}
                onChange={(e) => updateRaw(e.target.value)}
                rows={6}
                placeholder={
                  "Jane Smith\tjane@email.com\t+1 555 000 0000\nJohn Doe\tjohn@email.com"
                }
                className="filter-input admin-input font-mono text-sm"
              />
            </div>

            {preview.length > 0 && (
              <div className="import-preview">
                <span>
                  <Table2 size={14} /> {preview.length} row
                  {preview.length === 1 ? "" : "s"} detected — first{" "}
                  {Math.min(8, preview.length)}:
                </span>
                <div className="import-preview-rows">
                  {preview.slice(0, 8).map((r, i) => (
                    <div key={i}>
                      <strong>{r.fullName}</strong>
                      {r.email ? ` · ${r.email}` : ""}
                      {r.jobTitle ? ` · ${r.jobTitle}` : ""}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="modal-footer">
            <div className="modal-status-row">
              <button
                type="button"
                onClick={onClose}
                className="button button-sm button-outline"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={importRows}
                className="button button-blue"
              >
                {busy ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <FileUp size={16} />
                )}
                {busy
                  ? " Importing…"
                  : ` Import ${preview.length || ""}`.trim()}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
