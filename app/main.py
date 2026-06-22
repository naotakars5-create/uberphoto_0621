"""UberPHOTO MVP - FastAPI application."""
import os
import uuid
import json
import asyncio
import shutil
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, Form, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from .db import db, init_db
from .matching import manager
from .payments import create_checkout, retrieve_session, stripe_enabled

APP_BASE_URL = os.environ.get("APP_BASE_URL")  # e.g. https://uberphoto.onrender.com

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATIC_DIR = os.path.join(BASE_DIR, "static")
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
PROFILE_DIR = os.path.join(UPLOAD_DIR, "profile")
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(PROFILE_DIR, exist_ok=True)


async def _save_profile_image(pid: int, file: UploadFile) -> str:
    """Save an uploaded profile/portfolio image and return its public URL."""
    d = os.path.join(PROFILE_DIR, str(pid))
    os.makedirs(d, exist_ok=True)
    ext = os.path.splitext(file.filename or "")[1].lower() or ".jpg"
    if ext not in (".jpg", ".jpeg", ".png", ".webp", ".gif"):
        ext = ".jpg"
    fname = f"{uuid.uuid4().hex}{ext}"
    with open(os.path.join(d, fname), "wb") as out:
        out.write(await file.read())
    return f"/uploads/profile/{pid}/{fname}"

PLANS = {
    "light": {"label": "ライト 15枚", "shots": 15, "minutes": 30, "price": 3278},      # 2,980 税別
    "standard": {"label": "スタンダード 30枚", "shots": 30, "minutes": 30, "price": 4378},  # 3,980 税別
    "premium": {"label": "プレミアム 50枚", "shots": 50, "minutes": 60, "price": 6600},   # 6,000 税別
}

app = FastAPI(title="UberPHOTO")

import math

# Asakusa as the trial area centre.
ASAKUSA = (35.7148, 139.7967)

