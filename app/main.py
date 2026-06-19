"""UberPHOTO MVP - FastAPI application."""
import os
import uuid
import json
import asyncio
import shutil
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from .db import db, init_db
from .matching import manager
from .payments import create_payment

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATIC_DIR = os.path.join(BASE_DIR, "static")
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

PLANS = {
    "light": {"label": "ライト 15枚", "shots": 15, "minutes": 30, "price": 3278},      # 2,980 税別
    "standard": {"label": "スタンダード 30枚", "shots": 30, "minutes": 30, "price": 4378},  # 3,980 税別
    "premium": {"label": "プレミアム 50枚", "shots": 50, "minutes": 60, "price": 6600},   # 6,000 税別
}

app = FastAPI(title="UberPHOTO")

import math

# Asakusa as the trial area centre.
ASAKUSA = (35.7148, 139.7967)

# Demo photographers so a customer always sees 2-3 nearby choices.
# Names + thumbs mirror the featured cards on the landing page.
DEMO_PHOTOGRAPHERS = [
    {"name": "Yuki", "rating": 4.9, "shots": 320, "specialty": "ポートレート,自然光", "thumb": "/static/img/work1.jpg", "lat": 35.7118, "lng": 139.7966, "bio": "自然光のポートレートが得意。肩の力が抜けた、その人らしい一枚を。"},
    {"name": "Ren", "rating": 4.8, "shots": 210, "specialty": "スナップ,家族", "thumb": "/static/img/work2.jpg", "lat": 35.7172, "lng": 139.7945, "bio": "家族やグループのスナップを、テンポよく楽しく撮ります。"},
    {"name": "Mei", "rating": 5.0, "shots": 158, "specialty": "カップル,映え", "thumb": "/static/img/work3.jpg", "lat": 35.7139, "lng": 139.7998, "bio": "カップル・映え写真の専門。SNSで映える構図をご提案。"},
]
SPECIALTIES = ["ポートレート,自然光", "スナップ,家族", "カップル,映え", "風景,旅", "夜景,イルミ"]
WORK_THUMBS = [f"/static/img/work{i}.jpg" for i in range(1, 7)]
DEMO_SHOOT = ["work1.jpg", "work3.jpg", "work5.jpg", "work6.jpg"]
BIOS = [
    "旅の自然な瞬間を切り取ります。気軽に声をかけてください。",
    "観光地の空気感ごと、思い出を残すのが好きです。",
    "笑顔を引き出すのが得意。リラックスして楽しみましょう。",
]
REVIEWERS = ["A.K.", "M.S.", "R.T.", "Y.N.", "春", "ゆい", "Kenji", "Sara", "だいき", "Emma"]
REVIEW_TEXTS = [
    "自然な表情を引き出してくれて大満足！",
    "テンポよく撮ってくれて、あっという間でした。",
    "構図のセンスが抜群。SNSでたくさん褒められました。",
    "緊張していましたが、上手にリラックスさせてくれました。",
    "短時間なのに枚数もクオリティも大満足です。",
    "観光を楽しみながら最高の思い出が残せました。",
    "光の使い方がプロ。写真が見違えました。",
]
REVIEW_AGO = ["3日前", "1週間前", "2週間前", "先月", "先々月"]


def synth_reviews(pid: int, count: int = 3):
    out = []
    for i in range(count):
        out.append({
            "author": REVIEWERS[(pid + i * 3) % len(REVIEWERS)],
            "rating": 4 if (pid + i) % 5 == 0 else 5,
            "text": REVIEW_TEXTS[(pid * 2 + i) % len(REVIEW_TEXTS)],
            "ago": REVIEW_AGO[(pid + i) % len(REVIEW_AGO)],
        })
    return out


def haversine_km(a, b):
    (lat1, lng1), (lat2, lng2) = a, b
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(min(1, math.sqrt(h)))


def seed_demo_photographers():
    with db() as conn:
        n = conn.execute("SELECT COUNT(*) c FROM photographers WHERE is_demo=1").fetchone()["c"]
        if n:
            return
        for d in DEMO_PHOTOGRAPHERS:
            conn.execute(
                "INSERT INTO photographers (name, status, rating, shots, specialty, thumb, lat, lng, is_demo) "
                "VALUES (?, 'online', ?, ?, ?, ?, ?, ?, 1)",
                (d["name"], d["rating"], d["shots"], d["specialty"], d["thumb"], d["lat"], d["lng"]),
            )


