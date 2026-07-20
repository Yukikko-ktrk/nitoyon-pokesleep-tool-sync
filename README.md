# nitoyon-pokesleep-tool-sync

[ポケモンスリープ個体値計算ツール](https://nitoyon.github.io/pokesleep-tool/iv/index.ja.html) (nitoyon 氏作) 用のユーザースクリプト。次の2機能を1本に統合している (v3.0.0〜):

- **GitHub 同期** — ボックスを自分の GitHub リポジトリ上のテキストファイルと複数端末間で自動同期する
- **スクショ取込 (AI 読取)** — ゲームの個体詳細画面のスクショを Gemini API (無料枠) / Claude API (有料) の vision で読み取り、ツールの編集画面に読み込んで登録できる

UI は画面右下の ☁📷 バッジのみ。タップすると「メイン (取込と同期操作) / Git設定 / API設定」の3タブのパネルが開く。

## インストール

Tampermonkey (PC) の場合、以下の URL を開くとインストールできる。以後の更新は自動配信される。

```
https://raw.githubusercontent.com/Yukikko-ktrk/nitoyon-pokesleep-tool-sync/main/nitoyon-pokesleep-tool-sync.user.js
```

iPhone (Safari) の場合は App Store の **Userscripts** (Quoid Software) を使う:

1. Userscripts アプリでスクリプト保存用フォルダを設定 (iCloud Drive 推奨)
2. 上記 URL の中身を `.user.js` ファイルとしてフォルダに保存
3. 設定 → アプリ → Safari → 機能拡張 → Userscripts をオンにし、`nitoyon.github.io` へのアクセスを許可
4. スクリプトに `@updateURL` が入っているので、以後の更新は Userscripts アプリの更新チェックからワンタップで反映できる

## スクショ取込 (AI 読取)

パネルの「API設定」タブでモデルと API キー
([Google AI Studio](https://aistudio.google.com/apikey) で無料発行) を設定した後、
「メイン」タブの「画像を選ぶ」でゲームの個体詳細画面のスクショを選ぶと、AI が
種族・レベル・食材・サブスキル・せいかくを読み取り、ツールの編集画面に読み込む。
内容を確認・調整して純正メニューの「ボックスに追加」で登録する
(複数枚選んだときは1匹ずつ順に処理できる)。追加分は GitHub 同期がそのまま push する。

API キーはツールページの localStorage に保存されるため、無料の Gemini キーか、
支出上限を設定した専用キーを使うこと。

旧 `pokesleep-screenshot-ocr.user.js` (v1.x) は本体へ統合のうえ配信終了した。
入れていた場合は手動でアンインストールすること。

### ホーム画面に追加 (PWA) する場合の注意

このツールは PWA (`display: standalone`) のため、素の状態で iPhone の「ホーム画面に追加」をすると独立 Web アプリとして開き、
Safari 機能拡張が動かず localStorage も Safari と別になって同期できない。
このスクリプト (v2.2.0 以降) は対策として **iOS ではページの manifest を除去**しており、スクリプト有効時に「ホーム画面に追加」すると
「Safari で開くブックマーク」としてアイコンが作られるため、拡張も同期もそのまま効く。
v2.1.x 以前に作ったホーム画面アイコンは独立アプリのままなので、一度削除して追加し直すこと。
PC (Edge / Chrome) の「アプリとしてインストール」はブラウザとプロファイルを共有するため元々問題なく動く。

## 仕組み

- 同期ファイルはツールの「カスタム形式エクスポート」と同じ **1行1匹 (`シリアル値@ニックネーム`)** のプレーンテキスト。
  ボックスの localStorage (`PstPokeBox`) はこの行をそのまま JSON 配列にしたものなので、無変換で双方向同期できる
- ページを開くと GitHub 上のファイルを取得し、端末側と違えば新しい方を採用して再読み込みする
- ページを開いている間は 5 秒ごとに変更を監視し、編集が止まったら自動で GitHub へ push する (閉じ忘れても安全)
- タブを閉じる/アプリを切り替える瞬間にも保険で送信を試みる
- 画面右下の ☁ バッジが状態表示 (✓ 同期済み / ● 未送信 / … 通信中 / ! エラー)。タップで設定パネルが開く

同期ファイルをエディタ (Obsidian 等) で直接編集しても、次にツールを開いたときに取り込まれる。

## セットアップ

1. 同期ファイルを置くリポジトリを決める (プライベート推奨)。ファイルは既存のエクスポート md でも、新規の空ファイルでもよい
2. [Fine-grained Personal Access Token](https://github.com/settings/personal-access-tokens/new) を作る:
   - Repository access: **Only select repositories** → 同期先リポジトリだけを選ぶ
   - Permissions → Repository permissions → **Contents: Read and write**
3. ツールのページ右下の「☁設定」を開き、Token / Owner / Repo / Path / Branch を入力して「保存して同期」

複数端末に配る場合は、設定パネルの「一括貼り付け」欄に次の形式の JSON を貼れば1回のペーストで済む
(この JSON はトークンを含むので、パスワードマネージャ等の安全な場所に保管すること):

```json
{"token":"github_pat_...","owner":"OWNER","repo":"REPO","path":"FILE.md","branch":"main"}
```

## 同期対象と注意

- 同期するのは **ボックスのみ**。並び順・フィルタ・言語などの設定は端末ごと (同期しない)
- 同期ファイルの行順 = ボックスの並び順。ツールで追加した個体は末尾行に付く
- 同期ファイルには **エクスポート行以外を書かないこと** (見出しやメモ行を書くと、ツールが読めない行としてボックス取り込み時に捨てられ、次の push でファイルからも消える)。空行だけは無視される
- トークンはツールのページの localStorage に保存される。同一オリジン (`nitoyon.github.io`) の他ページからも理論上読めるため、必ず Fine-grained token で対象リポジトリを絞ること。共有 PC では使わない

## 初回同期の挙動

- 端末のボックスが空なら黙って GitHub 側を取り込む
- 両方にデータがある場合は確認ダイアログが出る (OK = GitHub 側を採用 / キャンセル = この端末側を GitHub へ送る)

## 競合したとき

2 台で同時に編集した場合などは自動では上書きせず、バッジが `☁!` になる。
バッジをタップして「GitHub から取得」(端末側を破棄) か「GitHub へ送信」(GitHub 側を上書き) を選ぶ。