# Shooting areas the customer can choose from: a prefecture/region with its
# iconic tourist spots. Each spot carries an approximate lat/lng (drives the
# mini-map layout + distance estimate) and a "best light" hint.
AREAS = [
    {
        "id": "tokyo", "name": "東京", "name_en": "Tokyo", "emoji": "🗼",
        "spots": [
            {"name": "雷門（浅草）", "hint": "午前は順光で顔が明るく写ります", "lat": 35.7108, "lng": 139.7967},
            {"name": "仲見世通り", "hint": "夕方は提灯に灯りが入って雰囲気◎", "lat": 35.7118, "lng": 139.7960},
            {"name": "浅草寺 本堂", "hint": "朝いちばんは人が少なく撮りやすい", "lat": 35.7148, "lng": 139.7967},
            {"name": "東京スカイツリー前", "hint": "日没前後のマジックアワーが絶景", "lat": 35.7101, "lng": 139.8107},
            {"name": "渋谷スクランブル交差点", "hint": "夜のネオンで都会的な一枚", "lat": 35.6595, "lng": 139.7005},
            {"name": "東京タワー", "hint": "日没後のライトアップが映えます", "lat": 35.6586, "lng": 139.7454},
            {"name": "明治神宮", "hint": "木漏れ日の参道がやわらかい光", "lat": 35.6764, "lng": 139.6993},
            {"name": "上野公園", "hint": "桜・新緑シーズンは午前がおすすめ", "lat": 35.7156, "lng": 139.7745},
            {"name": "お台場 海浜公園", "hint": "夕暮れのレインボーブリッジと", "lat": 35.6306, "lng": 139.7758},
            {"name": "東京駅 丸の内", "hint": "夜のライトアップで荘厳に", "lat": 35.6812, "lng": 139.7671},
        ],
    },
    {
        "id": "kyoto", "name": "京都", "name_en": "Kyoto", "emoji": "⛩️",
        "spots": [
            {"name": "清水寺", "hint": "朝いちは人が少なく舞台を独り占め", "lat": 34.9949, "lng": 135.7850},
            {"name": "伏見稲荷大社 千本鳥居", "hint": "早朝は鳥居が空くので狙い目", "lat": 34.9671, "lng": 135.7727},
            {"name": "嵐山 竹林の小径", "hint": "午前の斜光が竹に差し込んで幻想的", "lat": 35.0094, "lng": 135.6722},
            {"name": "金閣寺", "hint": "晴れた午前、池の反射と一緒に", "lat": 35.0394, "lng": 135.7292},
            {"name": "祇園 花見小路", "hint": "夕暮れの石畳が風情たっぷり", "lat": 35.0036, "lng": 135.7752},
            {"name": "八坂の塔", "hint": "夕方〜ブルーアワーがいちばん映える", "lat": 34.9985, "lng": 135.7820},
        ],
    },
    {
        "id": "osaka", "name": "大阪", "name_en": "Osaka", "emoji": "🐙",
        "spots": [
            {"name": "大阪城", "hint": "晴れた午前、天守と青空を背景に", "lat": 34.6873, "lng": 135.5259},
            {"name": "道頓堀 グリコサイン", "hint": "夜のネオンで大阪らしい一枚", "lat": 34.6687, "lng": 135.5013},
            {"name": "通天閣", "hint": "夕暮れ〜夜のライトアップが◎", "lat": 34.6525, "lng": 135.5063},
            {"name": "海遊館", "hint": "夕方の海辺の光がやわらかい", "lat": 34.6545, "lng": 135.4289},
        ],
    },
    {
        "id": "kanagawa", "name": "神奈川", "name_en": "Kanagawa", "emoji": "🌊",
        "spots": [
            {"name": "鎌倉 高徳院（大仏）", "hint": "午前のやわらかい光がおすすめ", "lat": 35.3169, "lng": 139.5358},
            {"name": "江ノ島", "hint": "夕暮れのサンセットが絶景", "lat": 35.2996, "lng": 139.4807},
            {"name": "横浜赤レンガ倉庫", "hint": "夜のライトアップでロマンチックに", "lat": 35.4530, "lng": 139.6428},
            {"name": "みなとみらい", "hint": "ブルーアワーの夜景がいちばん映える", "lat": 35.4570, "lng": 139.6380},
        ],
    },
    {
        "id": "nara", "name": "奈良", "name_en": "Nara", "emoji": "🦌",
        "spots": [
            {"name": "東大寺 大仏殿", "hint": "午前は順光で建物がくっきり", "lat": 34.6890, "lng": 135.8398},
            {"name": "奈良公園（鹿）", "hint": "朝夕は鹿がのんびりで撮りやすい", "lat": 34.6851, "lng": 135.8430},
            {"name": "春日大社", "hint": "木漏れ日と灯籠がやわらかい光", "lat": 34.6818, "lng": 135.8483},
        ],
    },
    {
        "id": "hokkaido", "name": "北海道", "name_en": "Hokkaido", "emoji": "❄️",
        "spots": [
            {"name": "小樽運河", "hint": "夕暮れ〜夜のガス灯が幻想的", "lat": 43.1986, "lng": 140.9947},
            {"name": "函館山 夜景", "hint": "日没後のブルーアワーが絶景", "lat": 41.7596, "lng": 140.7045},
            {"name": "札幌 大通公園", "hint": "晴れた日中、テレビ塔を背景に", "lat": 43.0556, "lng": 141.3460},
        ],
    },
    {
        "id": "okinawa", "name": "沖縄", "name_en": "Okinawa", "emoji": "🌺",
        "spots": [
            {"name": "美ら海水族館", "hint": "午後の海辺の光がきれい", "lat": 26.6943, "lng": 127.8779},
            {"name": "首里城", "hint": "午前は順光で朱色が鮮やか", "lat": 26.2170, "lng": 127.7196},
            {"name": "国際通り", "hint": "夕暮れのにぎわいを背景に", "lat": 26.2146, "lng": 127.6792},
        ],
    },
]
AREA_BY_ID = {a["id"]: a for a in AREAS}

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