def synth_profile(pid: int):
    """Deterministic display profile for real photographers (no real data yet)."""
    rating = round(4.6 + (pid * 7 % 5) / 10, 1)
    shots = 24 + (pid * 53 % 380)
    specialty = SPECIALTIES[pid % len(SPECIALTIES)]
    thumb = WORK_THUMBS[pid % len(WORK_THUMBS)]
    return rating, shots, specialty, thumb


def photographer_bio(row):
    if row["is_demo"]:
        for d in DEMO_PHOTOGRAPHERS:
            if d["name"] == row["name"]:
                return d["bio"]
    return BIOS[row["id"] % len(BIOS)]


def photographer_view(row, origin=None):
    pid = row["id"]
    # portfolio: 6 people photos, rotated by id so each photographer differs
    portfolio = [WORK_THUMBS[(pid + i) % len(WORK_THUMBS)] for i in range(6)]
    # distance: real haversine if we know both ends, else a stable fallback
    if origin and row["lat"] is not None and row["lng"] is not None:
        dist = round(haversine_km(origin, (row["lat"], row["lng"])), 1)
    else:
        dist = round(0.2 + (pid * 3 % 9) / 10, 1)
    eta = max(1, round(dist * 1000 / 80))  # ~80 m/min walking
    return {
        "id": pid,
        "name": row["name"],
        "rating": row["rating"],
        "shots": row["shots"],
        "tags": [t for t in (row["specialty"] or "").split(",") if t],
        "thumb": row["thumb"] or WORK_THUMBS[pid % len(WORK_THUMBS)],
        "portfolio": portfolio,
        "bio": photographer_bio(row),
        "reviews": synth_reviews(pid),
        "distance_km": dist,
        "eta_min": eta,
        "is_demo": bool(row["is_demo"]),
    }


async def simulate_demo_shoot(token: str, rid: int):
    """A demo photographer 'takes' photos: copy sample images into the session."""
    await asyncio.sleep(4)
    sess_dir = os.path.join(UPLOAD_DIR, token)
    os.makedirs(sess_dir, exist_ok=True)
    with db() as conn:
        s = conn.execute("SELECT id, status FROM sessions WHERE gallery_token=?", (token,)).fetchone()
        if not s or s["status"] != "shooting":
            return  # cancelled before the shoot completed
        sid = s["id"]
        for name in DEMO_SHOOT:
            src = os.path.join(STATIC_DIR, "img", name)
            if not os.path.exists(src):
                continue
            fname = f"{uuid.uuid4().hex}.jpg"
            shutil.copyfile(src, os.path.join(sess_dir, fname))
            conn.execute("INSERT INTO photos (session_id, filename) VALUES (?, ?)", (sid, fname))
    await manager.send_to_customer(rid, {"type": "photos_uploaded", "count": len(DEMO_SHOOT), "gallery_token": token})
    await asyncio.sleep(1.2)
    with db() as conn:
        conn.execute("UPDATE sessions SET status='done', completed_at=datetime('now') WHERE gallery_token=?", (token,))
        conn.execute("UPDATE requests SET status='done' WHERE id=?", (rid,))
    await manager.send_to_customer(rid, {"type": "session_complete", "gallery_token": token})
    await manager.broadcast_to_operators({"type": "stats_changed"})


@app.on_event("startup")
def _startup():
    init_db()
    seed_demo_photographers()


# ---------------- Page routes ----------------
def _page(name: str):
    return FileResponse(os.path.join(STATIC_DIR, name))


@app.get("/")
def index():
    return _page("index.html")


@app.get("/customer")
def customer_page():
    return _page("customer.html")


@app.get("/photographer")
def photographer_page():
    return _page("photographer.html")


@app.get("/operator")
def operator_page():
    return _page("operator.html")


@app.get("/gallery")
def gallery_page():
    return _page("gallery.html")


# ---------------- API: plans ----------------
@app.get("/api/plans")
def get_plans():
    return PLANS


# ---------------- API: photographer ----------------
class PhotographerIn(BaseModel):
    name: str
    phone: Optional[str] = None


@app.post("/api/photographers")
def register_photographer(p: PhotographerIn):
    with db() as conn:
        cur = conn.execute(
            "INSERT INTO photographers (name, phone, status) VALUES (?, ?, 'offline')",
            (p.name, p.phone),
        )
        pid = cur.lastrowid
        rating, shots, specialty, thumb = synth_profile(pid)
        conn.execute(
            "UPDATE photographers SET rating=?, shots=?, specialty=?, thumb=? WHERE id=?",
            (rating, shots, specialty, thumb, pid),
        )
        return {"id": pid, "name": p.name}


