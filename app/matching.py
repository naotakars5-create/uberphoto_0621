"""WebSocket connection management and realtime matching for UberPHOTO."""
import json
from typing import Dict, List
from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        # photographer_id -> list of websockets (one photographer may have multiple tabs)
        self.photographers: Dict[int, List[WebSocket]] = {}
        # request_id -> list of websockets (customer waiting screens)
        self.customers: Dict[int, List[WebSocket]] = {}
        # operator dashboards
        self.operators: List[WebSocket] = []

    # ---- register / unregister ----
    async def connect_photographer(self, pid: int, ws: WebSocket):
        await ws.accept()
        self.photographers.setdefault(pid, []).append(ws)

    async def connect_customer(self, rid: int, ws: WebSocket):
        await ws.accept()
        self.customers.setdefault(rid, []).append(ws)

    async def connect_operator(self, ws: WebSocket):
        await ws.accept()
        self.operators.append(ws)

    def disconnect_photographer(self, pid: int, ws: WebSocket):
        if pid in self.photographers and ws in self.photographers[pid]:
            self.photographers[pid].remove(ws)
            if not self.photographers[pid]:
                del self.photographers[pid]

    def disconnect_customer(self, rid: int, ws: WebSocket):
        if rid in self.customers and ws in self.customers[rid]:
            self.customers[rid].remove(ws)
            if not self.customers[rid]:
                del self.customers[rid]

    def disconnect_operator(self, ws: WebSocket):
        if ws in self.operators:
            self.operators.remove(ws)

    # ---- send helpers ----
    async def _safe_send(self, ws: WebSocket, payload: dict):
        try:
            await ws.send_text(json.dumps(payload, ensure_ascii=False))
        except Exception:
            pass

    async def broadcast_to_photographers(self, payload: dict):
        for ws_list in list(self.photographers.values()):
            for ws in list(ws_list):
                await self._safe_send(ws, payload)

    async def send_to_photographer(self, pid: int, payload: dict):
        for ws in list(self.photographers.get(pid, [])):
            await self._safe_send(ws, payload)

    async def send_to_customer(self, rid: int, payload: dict):
        for ws in list(self.customers.get(rid, [])):
            await self._safe_send(ws, payload)

    async def broadcast_to_operators(self, payload: dict):
        for ws in list(self.operators):
            await self._safe_send(ws, payload)


manager = ConnectionManager()