def real_reviews(pid: int, limit: int = 8):
    """Reviews actually left by customers, newest first."""
    with db() as conn:
        rows = conn.execute(
            "SELECT author, rating, text, created_at FROM reviews "
            "WHERE photographer_id=? AND text IS NOT NULL AND text != '' "
            "ORDER BY id DESC LIMIT ?",
            (pid, limit),
        ).fetchall()
    return [
        {"author": r["author"] or "ゲスト", "rating": r["rating"], "text": r["text"], "ago": "最近", "verified": True}
        for r in rows
    ]


def merged_reviews(pid: int):
    """Real customer reviews first, padded with samples so a profile never looks empty."""
    real = real_reviews(pid)
    if len(real) >= 3:
        return real
    return real + synth_reviews(pid, 3 - len(real))


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


def parse_portfolio(row):
    try:
        return json.loads(row["portfolio"]) if row["portfolio"] else []
    except (ValueError, TypeError):
        return []


def photographer_view(row, origin=None):
    pid = row["id"]
    # portfolio: the photographer's own uploads if any, else 6 rotated samples
    own = parse_portfolio(row)
    portfolio = own if own else [WORK_THUMBS[(pid + i) % len(WORK_THUMBS)] for i in range(6)]
    # distance: real haversine for real photographers if we know both ends;
    # demo photographers always appear "nearby" so the demo flow works in any
    # chosen area (their fixed seed location is in Asakusa only).
    if origin and not row["is_demo"] and row["lat"] is not None and row["lng"] is not None:
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
        "bio": (row["bio"] or "").strip() or photographer_bio(row),
        "reviews": merged_reviews(pid),
        "distance_km": dist,
        "eta_min": eta,
        "area": row["area"] or "",
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


# ---------------- API: shooting areas ----------------
@app.get("/api/areas")
def get_areas():
    return AREAS


# ---------------- API: photographer ----------------
class PhotographerIn(BaseModel):
    name: str
    phone: Optional[str] = None
    area: Optional[str] = None


@app.post("/api/photographers")
def register_photographer(p: PhotographerIn):
    with db() as conn:
        cur = conn.execute(
            "INSERT INTO photographers (name, phone, area, status) VALUES (?, ?, ?, 'offline')",
            (p.name, p.phone, (p.area or "").strip() or None),
        )
        pid = cur.lastrowid
        rating, shots, specialty, thumb = synth_profile(pid)
        conn.execute(
            "UPDATE photographers SET rating=?, shots=?, specialty=?, thumb=? WHERE id=?",
            (rating, shots, specialty, thumb, pid),
        )
        return {"id": pid, "name": p.name}


@app.get("/api/photographers/nearby")
def nearby_photographers(
    lat: Optional[float] = None, lng: Optional[float] = None, area: Optional[str] = None
):
    """Up to 3 nearby online photographers. Photographers whose declared service
    area matches the customer's chosen area are surfaced first, then by real
    distance. Demo photographers act as fallback supply and match any area."""
    origin = (lat, lng) if lat is not None and lng is not None else None
    area = (area or "").strip()
    with db() as conn:
        rows = conn.execute("SELECT * FROM photographers WHERE status='online'").fetchall()
    views = []
    for r in rows:
        v = photographer_view(r, origin)
        # a demo shows the customer's area (it's fallback supply available anywhere)
        if v["is_demo"] and area:
            v["area"] = area
        v["area_match"] = bool(area) and (v["is_demo"] or v["area"] == area)
        views.append(v)
    # area match first, then closest; demos rank after real photographers at a tie
    views.sort(key=lambda v: (not v["area_match"], v["is_demo"], v["distance_km"]))
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


# ---------------- API: photographer profile ----------------
@app.get("/api/photographers/{pid}")
def get_photographer(pid: int):
    """The photographer's own editable profile + stats + received reviews."""
    with db() as conn:
        row = conn.execute("SELECT * FROM photographers WHERE id=?", (pid,)).fetchone()
        if not row:
            raise HTTPException(404, "photographer not found")
        rc = conn.execute("SELECT COUNT(*) c FROM reviews WHERE photographer_id=?", (pid,)).fetchone()["c"]
    return {
        "id": pid,
        "name": row["name"],
        "phone": row["phone"],
        "bio": row["bio"] or "",
        "area": row["area"] or "",
        "specialty": row["specialty"] or "",
        "tags": [t for t in (row["specialty"] or "").split(",") if t],
        "thumb": row["thumb"],
        "portfolio": parse_portfolio(row),
        "rating": row["rating"],
        "shots": row["shots"],
        "review_count": rc,
        "reviews": real_reviews(pid, 20),
    }