@app.get("/api/photographers/nearby")
def nearby_photographers(lat: Optional[float] = None, lng: Optional[float] = None):
    """Up to 3 nearby online photographers, sorted by real distance from the
    customer (if their location is provided)."""
    origin = (lat, lng) if lat is not None and lng is not None else None
    with db() as conn:
        rows = conn.execute("SELECT * FROM photographers WHERE status='online'").fetchall()
    views = [photographer_view(r, origin) for r in rows]
    # closest first; if no location, real photographers first then by distance
    if origin:
        views.sort(key=lambda v: v["distance_km"])
    else:
        views.sort(key=lambda v: (v["is_demo"], v["distance_km"]))
    return views[:3]


class LocationIn(BaseModel):
    lat: float
    lng: float


@app.post("/api/photographers/{pid}/location")
def set_location(pid: int, loc: LocationIn):
    with db() as conn:
        conn.execute("UPDATE photographers SET lat=?, lng=? WHERE id=?", (loc.lat, loc.lng, pid))
    return {"ok": True}


@app.post("/api/photographers/{pid}/status")
def set_status(pid: int, payload: dict):
    status = payload.get("status", "offline")
    with db() as conn:
        conn.execute("UPDATE photographers SET status=? WHERE id=?", (status, pid))
    return {"id": pid, "status": status}


# ---------------- API: payment + request ----------------
class CheckoutIn(BaseModel):
    plan: str


@app.post("/api/checkout")
def checkout(c: CheckoutIn):
    plan = PLANS.get(c.plan)
    if not plan:
        raise HTTPException(400, "invalid plan")
    result = create_payment(
        amount=plan["price"],
        plan=plan["label"],
        success_url="/customer?paid=1",
        cancel_url="/customer",
    )
    with db() as conn:
        conn.execute(
            "INSERT INTO payments (amount, status, stripe_id) VALUES (?, ?, ?)",
            (plan["price"], result["status"], result["stripe_id"]),
        )
    return result


class RequestIn(BaseModel):
    customer_name: str
    plan: str
    location: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    payment_id: Optional[str] = None


@app.post("/api/requests")
async def create_request(r: RequestIn):
    plan = PLANS.get(r.plan)
    if not plan:
        raise HTTPException(400, "invalid plan")
    with db() as conn:
        cur = conn.execute(
            """INSERT INTO requests (customer_name, plan, price, location, lat, lng, status)
               VALUES (?, ?, ?, ?, ?, ?, 'waiting')""",
            (r.customer_name, r.plan, plan["price"], r.location, r.lat, r.lng),
        )
        rid = cur.lastrowid

    # No broadcast: the customer now picks a photographer from the nearby list.
    await manager.broadcast_to_operators({"type": "stats_changed"})
    return {"id": rid, "status": "waiting"}


@app.get("/api/requests/{rid}")
def get_request(rid: int):
    with db() as conn:
        row = conn.execute(
            """SELECT r.*, p.name AS photographer_name, p.phone AS photographer_phone
               FROM requests r LEFT JOIN photographers p ON r.photographer_id = p.id
               WHERE r.id=?""",
            (rid,),
        ).fetchone()
    if not row:
        raise HTTPException(404, "not found")
    data = dict(row)
    # attach gallery token if a session exists
    with db() as conn:
        s = conn.execute(
            "SELECT gallery_token, id AS session_id, status AS session_status FROM sessions WHERE request_id=?",
            (rid,),
        ).fetchone()
    if s:
        data["gallery_token"] = s["gallery_token"]
        data["session_id"] = s["session_id"]
        data["session_status"] = s["session_status"]
    return data


class AcceptIn(BaseModel):
    photographer_id: int


@app.post("/api/requests/{rid}/accept")
async def accept_request(rid: int, a: AcceptIn):
    # Optimistic lock: only succeed if still waiting.
    with db() as conn:
        cur = conn.execute(
            "UPDATE requests SET status='matched', photographer_id=?, matched_at=datetime('now') "
            "WHERE id=? AND status='waiting'",
            (a.photographer_id, rid),
        )
        if cur.rowcount == 0:
            raise HTTPException(409, "already matched")
        conn.execute("UPDATE photographers SET status='busy' WHERE id=?", (a.photographer_id,))
        # create session with gallery token
        token = uuid.uuid4().hex
        conn.execute(
            "INSERT INTO sessions (request_id, photographer_id, gallery_token, status) "
            "VALUES (?, ?, ?, 'shooting')",
            (rid, a.photographer_id, token),
        )
        prow = conn.execute("SELECT name, phone FROM photographers WHERE id=?", (a.photographer_id,)).fetchone()

    # notify customer
    await manager.send_to_customer(
        rid,
        {
            "type": "matched",
            "photographer": {"id": a.photographer_id, "name": prow["name"], "phone": prow["phone"]},
            "gallery_token": token,
        },
    )
    # tell other photographers it's gone
    await manager.broadcast_to_photographers({"type": "request_taken", "request_id": rid})
    await manager.broadcast_to_operators({"type": "stats_changed"})
    return {"status": "matched", "gallery_token": token}


