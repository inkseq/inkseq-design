"""Local Quick Chat assistant for the prototype: one POST /api/assistant -> Gemini Flash.

Run through the central registry so the key is injected only into this process:
  python AI-Registry/tools/api_run.py --service typesafe -- python AI-Registry/tools/api_run.py --service gemini -- python server/assistant.py
The key is never sent to the browser, logged or written to disk.
"""
import base64
import json
import os
import pathlib
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

MODEL = os.environ.get("ASSISTANT_MODEL", "gemini-3.8-flash")  # same allowlisted id as h3-studio quick_chat_assistant
BASE = (os.environ.get("AI_REGISTRY_BASE_URL") or "https://generativelanguage.googleapis.com").rstrip("/")
PUBLIC = pathlib.Path(__file__).resolve().parent.parent / "public"
PORT = 5193

INSTRUCTION = """你是「映序」快速创作里的镜头助手，帮用户把一句想法变成 H3 视频模型的一个镜头方案。只说中文，简短。

H3 有两种互斥模式：
- FL 首尾帧：可选开头帧、结尾帧（图片），也可以只用文字生成。不能放人物/动作参考。
- REF 全能参考：放参考图片/视频/声音，让人物、动作、声音像参考素材。不能放首尾帧。
规则：用户已选模式(chosen_mode 不是 auto)时必须用它；auto 时有视频或声音素材用 REF，只有图片用 FL（第1张开头、第2张结尾）。
时长固定 5 秒。

提示词写法：一段中文，按「风格/画面 → 场景 → 人物 → 动作 → 镜头运动 → 光线色调 → 声音」组织，具体可拍，不要空话，不超过 120 字。
如果给了 previous（上一版方案或要改的那条结果），只按用户这句话修改它，其他保持不变，不要重写整段。

reply：一到两句话告诉用户你怎么理解、改了什么；不要复述整段提示词，不要讲参数。"""

SCHEMA = {"type": "OBJECT", "required": ["reply", "prompt", "mode"], "properties": {
    "reply": {"type": "STRING"}, "prompt": {"type": "STRING"},
    "mode": {"type": "STRING", "enum": ["FL", "REF"]}}}


def image_part(thumb):
    # Only real files under public/ (clip frames); generated SVG placeholders are described by name.
    if not isinstance(thumb, str) or not thumb.startswith("/") or not thumb.endswith((".jpg", ".png")):
        return None
    path = (PUBLIC / thumb.lstrip("/")).resolve()
    if PUBLIC not in path.parents or not path.is_file():
        return None
    mime = "image/png" if thumb.endswith(".png") else "image/jpeg"
    return {"inline_data": {"mime_type": mime, "data": base64.b64encode(path.read_bytes()).decode()}}


def ask(req):
    key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not key:
        raise RuntimeError("没有 Gemini Key：请用 AI-Registry 的 api_run.py --service gemini 启动")
    atts = req.get("attachments", [])
    ctx = {"user_says": req.get("text", ""), "chosen_mode": req.get("mode", "auto"),
           "attachments": [{"name": a.get("name"), "kind": a.get("kind"), "role": a.get("role")} for a in atts],
           "previous": req.get("previous"), "intent": req.get("intent")}
    parts = [{"text": json.dumps(ctx, ensure_ascii=False)}]
    for a in atts:
        part = image_part(a.get("thumb"))
        if part:
            parts += [{"text": f"素材「{a.get('name')}」："}, part]
    body = {"systemInstruction": {"parts": [{"text": INSTRUCTION}]},
            "contents": [*req.get("history", []), {"role": "user", "parts": parts}],
            "generationConfig": {"responseMimeType": "application/json", "responseSchema": SCHEMA, "temperature": 0.6}}
    http = urllib.request.Request(f"{BASE}/v1beta/models/{MODEL}:generateContent", data=json.dumps(body).encode(),
                                  headers={"Content-Type": "application/json", "x-goog-api-key": key}, method="POST")
    try:
        with urllib.request.urlopen(http, timeout=60) as r:
            data = json.load(r)
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"Gemini 返回 {e.code}: {e.read().decode(errors='replace')[:300]}") from None
    text = "".join(p.get("text", "") for p in data["candidates"][0]["content"]["parts"])
    out = json.loads(text)
    out["model"] = data.get("modelVersion", MODEL)
    return out


JEV_BASE = "https://api.typesafe.ai/v1"


def match(req):
    """POST /api/match: forward typed questions to TypeSafe Jev (calibrated choices with confidence)."""
    key = os.environ.get("TYPESAFE_API_KEY")
    if not key:
        raise RuntimeError("没有 TypeSafe Key：请用 AI-Registry 的 api_run.py --service typesafe 启动")
    body = {"model": "jev-latest", "state": req.get("state", {}), "questions": req.get("questions", {})}
    http = urllib.request.Request(JEV_BASE + "/systemone", data=json.dumps(body, ensure_ascii=False).encode(),
                                  headers={"Content-Type": "application/json", "Authorization": "Bearer " + key}, method="POST")
    try:
        with urllib.request.urlopen(http, timeout=30) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"Jev 返回 {e.code}: {e.read().decode(errors='replace')[:300]}") from None


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path not in ("/api/assistant", "/api/match"):
            return self.send_error(404)
        try:
            req = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))))
            res, code = (match(req) if self.path == "/api/match" else ask(req)), 200
        except Exception as e:  # message only; never includes the key
            res, code = {"error": str(e)}, 502
        payload = json.dumps(res, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, fmt, *args):
        print("assistant:", self.command, self.path, args[1] if len(args) > 1 else "")


if __name__ == "__main__":
    print(f"assistant on http://127.0.0.1:{PORT} model={MODEL} jev={'on' if os.environ.get('TYPESAFE_API_KEY') else 'off'}")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