class ProfileIn(BaseModel):
    name: Optional[str] = None
    bio: Optional[str] = None
    area: Optional[str] = None              # service area (prefecture/region name)
    specialty: Optional[str] = None        # comma-joined tags
    portfolio: Optional[list[str]] = None  # full list (enables remove/reorder)


@app.post("/api/photographers/{pid}/profile")
def update_profile(pid: int, p: ProfileIn):
    sets, vals = [], []
    if p.name is not None and p.name.strip():
        sets.append("name=?"); vals.append(p.name.strip())
    if p.bio is not None:
        sets.append("bio=?"); vals.append(p.bio.strip())
    if p.area is not None:
        sets.append("area=?"); vals.append(p.area.strip())
    if p.specialty is not None:
        sets.append("specialty=?"); vals.append(p.specialty.strip())
    if p.portfolio is not None:
        sets.append("portfolio=?"); vals.append(json.dumps(p.portfolio, ensure_ascii=False))
    if not sets:
        return {"ok": True}
    vals.append(pid)
    with db() as conn:
        cur = conn.execute(f"UPDATE photographers SET {', '.join(sets)} WHERE id=?", vals)
        if cur.rowcount == 0:
            raise HTTPException(404, "photographer not found")
    return {"ok": True}


@app.post("/api/photographers/{pid}/avatar")
async def upload_avatar(pid: int, file: UploadFile = File(...)):
    url = await _save_profile_image(pid, file)
    with db() as conn:
        conn.execute("UPDATE photographers SET thumb=? WHERE id=?", (url, pid))
    return {"thumb": url}


@app.post("/api/photographers/{pid}/portfolio")
async def upload_portfolio(pid: int, files: list[UploadFile] = File(...)):
    urls = [await _save_profile_image(pid, f) for f in files]
    with db() as conn:
        row = conn.execute("SELECT portfolio FROM photographers WHERE id=?", (pid,)).fetchone()
        if not row:
            raise HTTPException(404, "photographer not found")
        cur = parse_portfolio(row)
        cur.extend(urls)
        conn.execute("UPDATE photographers SET portfolio=? WHERE id=?", (json.dumps(cur, ensure_ascii=False), pid))
    return {"portfolio": cur, "added": urls}


# ---------------- API: order + payment ----------------
class OrderIn(BaseModel):
    plan: str
    customer_name: str
    location: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    people: Optional[str] = None   # e.g. "2人"
    scene: Optional[str] = None    # e.g. "カップル,記念"
    note: Optional[str] = None     # free-text request to the photographer


@app.post("/api/orders")
async def create_order(o: OrderIn, request: Request):
    """Create a request and start payment.

    - Stripe mode: request is 'pending_payment'; returns a Checkout URL. The
      request becomes 'waiting' only after /api/payments/verify confirms payment.
    - Stub mode (no key): payment auto-succeeds and the request is 'waiting'.
    """
    plan = PLANS.get(o.plan)
    if not plan:
        raise HTTPException(400, "invalid plan")
    with db() as conn:
        cur = conn.execute(
            """INSERT INTO requests (customer_name, plan, price, location, lat, lng, people, scene, note, status)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_payment')""",
            (o.customer_name, o.plan, plan["price"], o.location, o.lat, o.lng, o.people, o.scene, o.note),
        )
        rid = cur.lastrowid

    base_url = (APP_BASE_URL or str(request.base_url)).rstrip("/")
    pay = create_checkout(plan["price"], plan["label"], base_url, rid)

    with db() as conn:
        conn.execute(
            "INSERT INTO payments (request_id, amount, status, stripe_id) VALUES (?, ?, ?, ?)",
            (rid, plan["price"], "pending" if pay["mode"] == "stripe" else "paid", pay.get("stripe_id")),
        )

    if pay["mode"] == "stripe":
        return {"mode": "stripe", "request_id": rid, "checkout_url": pay["checkout_url"]}

    # stub: treat as paid immediately
    with db() as conn:
        conn.execute("UPDATE requests SET status='waiting' WHERE id=?", (rid,))
    await manager.broadcast_to_operators({"type": "stats_changed"})
    return {"mode": "stub", "request_id": rid, "status": "waiting"}