class SelectIn(BaseModel):
    photographer_id: int


@app.post("/api/requests/{rid}/select")
async def select_photographer(rid: int, s: SelectIn):
    """Customer chooses a specific nearby photographer."""
    with db() as conn:
        req = conn.execute("SELECT * FROM requests WHERE id=?", (rid,)).fetchone()
        if not req:
            raise HTTPException(404, "request not found")
        ph = conn.execute("SELECT * FROM photographers WHERE id=?", (s.photographer_id,)).fetchone()
        if not ph:
            raise HTTPException(404, "photographer not found")
        cur = conn.execute(
            "UPDATE requests SET status='matched', photographer_id=?, matched_at=datetime('now') "
            "WHERE id=? AND status='waiting'",
            (s.photographer_id, rid),
        )
        if cur.rowcount == 0:
            raise HTTPException(409, "already matched")
        token = uuid.uuid4().hex
        conn.execute(
            "INSERT INTO sessions (request_id, photographer_id, gallery_token, status) "
            "VALUES (?, ?, ?, 'shooting')",
            (rid, s.photographer_id, token),
        )
        if not ph["is_demo"]:
            conn.execute("UPDATE photographers SET status='busy' WHERE id=?", (s.photographer_id,))

    plan = PLANS.get(req["plan"], {})
    # notify the chosen (real) photographer to start the session
    await manager.send_to_photographer(
        s.photographer_id,
        {
            "type": "assigned",
            "request_id": rid,
            "gallery_token": token,
            "customer": req["customer_name"],
            "plan": plan.get("label", req["plan"]),
            "price": req["price"],
            "location": req["location"],
        },
    )
    await manager.broadcast_to_operators({"type": "stats_changed"})

    # a demo photographer auto-delivers sample photos so the flow completes solo
    if ph["is_demo"]:
        asyncio.create_task(simulate_demo_shoot(token, rid))

    return {
        "status": "matched",
        "gallery_token": token,
        "photographer": photographer_view(ph),
    }


@app.post("/api/requests/{rid}/cancel")
async def cancel_match(rid: int):
    """Customer cancels a match (to re-select or abandon). Returns request to waiting."""
    with db() as conn:
        req = conn.execute("SELECT * FROM requests WHERE id=?", (rid,)).fetchone()
        if not req:
            raise HTTPException(404, "request not found")
        if req["status"] == "done":
            raise HTTPException(409, "already completed")
        sess = conn.execute(
            "SELECT * FROM sessions WHERE request_id=? AND status='shooting'", (rid,)
        ).fetchone()
        pid = sess["photographer_id"] if sess else None
        if sess:
            conn.execute("UPDATE sessions SET status='cancelled' WHERE id=?", (sess["id"],))
            conn.execute("UPDATE photographers SET status='online' WHERE id=? AND is_demo=0", (pid,))
        conn.execute(
            "UPDATE requests SET status='waiting', photographer_id=NULL, matched_at=NULL WHERE id=?",
            (rid,),
        )
    if pid:
        await manager.send_to_photographer(pid, {"type": "cancelled", "request_id": rid})
    await manager.broadcast_to_operators({"type": "stats_changed"})
    return {"status": "waiting"}


# ---------------- API: photo upload ----------------
@app.post("/api/sessions/{token}/photos")
async def upload_photos(token: str, files: list[UploadFile] = File(...)):
    with db() as conn:
        s = conn.execute("SELECT id, request_id FROM sessions WHERE gallery_token=?", (token,)).fetchone()
    if not s:
        raise HTTPException(404, "session not found")
    session_id = s["id"]
    sess_dir = os.path.join(UPLOAD_DIR, token)
    os.makedirs(sess_dir, exist_ok=True)

    saved = []
    for f in files:
        ext = os.path.splitext(f.filename or "")[1] or ".jpg"
        fname = f"{uuid.uuid4().hex}{ext}"
        dest = os.path.join(sess_dir, fname)
        with open(dest, "wb") as out:
            out.write(await f.read())
        with db() as conn:
            conn.execute("INSERT INTO photos (session_id, filename) VALUES (?, ?)", (session_id, fname))
        saved.append(fname)

    await manager.send_to_customer(
        s["request_id"], {"type": "photos_uploaded", "count": len(saved), "gallery_token": token}
    )
    return {"uploaded": len(saved), "files": saved}


