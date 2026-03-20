# 施工管理 → iOSカレンダー自動同期 セットアップ手順

## 全体像

施工管理アプリ →[☁ Gist同期]→ GitHub Gist (JSON)
                                       ↓
iOSカレンダー照会 ←[/api/calendar.ics]← Vercel API Route


## 変更ファイル一覧

| ファイル | 操作 |
|------|------|
| `src/App.jsx` | 差し替え（Gist同期機能を追加済み） |
| `api/calendar.ics.js` | 新規追加 |


## STEP 1: Gistを作成（1回だけ）

1. https://gist.github.com にアクセス
2. ファイル名: `koji-schedules.json`
3. 内容: `{}`
4. 「Create secret gist」をクリック
5. URLの末尾 = Gist ID → メモする

例: https://gist.github.com/ユーザー名/abc123def456
→ Gist ID = `abc123def456`


## STEP 2: GitHubリポジトリを更新

### 2-A: src/App.jsx を差し替え
ダウンロードした `App.jsx` で既存のファイルを置き換え。

### 2-B: api/calendar.ics.js を追加
プロジェクトルートに `api/` フォルダを作成し、
`calendar.ics.js` を配置。

最終的なフォルダ構成:
```
koji-manager/
├── api/
│   └── calendar.ics.js    ← 新規
├── src/
│   ├── App.jsx             ← 差し替え
│   └── main.jsx
├── index.html
├── package.json
└── vite.config.js
```


## STEP 3: Vercel環境変数を設定

1. Vercel → プロジェクト → Settings → Environment Variables
2. 追加:
   - Key: `GIST_ID`
   - Value: STEP 1のGist ID
3. Save → Redeploy


## STEP 4: アプリでGist設定を入力

1. アプリを開く → ヘッダーの ⚙ をタップ
2. GitHub Token: aqua_device_diaryで使っているトークン（gist権限あり）
3. Gist ID: STEP 1のID
4. 「設定を保存」

※ トークンとGist IDはlocalStorageに保存されます


## STEP 5: 動作確認

### Gist同期の確認
1. 工程スケジュールを何件か登録
2. ヘッダーの「☁ 同期」ボタンをタップ
3. 「✓ 同期完了」になればOK
4. gist.github.com で koji-schedules.json にデータが入っているか確認

### .ics配信の確認
ブラウザで以下にアクセス:
```
https://あなたのアプリ.vercel.app/api/calendar.ics
```
→ .icsファイルがダウンロードされればOK


## STEP 6: iOSカレンダーに照会登録

1. iPhoneの「設定」
2. 「カレンダー」→「アカウント」→「アカウントを追加」
3. 「照会カレンダーを追加」
4. URL: `https://あなたのアプリ.vercel.app/api/calendar.ics`
5. 「次へ」→「保存」

これで完了！iOSが定期的に（15分〜数時間）URLを取得して
カレンダーを自動更新します。

追加・変更・削除すべて反映されます（.icsファイル全体が毎回差し替わるため）。


## 運用の流れ

1. アプリで工程スケジュールを追加/編集/削除
2. 「☁ 同期」ボタンをタップ（Gistに最新データが保存される）
3. iOSカレンダーが自動で最新データを取得

※ 同期ボタンを押し忘れるとカレンダーに反映されません
※ iOS側からの編集はできません（読み取り専用）


## トラブルシューティング

| 症状 | 対処 |
|------|------|
| 同期ボタンが表示されない | ⚙でToken/Gist IDが入力されているか確認 |
| 同期失敗 | TokenにGist権限があるか確認。Gist IDが正しいか確認 |
| .icsにアクセスできない | Vercelの環境変数GIST_IDが設定されているか確認。再デプロイ |
| iOSに反映されない | 照会URLが正しいか確認。WiFi接続時に手動更新を試す |
