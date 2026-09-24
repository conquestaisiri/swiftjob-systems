export interface MailRecipient {
  email: string;
  fullName?: string;
}

export interface MailRecipientParseResult {
  recipients: MailRecipient[];
  invalidLines: string[];
  duplicateEmails: string[];
}

const EMAIL_SHAPE = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;

function parseLine(line: string): MailRecipient | null {
  const displayName = line.match(/^(.+?)\s*<([^<>]+)>$/);
  let email: string;
  let fullName: string | undefined;

  if (displayName) {
    email = displayName[2].trim();
    fullName = displayName[1].trim().replace(/^"|"$/g, "");
    if (!fullName) return null;
  } else if (EMAIL_SHAPE.test(line)) {
    email = line;
  } else {
    const nameAndEmail = line.match(/^(.+?)\s+([^\s]+)$/);
    if (!nameAndEmail || !EMAIL_SHAPE.test(nameAndEmail[2])) return null;
    fullName = nameAndEmail[1].trim();
    email = nameAndEmail[2];
  }

  if (!EMAIL_SHAPE.test(email)) return null;
  return { email: email.toLowerCase(), ...(fullName ? { fullName } : {}) };
}

/** Parse one recipient per line; report bad and repeated lines instead of silently discarding them. */
export function parseMailRecipients(text: string): MailRecipientParseResult {
  const recipients: MailRecipient[] = [];
  const invalidLines: string[] = [];
  const duplicateEmails: string[] = [];
  const seen = new Set<string>();

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const recipient = parseLine(line);
    if (!recipient) {
      invalidLines.push(line);
      continue;
    }
    if (seen.has(recipient.email)) {
      duplicateEmails.push(recipient.email);
      continue;
    }

    seen.add(recipient.email);
    recipients.push(recipient);
  }

  return { recipients, invalidLines, duplicateEmails };
}
