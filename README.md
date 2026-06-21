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

## 決済（Stripe）を有効化する

キー未設定なら **stubモード**（決済は自動成功）。キーを入れると本物の **Stripe Checkout** に切り替わります。

### 流れ
`プラン → 確認 → /api/orders（requestを pending_payment で作成）→ Stripe Checkoutへ遷移 → 支払い → /customer?session_id=... に戻る → /api/payments/verify で支払い確認 → request を waiting に → カメラマン選択へ`

### テスト決済を通す手順
1. https://stripe.com でアカウント作成 → ダッシュボード右上が **「テスト環境」** の状態で **APIキー（`sk_test_...`）** をコピー
2. Render → 対象サービス → **Environment** → 追加：
   - `STRIPE_SECRET_KEY` = `sk_test_...`
   - `APP_BASE_URL` = 公開URL（例 `https://uberphoto.onrender.com`）※render.yamlに既定値あり
   保存すると自動再デプロイ
3. 公開サイトで プラン選択 → 確認 → 「決済して依頼」 → **Stripeの決済画面**へ
4. テストカード **`4242 4242 4242 4242`**／有効期限=未来の任意月／CVC=任意3桁／郵便番号=任意 で支払い
5. 自動でサイトに戻り、支払い確認後にカメラマン選択へ進めばOK

### 本番（実際に課金）にするには
- Stripeアカウントの**本人確認/有効化**を完了 → 本番キー `sk_live_...` に差し替え
- **特定商取引法に基づく表記**・利用規約・キャンセル/返金ポリシーを掲載
- カメラマンへの自動送金が必要なら **Stripe Connect**（集金→手数料控除→送金）を実装

## 本番化の次ステップ
- `STRIPE_SECRET_KEY` を設定して実決済へ
- 写真ストレージを S3 / Cloudflare R2、DBを Postgres へ
- 本人確認・作例審査・写真権利規約（レビューは現在ダミー）
- 撮影リクエストの再依頼・通知の永続化
