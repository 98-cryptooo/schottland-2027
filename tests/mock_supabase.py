import json, subprocess
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
def q(sql, *args):
    # Parameter als Literale einsetzen (nur Testumgebung)
    lit = lambda s: "'" + s.replace("'", "''") + "'"
    sql = sql % tuple(lit(a) for a in args)
    out = subprocess.run(["psql","-h","/tmp/pgt","-p","5499","-U","postgres","-At","-c","set role anon; "+sql], capture_output=True, text=True)
    if out.returncode: raise Exception(out.stderr)
    l = out.stdout.strip().splitlines(); return "\n".join(l[1:] if l and l[0]=="SET" else l)
class H(BaseHTTPRequestHandler):
    def cors(self):
        self.send_header("Access-Control-Allow-Origin","*"); self.send_header("Access-Control-Allow-Headers","*"); self.send_header("Access-Control-Allow-Methods","POST,OPTIONS")
    def do_OPTIONS(self): self.send_response(204); self.cors(); self.end_headers()
    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        try:
            if self.path.endswith("/sc_push"):
                res = q("select sc_push(%s, %s::jsonb)", body["p_code"], json.dumps(body["p_items"]))
            else:
                res = q("select coalesce(json_agg(r),'[]') from sc_pull(%s, %s::timestamptz) r", body["p_code"], body["p_since"])
            self.send_response(200); self.cors(); self.send_header("Content-Type","application/json"); self.end_headers(); self.wfile.write(res.encode())
        except Exception as e:
            self.send_response(400); self.cors(); self.end_headers(); self.wfile.write(str(e).encode())
    def log_message(self,*a): pass
ThreadingHTTPServer(("127.0.0.1",8081),H).serve_forever()
