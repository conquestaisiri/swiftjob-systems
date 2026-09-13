"""Read-only verification of the production swiftjob.online email routing."""
from pathlib import Path
import json
import re
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
ENV = Path("C:/Users/USER/Desktop/SWIFTJOB-ALL-ACCOUNT-ACCESS-KEYS.env")
values = {}
for line in ENV.read_text(encoding="utf-8").splitlines():
    match = re.match(r"^([A-Z][A-Z0-9_]*)=(.*)$", line.strip())
    if match:
        values[match.group(1)] = match.group(2).strip("\"'")

token = values.get("CLOUDFLARE_API_TOKEN_SPARKLING_SALAD", "")
zone_id = values.get("SWIFTJOB_CLOUDFLARE_ZONE_ID", "")


def get(path):
    request = urllib.request.Request(
        "https://api.cloudflare.com/client/v4/" + path,
        headers={"Authorization": "Bearer " + token},
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            return response.status, json.load(response)
    except urllib.error.HTTPError as error:
        return error.code, {"success": False}
    except Exception as error:
        return 0, {"success": False, "error_type": type(error).__name__}


if not token:
    raise SystemExit("CLOUDFLARE_API_TOKEN_SPARKLING_SALAD is missing")

zone_status, zone_data = get("zones?name=swiftjob.online")
if zone_status != 200 or not zone_data.get("result"):
    raise SystemExit("swiftjob.online zone lookup failed")
zone = zone_data["result"][0]
zone_id = zone.get("id") or zone_id

settings_status, settings_data = get(f"zones/{zone_id}/email/routing")
rules_status, rules_data = get(f"zones/{zone_id}/email/routing/rules")
dns_status, dns_data = get(f"zones/{zone_id}/email/routing/dns")
rules = rules_data.get("result") or []
aliases = []
for rule in rules:
    for matcher in rule.get("matchers") or []:
        if matcher.get("field") == "to" and matcher.get("type") == "literal":
            aliases.append(matcher.get("value", "").split("@", 1)[0])
        elif matcher.get("type") == "all":
            aliases.append("catch-all")

evidence = {
    "date": "2026-09-13",
    "zone": zone.get("name"),
    "zoneStatus": zone.get("status"),
    "routing": {
        "status": settings_status,
        "success": settings_data.get("success"),
        "enabled": (settings_data.get("result") or {}).get("enabled"),
        "state": (settings_data.get("result") or {}).get("status"),
    },
    "rules": {
        "status": rules_status,
        "success": rules_data.get("success"),
        "enabledCount": sum(1 for rule in rules if rule.get("enabled")),
        "totalCount": len(rules),
        "aliases": sorted(aliases),
        "allForwardToConfiguredGmail": all(
            action.get("type") == "forward" and action.get("value")
            for rule in rules
            for action in rule.get("actions") or []
        ),
    },
    "dns": {
        "status": dns_status,
        "success": dns_data.get("success"),
        "recordCount": len(dns_data.get("result") or []),
        "mxCount": sum(1 for record in dns_data.get("result") or [] if record.get("type") == "MX"),
    },
}
evidence["status"] = "PASS" if (
    evidence["zoneStatus"] == "active"
    and evidence["routing"]["enabled"] is True
    and evidence["routing"]["state"] == "ready"
    and evidence["rules"]["success"] is True
    and evidence["rules"]["enabledCount"] == evidence["rules"]["totalCount"] == 5
    and set(evidence["rules"]["aliases"]) == {"admin", "careers", "hr", "support", "catch-all"}
    and evidence["rules"]["allForwardToConfiguredGmail"]
    and evidence["dns"]["mxCount"] == 3
) else "FAIL"

(ROOT / "AUDIT/evidence/email-routing-live-closure.json").write_text(
    json.dumps(evidence, indent=2) + "\n", encoding="utf-8"
)
print(json.dumps(evidence, indent=2))
if evidence["status"] != "PASS":
    raise SystemExit(1)
