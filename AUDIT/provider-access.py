"""Read-only provider checks. Output only selected non-secret metadata."""
from pathlib import Path
import json, urllib.request, urllib.error, re, subprocess
ROOT=Path(__file__).resolve().parents[1]
out=ROOT/'AUDIT/evidence'
out.mkdir(parents=True,exist_ok=True)
values={}
for line in (ROOT/'.secrets/SWIFTJOB/cloudflare.env').read_text().splitlines():
    m=re.match(r'^\s*([A-Z][A-Z0-9_]+)\s*=\s*(.*?)\s*$',line)
    if m: values[m[1]]=m[2].strip('\"\'')
def get(path, token):
    request=urllib.request.Request('https://api.cloudflare.com/client/v4/'+path,headers={'Authorization':'Bearer '+token})
    try:
        with urllib.request.urlopen(request,timeout=25) as r: return r.status,json.load(r)
    except urllib.error.HTTPError as e: return e.code,{'success':False}
    except Exception as e: return 0,{'success':False,'error_type':type(e).__name__}
results=[]
account=values.get('CLOUDFLARE_ACCOUNT_ID','')
for key in ['CLOUDFLARE_DEPLOY_TOKEN','CLOUDFLARE_ZONE_DNS_TOKEN','CLOUDFLARE_ZONE_DNS_TOKEN_2']:
    if not values.get(key): continue
    status,data=get('user/tokens/verify',values[key])
    results.append({'check':key+' validity','http_status':status,'success':data.get('success'),'token_status':data.get('result',{}).get('status')})
deploy=values.get('CLOUDFLARE_DEPLOY_TOKEN','')
for endpoint in ['workers/scripts','pages/projects','workers/scripts/swiftjob-workers-api/secrets','workers/scripts/swiftjob-workers-api/deployments','r2/buckets']:
    status,data=get('accounts/'+account+'/'+endpoint,deploy)
    result=data.get('result')
    item={'check':endpoint,'http_status':status,'success':data.get('success')}
    if endpoint.endswith('secrets') and isinstance(result,list): item['secret_names']=[v.get('name') for v in result]
    elif endpoint=='pages/projects' and isinstance(result,list): item['projects']=[{'name':v.get('name'),'subdomain':v.get('subdomain'),'domains':v.get('domains'),'production_branch':v.get('production_branch'),'latest_deployment':{k:v.get('latest_deployment',{}).get(k) for k in ['id','url','created_on']}} for v in result]
    elif endpoint=='workers/scripts' and isinstance(result,list): item['workers']=[{'id':v.get('id'),'modified_on':v.get('modified_on')} for v in result]
    elif endpoint.endswith('deployments'): item['deployments']=result
    elif endpoint=='r2/buckets' and isinstance(result,dict): item['buckets']=[v.get('name') for v in result.get('buckets',[])]
    results.append(item)
for key in ['CLOUDFLARE_ZONE_DNS_TOKEN','CLOUDFLARE_ZONE_DNS_TOKEN_2']:
    if not values.get(key): continue
    status,data=get('zones?name=payservice.top',values[key])
    results.append({'check':key+' zone read','http_status':status,'success':data.get('success'),'zones':[{'id':v.get('id'),'name':v.get('name'),'status':v.get('status')} for v in data.get('result',[]) or []]})
remotes=subprocess.check_output(['git','remote','-v'],cwd=ROOT,text=True)
remotes=re.sub(r'(https?://)[^/@\s]+:[^/@\s]+@',r'\1[REDACTED]@',remotes)
results.append({'check':'repository remotes','value':remotes})
(out/'provider-access.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
print(json.dumps(results,indent=2))
