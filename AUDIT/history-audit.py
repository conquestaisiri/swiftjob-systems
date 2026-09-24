"""Scan tracked history without emitting matching credentials or source lines."""
import subprocess, re, json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
patterns={
 'private key':r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',
 'provider token':r'\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{30,}|re_[A-Za-z0-9]{20,}|sk_live_[A-Za-z0-9]{16,})',
 'credential URL':r'(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?)://[^\s:/]+:([^\s@]{6,})@',
}
objects=subprocess.check_output(['git','rev-list','--objects','--all'],cwd=root,text=True).splitlines()
findings=[]
for entry in objects:
 oid,_,name=entry.partition(' ')
 if not name or not re.search(r'\.(?:[cm]?[jt]sx?|json|toml|ya?ml|env|md|sh|sql|example)$|(?:^|/)\.env',name,re.I): continue
 result=subprocess.run(['git','cat-file','blob',oid],cwd=root,capture_output=True)
 if result.returncode or len(result.stdout)>2_000_000: continue
 value=result.stdout.decode('utf-8',errors='replace')
 for kind,pattern in patterns.items():
  matches=list(re.finditer(pattern,value))
  if matches:
   classification='requires credential rotation review'
   if kind=='credential URL' and all(m.group(1).lower() in ['password','your_password','your-password','example','changeme'] for m in matches): classification='placeholder only'
   findings.append({'blob':oid,'path':name,'type':kind,'classification':classification,'count':len(matches)})
report={'objects_examined':len(objects),'findings':findings,'limitation':'Pattern scan of text-like tracked history; not proof that all possible credential formats are absent.'}
(root/'AUDIT/evidence/history-secrets.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print(json.dumps(report,indent=2))
