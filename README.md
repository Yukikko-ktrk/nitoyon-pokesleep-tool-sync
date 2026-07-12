# nitoyon-pokesleep-tool-sync

[ポケモンスリープ個体値計算ツール](https://nitoyon.github.io/pokesleep-tool/iv/index.ja.html) (nitoyon 氏作) のボックスを、自分の GitHub リポジトリ上のテキストファイルと複数端末間で自動同期するユーザースクリプト。

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
