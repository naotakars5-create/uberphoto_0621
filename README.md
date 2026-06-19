# UberPHOTO — 実運用MVP（PWA）

観光客とカメラマンを「その場・リアルタイム」で繋ぐ写真撮影マッチングサービス。
Node 不要・Python だけで動きます。

## 構成
- **FastAPI + WebSocket** … リアルタイムマッチング
- **SQLite** … データ保存（`uberphoto.db` が自動生成）
- **素のHTML/CSS/JS + PWA** … 観光客 / カメラマン / オペレーター / ギャラリー
- 写真は `uploads/` にセッション毎に保存
- 決済は Stripe（`STRIPE_SECRET_KEY` 未設定時はスタブ決済で即成功）

## 起動

```bash
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

ブラウザで開く：
- ランディング: http://localhost:8000/
- 観光客: http://localhost:8000/customer
- カメラマン: http://localhost:8000/photographer
- オペレーター: http://localhost:8000/operator

## 動作確認（一気通貫）
1. タブB `/customer` でプラン選択 → 名前入力 → 「決済して撮影を依頼」（スタブ即成功）
2. 近くのカメラマンから選ぶ（**おまかせ・最短**／指名／カードをタップでプロフィール＆作例＆レビュー）
3. 「向かっています」地図＋ETA画面 →（デモカメラマンは数秒で写真が自動到着）
4. 「写真を見る」 → ギャラリーで閲覧・かんたん編集・全保存
5. 本物のカメラマン役は別タブ `/photographer` で待機オン → 選ばれると撮影画面へ → 写真アップロード → 完了
6. `/operator` で件数・状態がリアルタイム更新

## クラウドへデプロイ（固定URL）

このリポジトリはそのまま **Render** にデプロイできます（無料枠あり）。

### 手順
1. このフォルダを GitHub にプッシュ（下記「Git 準備」参照）。
2. https://render.com にサインアップ（GitHub連携）。
3. **New + → Blueprint** を選び、リポジトリを指定 → `render.yaml` が読まれて自動設定。
   - もしくは **New + → Web Service** で手動設定：
     - Build Command: `pip install -r requirements.txt`
     - Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. デプロイ完了後、`https://uberphoto.onrender.com` のような**固定URL**が発行されます（HTTPS）。

### Git 準備（ローカル）
```bash
git init
git add .
git commit -m "UberPHOTO MVP"
git branch -M main
git remote add origin https://github.com/<you>/uberphoto.git
git push -u origin main
```

### 注意（無料枠の制約）
- 無料 Web サービスは**一定時間アクセスがないとスリープ**し、次回アクセス時に数十秒のコールドスタートあり。
- ファイルシステムは**揮発性**（再デプロイ/再起動で `uberphoto.db` と `uploads/` がリセット）。デモ用途は問題なし。
- 永続化するには Render の Persistent Disk（有料）か、DBをManaged Postgres、写真をS3/R2へ。

## 本番化の次ステップ
- `STRIPE_SECRET_KEY` を設定して実決済へ
- 写真ストレージを S3 / Cloudflare R2、DBを Postgres へ
- 本人確認・作例審査・写真権利規約（レビューは現在ダミー）
- 撮影リクエストの再依頼・通知の永続化
