#!/usr/bin/env python3
"""Sinov uchun web panel taqlidi (127.0.0.1:4200): har qanday yo'l — sahifa yuklanganda
haqiqiy panel kabi POST /v1/auth/refresh (cookie) qiladi; sessiya bo'lmasa /login ga o'tadi.
Ishlatish: python3 -I docs/test/fake-panel.py http://127.0.0.1:4100"""
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

API = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:4100"
PAGE = """<!doctype html><meta charset=utf-8><title>Panel</title>
<body style="font:16px system-ui;padding:40px;background:#f6f6f6">
<h2 id=t>Web panel (sinov)</h2><p id=s>…</p>
<script>
var API=%r;
if(location.pathname.indexOf('/login')!==0){
 fetch(API+'/v1/auth/refresh',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:'{}'})
 .then(function(r){ if(r.status===401){ location.replace('/login'); return; }
   return r.json().then(function(b){ document.getElementById('s').textContent='Sessiya: '+(b.user&&b.user.name);
     return fetch(API+'/v1/me',{headers:{Authorization:'Bearer '+b.accessToken}}); }); })
 .catch(function(e){ document.getElementById('s').textContent='xato '+e; });
} else { document.getElementById('t').textContent='Kirish (web panel)';

}
</script>"""

class H(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith('/log?'):
            from urllib.parse import unquote
            print('PROBE', unquote(self.path[5:]), flush=True)
            self.send_response(204); self.end_headers(); return
        body = (PAGE % API).encode()
        self.send_response(200); self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body)
    def log_message(self, *a): pass

ThreadingHTTPServer(("127.0.0.1", 4200), H).serve_forever()