@app.post("/api/sessions/{token}/complete")
async def complete_session(token: str):
    with db() as conn:
        s = conn.execute("SELECT id, request_id, photographer_id FROM sessions WHERE gallery_token=?", (token,)).fetchone()
        if not s:
            raise HTTPException(404, "session not found")
        conn.execute("UPDATE sessions SET status='done', completed_at=datetime('now') WHERE id=?", (s["id"],))
        conn.execute("UPDATE requests SET status='done' WHERE id=?", (s["request_id"],))
        conn.execute("UPDATE photographers SET status='online' WHERE id=?", (s["photographer_id"],))
    await manager.send_to_customer(s["request_id"], {"type": "session_complete", "gallery_token": token})
    await manager.broadcast_to_operators({"type": "stats_changed"})
    return {"status": "done"}


@app.get("/api/gallery/{token}")
def gallery_data(token: str):
    with db() as conn:
        s = conn.execute(
            """SELECT s.*, r.customer_name, r.plan FROM sessions s
               JOIN requests r ON s.request_id = r.id WHERE s.gallery_token=?""",
            (token,),
        ).fetchone()
        if not s:
            raise HTTPException(404, "not found")
        photos = conn.execute(
            "SELECT filename FROM photos WHERE session_id=? ORDER BY id", (s["id"],)
        ).fetchall()
    return {
        "customer_name": s["customer_name"],
        "plan": s["plan"],
        "status": s["status"],
        "photos": [f"/uploads/{token}/{p['filename']}" for p in photos],
    }


# ---------------- API: operator stats ----------------
@app.get("/api/stats")
def stats():
    with db() as conn:
        online = conn.execute("SELECT COUNT(*) c FROM photographers WHERE status='online'").fetchone()["c"]
        busy = conn.execute("SELECT COUNT(*) c FROM photographers WHERE status='busy'").fetchone()["c"]
        waiting = conn.execute("SELECT COUNT(*) c FROM requests WHERE status='waiting'").fetchone()["c"]
        matched = conn.execute("SELECT COUNT(*) c FROM requests WHERE status IN ('matched','shooting')").fetchone()["c"]
        done = conn.execute("SELECT COUNT(*) c FROM requests WHERE status='done'").fetchone()["c"]
        total = conn.execute("SELECT COUNT(*) c FROM requests").fetchone()["c"]
        recent = conn.execute(
            """SELECT r.id, r.customer_name, r.plan, r.status, r.location, r.created_at,
                      p.name AS photographer_name
               FROM requests r LEFT JOIN photographers p ON r.photographer_id=p.id
               ORDER BY r.id DESC LIMIT 20"""
        ).fetchall()
    match_rate = round((total - waiting) / total * 100) if total else 0
    return {
        "online": online,
        "busy": busy,
        "waiting": waiting,
        "matched": matched,
        "done": done,
        "total": total,
        "match_rate": match_rate,
        "recent": [dict(r) for r in recent],
    }


# ---------------- WebSockets ----------------
@app.websocket("/ws/photographer/{pid}")
async def ws_photographer(ws: WebSocket, pid: int):
    await manager.connect_photographer(pid, ws)
    with db() as conn:
        conn.execute("UPDATE photographers SET status='online' WHERE id=? AND status!='busy'", (pid,))
    await manager.broadcast_to_operators({"type": "stats_changed"})
    try:
        while True:
            await ws.receive_text()  # keepalive / ignore
    except WebSocketDisconnect:
        manager.disconnect_photographer(pid, ws)
        if pid not in manager.photographers:
            with db() as conn:
                conn.execute("UPDATE photographers SET status='offline' WHERE id=? AND status!='busy'", (pid,))
            await manager.broadcast_to_operators({"type": "stats_changed"})


@app.websocket("/ws/customer/{rid}")
async def ws_customer(ws: WebSocket, rid: int):
    await manager.connect_customer(rid, ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        manager.disconnect_customer(rid, ws)


@app.websocket("/ws/operator")
async def ws_operator(ws: WebSocket):
    await manager.connect_operator(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        manager.disconnect_operator(ws)


# ---------------- static mounts ----------------
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