class VerifyIn(BaseModel):
    session_id: str


@app.post("/api/payments/verify")
async def verify_payment(v: VerifyIn):
    """Confirm a Stripe Checkout payment, then release the request to matching."""
    if not stripe_enabled():
        raise HTTPException(400, "stripe not configured")
    try:
        sess = retrieve_session(v.session_id)
    except Exception as e:
        raise HTTPException(400, f"invalid session: {e}")
    meta = sess.get("metadata") or {}
    rid = int(meta["request_id"]) if meta.get("request_id") else None
    paid = sess.get("payment_status") == "paid"
    if rid and paid:
        with db() as conn:
            conn.execute("UPDATE requests SET status='waiting' WHERE id=? AND status='pending_payment'", (rid,))
            conn.execute("UPDATE payments SET status='paid' WHERE request_id=?", (rid,))
        await manager.broadcast_to_operators({"type": "stats_changed"})
    return {"paid": paid, "request_id": rid}


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
            "people": req["people"],
            "scene": req["scene"],
            "note": req["note"],
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


# ---------------- API: customer review ----------------
class ReviewIn(BaseModel):
    rating: int
    text: Optional[str] = None


@app.post("/api/requests/{rid}/review")
def submit_review(rid: int, r: ReviewIn):
    """Customer rates the photographer after a completed shoot."""
    rating = max(1, min(5, int(r.rating)))
    with db() as conn:
        req = conn.execute(
            "SELECT customer_name, photographer_id, reviewed FROM requests WHERE id=?", (rid,)
        ).fetchone()
        if not req:
            raise HTTPException(404, "request not found")
        if not req["photographer_id"]:
            raise HTTPException(400, "no photographer to review")
        if req["reviewed"]:
            raise HTTPException(409, "already reviewed")
        conn.execute(
            "INSERT INTO reviews (photographer_id, request_id, author, rating, text) VALUES (?, ?, ?, ?, ?)",
            (req["photographer_id"], rid, req["customer_name"], rating, (r.text or "").strip() or None),
        )
        conn.execute("UPDATE requests SET reviewed=1 WHERE id=?", (rid,))
        # keep the photographer's headline rating fresh: blend prior rating with new one
        ph = conn.execute("SELECT rating, shots FROM photographers WHERE id=?", (req["photographer_id"],)).fetchone()
        if ph and ph["rating"] is not None:
            prior, n = ph["rating"], max(20, ph["shots"] or 20)
            blended = round((prior * n + rating) / (n + 1), 2)
            conn.execute("UPDATE photographers SET rating=? WHERE id=?", (blended, req["photographer_id"]))
    return {"ok": True}


# ---------------- API: tip ----------------
class TipIn(BaseModel):
    amount: int


@app.post("/api/requests/{rid}/tip")
async def add_tip(rid: int, t: TipIn):
    """Customer adds an optional gratuity after a completed shoot. Accumulates
    if tipped more than once. Notifies the photographer in realtime."""
    amount = max(0, min(50000, int(t.amount)))
    if amount <= 0:
        raise HTTPException(400, "invalid tip")
    with db() as conn:
        req = conn.execute("SELECT photographer_id, tip FROM requests WHERE id=?", (rid,)).fetchone()
        if not req:
            raise HTTPException(404, "request not found")
        total = (req["tip"] or 0) + amount
        conn.execute("UPDATE requests SET tip=? WHERE id=?", (total, rid))
        pid = req["photographer_id"]
    if pid:
        await manager.send_to_photographer(pid, {"type": "tip", "request_id": rid, "amount": amount})
    await manager.broadcast_to_operators({"type": "stats_changed"})
    return {"ok": True, "tip": total}


