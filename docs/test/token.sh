#!/usr/bin/env bash
# Lokal seed API'dan rol uchun access token: docs/test/token.sh owner|admin|finance|manager|hr|operator|employee|auditor
R=${1:-owner}; B=${API:-http://127.0.0.1:4100}; J='content-type: application/json'
C=$(curl -s $B/v1/auth/login -H "$J" -d "{\"login\":\"$R@apteka360.uz\",\"password\":\"x\"}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["challengeId"])')
O=$(curl -s $B/v1/auth/otp -H "$J" -d "{\"challengeId\":\"$C\",\"code\":\"123456\",\"deviceId\":\"cli-$R\"}")
echo "$O" | python3 -c '
import sys,json,subprocess,os
d=json.load(sys.stdin)
if "accessToken" in d: print(d["accessToken"]); sys.exit()
cid=d["newDevice"]["confirmId"]
r=subprocess.run(["curl","-s",os.environ.get("API","http://127.0.0.1:4100")+"/v1/auth/device","-H","content-type: application/json","-d",json.dumps({"confirmId":cid,"decision":"trust"})],capture_output=True,text=True)
print(json.loads(r.stdout)["accessToken"])'
