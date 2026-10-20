#!/usr/bin/env python3
"""Sinov: lokal http API oldidagi proksi — Strict-Transport-Security sarlavhasini olib tashlaydi
(aks holda WebKit 127.0.0.1 uchun HSTS eslab qolib, so'rovlarni https'ga o'tkazadi).
Ishlatish: python3 -I docs/test/no-hsts-proxy.py 4101 127.0.0.1:4100"""
import http.client, sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT, UP = int(sys.argv[1]), sys.argv[2]

class H(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    def _go(self):
        n = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(n) if n else None
        c = http.client.HTTPConnection(UP, timeout=30)
        hdr = {k: v for k, v in self.headers.items() if k.lower() not in ("host", "connection")}
        c.request(self.command, self.path, body=body, headers=hdr)
        r = c.getresponse(); data = r.read()
        self.send_response(r.status)
        for k, v in r.getheaders():
            if k.lower() in ("strict-transport-security", "transfer-encoding", "connection", "content-length"): continue
            self.send_header(k, v)
        self.send_header("Content-Length", str(len(data))); self.end_headers(); self.wfile.write(data)
    do_GET = do_POST = do_OPTIONS = do_PUT = do_DELETE = do_PATCH = _go
    def log_message(self, *a): pass

ThreadingHTTPServer(("127.0.0.1", PORT), H).serve_forever()