# ---------------- API: chat (customer ⇄ photographer) ----------------
DEMO_REPLY = "まもなく到着します！目印になる服装や立っている場所を教えていただけると、すぐ見つけられます😊"


async def _demo_auto_reply(rid: int):
    """A demo photographer can't type, so send one friendly reply the first time
    the customer messages — keeps the solo demo flow feeling alive."""
    await asyncio.sleep(2.2)
    with db() as conn:
        already = conn.execute(
            "SELECT COUNT(*) c FROM messages WHERE request_id=? AND sender='photographer'", (rid,)
        ).fetchone()["c"]
        if already:
            return
        conn.execute(
            "INSERT INTO messages (request_id, sender, text) VALUES (?, 'photographer', ?)", (rid, DEMO_REPLY)
        )
    await manager.send_to_customer(rid, {"type": "message", "sender": "photographer", "text": DEMO_REPLY})


class MessageIn(BaseModel):
    sender: str   # 'customer' | 'photographer'
    text: str


@app.get("/api/requests/{rid}/messages")
def list_messages(rid: int):
    with db() as conn:
        rows = conn.execute(
            "SELECT sender, text, created_at FROM messages WHERE request_id=? ORDER BY id", (rid,)
        ).fetchall()
    return [{"sender": r["sender"], "text": r["text"], "created_at": r["created_at"]} for r in rows]


@app.post("/api/requests/{rid}/messages")
async def post_message(rid: int, m: MessageIn):
    text = (m.text or "").strip()[:1000]
    if not text:
        raise HTTPException(400, "empty message")
    sender = "photographer" if m.sender == "photographer" else "customer"
    with db() as conn:
        req = conn.execute("SELECT photographer_id FROM requests WHERE id=?", (rid,)).fetchone()
        if not req:
            raise HTTPException(404, "request not found")
        pid = req["photographer_id"]
        conn.execute("INSERT INTO messages (request_id, sender, text) VALUES (?, ?, ?)", (rid, sender, text))
        is_demo = False
        if pid:
            d = conn.execute("SELECT is_demo FROM photographers WHERE id=?", (pid,)).fetchone()
            is_demo = bool(d and d["is_demo"])
    if sender == "customer":
        if pid:
            await manager.send_to_photographer(pid, {"type": "message", "sender": sender, "text": text, "request_id": rid})
        if is_demo:
            asyncio.create_task(_demo_auto_reply(rid))
    else:
        await manager.send_to_customer(rid, {"type": "message", "sender": sender, "text": text})
    return {"ok": True}


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
def _area_of(location: Optional[str]) -> str:
    """Derive an area name from a free-text shoot location like '京都・清水寺'."""
    if not location:
        return "未指定"
    head = location.split("・")[0].replace("エリア", "").strip()
    return head or "未指定"


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
        # live demand per area (active = waiting/matched/shooting)
        active_rows = conn.execute(
            "SELECT location, status FROM requests WHERE status IN ('waiting','matched','shooting')"
        ).fetchall()
    match_rate = round((total - waiting) / total * 100) if total else 0
    # aggregate live demand by area (active = waiting/matched/shooting)
    agg: dict[str, dict] = {}
    for r in active_rows:
        a = agg.setdefault(_area_of(r["location"]), {"active": 0, "waiting": 0})
        a["active"] += 1
        if r["status"] == "waiting":
            a["waiting"] += 1
    by_area = [{"name": k, "active": v["active"], "waiting": v["waiting"]}
               for k, v in sorted(agg.items(), key=lambda kv: (-kv[1]["active"], kv[0]))]
    return {
        "online": online,
        "busy": busy,
        "waiting": waiting,
        "matched": matched,
        "done": done,
        "total": total,
        "match_rate": match_rate,
        "by_area": by_area,
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
