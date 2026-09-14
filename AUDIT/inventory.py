"""Read-only repository inventory. Never emit matching secret values."""
from pathlib import Path
import subprocess, re, json

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'AUDIT' / 'evidence'
OUT.mkdir(parents=True, exist_ok=True)
files = subprocess.check_output(['git', 'ls-files', '-z'], cwd=ROOT).decode().split('\0')
patterns = {
    'private key': r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',
    'provider token': r'\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{30,}|re_[A-Za-z0-9]{20,}|sk_live_[A-Za-z0-9]{16,})',
    'credential URL': r'(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?)://[^\s:/]+:[^\s@]{6,}@',
    'JWT token': r'\beyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}',
}
findings, inventory, domains, legacy, routes = [], [], [], [], []
for name in filter(None, files):
    p = ROOT / name
    if not p.is_file(): continue
    inventory.append({'file': name, 'bytes': p.stat().st_size})
    if p.stat().st_size > 2_000_000: continue
    try: text = p.read_text(encoding='utf-8')
    except (UnicodeError, OSError): continue
    for no, line in enumerate(text.splitlines(), 1):
        for kind, pattern in patterns.items():
            if re.search(pattern, line): findings.append({'type': kind, 'file': name, 'line': no, 'risk': 'tracked literal; validity not tested'})
        if re.search(r'strix|blue.?peak|supabase|onrender\.com', line, re.I): legacy.append({'file':name,'line':no,'terms': sorted(set(re.findall(r'strix\w*|blue.?peak|supabase|[\w.-]+\.onrender\.com',line,re.I)))})
        if 'payservice.top' in line: domains.append({'file':name,'line':no})
        if name.endswith(('.tsx','.ts','.js')):
            for m in re.finditer(r'(?:\b(?:app|router)\.(get|post|put|patch|delete|use)\(\s*[\'"]([^\'"]+)|<Route[^>]*path=[\'"]([^\'"]+))',line):
                routes.append({'file':name,'line':no,'method':m.group(1) or 'PAGE','route':m.group(2) or m.group(3)})
configs=[]
for base in [ROOT, ROOT/'workers-api', ROOT/'artifacts/swiftjob-systems', ROOT/'.secrets']:
    if not base.exists(): continue
    for p in base.iterdir():
        if p.is_file() and (p.name.startswith(('.env','.dev.vars')) or base.name=='.secrets'):
            keys=[]
            try: keys=re.findall(r'^\s*([A-Z][A-Z0-9_]+)\s*=',p.read_text(),re.M)
            except (UnicodeError,OSError): pass
            configs.append({'file':str(p.relative_to(ROOT)),'keys':keys,'tracked':p.relative_to(ROOT).as_posix() in files})
result={'tracked_files':inventory,'secret_candidates':findings,'legacy':legacy,'domain_dependencies':domains,'routes':routes,'local_configuration_keys_only':configs}
(OUT/'repository-inventory.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps({'tracked_files':len(inventory),'secret_candidates':findings,'legacy_occurrences':len(legacy),'domain_occurrences':len(domains),'routes':len(routes),'configuration':configs},indent=2))
