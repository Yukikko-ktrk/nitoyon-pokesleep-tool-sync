// ==UserScript==
// @name         PokeSleep Tool GitHub Sync
// @namespace    nitoyon-pokesleep-tool-sync
// @version      2.2.0
// @description  nitoyon pokesleep-tool のボックスを GitHub 上の md ファイル (1行1匹のエクスポート形式) と自動同期する
// @match        https://nitoyon.github.io/pokesleep-tool/*
// @grant        none
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/Yukikko-ktrk/nitoyon-pokesleep-tool-sync/main/nitoyon-pokesleep-tool-sync.user.js
// @downloadURL  https://raw.githubusercontent.com/Yukikko-ktrk/nitoyon-pokesleep-tool-sync/main/nitoyon-pokesleep-tool-sync.user.js
// ==/UserScript==

(function () {
	'use strict';

	// 動作診断用のログ。F12 コンソールで [ghsync] を検索すればどこまで動いたか分かる
	console.log('[ghsync] script loaded (v2.2.0)', location.href);

	// iOS の「ホーム画面に追加」は manifest の display:standalone により独立 Web アプリ化し、
	// Safari 拡張が動かず localStorage も別コンテナになって同期できない。
	// manifest を DOM から外し、ホーム画面追加を「Safari で開くブックマーク」に落とす
	const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
		(navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
	if (isIOS) {
		for (const el of document.querySelectorAll('link[rel="manifest"]')) el.remove();
		console.log('[ghsync] iOS: manifest を除去 (ホーム画面追加が Safari ブックマークになる)');
	}

	// ボックスの localStorage キー。中身は ["シリアル値@ニックネーム", ...] の JSON 配列で、
	// md ファイルの各行と 1:1 に対応する (ツールのカスタム形式エクスポートと同一)
	const BOX_KEY = 'PstPokeBox';
	const CONFIG_KEY = 'GhSyncConfig';
	const META_KEY = 'GhSyncMeta';
	const POLL_MS = 5000;   // ローカル変更の監視間隔
	const STABLE_MS = 4000; // 変更が止まってから push するまでの猶予

	// 公開スクリプトのため同期先の既定値は持たない。設定パネルで入力する
	const DEFAULTS = {
		owner: '',
		repo: '',
		path: '',
		branch: 'main',
	};

	// ---------- 小道具 ----------

	function loadJson(key) {
		try {
			const s = localStorage.getItem(key);
			return s === null ? null : JSON.parse(s);
		} catch (e) {
			return null;
		}
	}
	function saveJson(key, obj) {
		localStorage.setItem(key, JSON.stringify(obj));
	}

	// ローカルのボックスを md テキスト (正規形: 空行なし・改行 \n) にする
	function localToMd() {
		const arr = loadJson(BOX_KEY);
		if (!Array.isArray(arr)) return '';
		return arr.filter((x) => typeof x === 'string' && x.trim() !== '').join('\n');
	}

	// md テキストを正規形に直す (空行除去・CRLF 吸収)。比較にもこの形を使う
	function canonicalizeMd(text) {
		return text.split(/\r?\n/).map((s) => s.trim()).filter((s) => s !== '').join('\n');
	}

	// md テキストをボックスへ書き込む
	function applyMd(canonicalText) {
		const lines = canonicalText === '' ? [] : canonicalText.split('\n');
		saveJson(BOX_KEY, lines);
	}

	function localLooksEmpty() {
		const arr = loadJson(BOX_KEY);
		return !Array.isArray(arr) || arr.length === 0;
	}

	// UTF-8 文字列 <-> base64 (btoa は生バイトしか扱えないためチャンク変換)
	function b64encode(str) {
		const bytes = new TextEncoder().encode(str);
		let bin = '';
		const CHUNK = 0x8000;
		for (let i = 0; i < bytes.length; i += CHUNK) {
			bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
		}
		return btoa(bin);
	}
	function b64decode(b64) {
		const bin = atob(b64.replace(/\n/g, ''));
		const bytes = new Uint8Array(bin.length);
		for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
		return new TextDecoder().decode(bytes);
	}

	// ---------- GitHub Contents API ----------

	function contentsUrl(cfg, withRef) {
		const path = cfg.path.split('/').map(encodeURIComponent).join('/');
		let url = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${path}`;
		if (withRef && cfg.branch) url += `?ref=${encodeURIComponent(cfg.branch)}`;
		return url;
	}
	function apiHeaders(cfg) {
		return {
			'Authorization': `Bearer ${cfg.token}`,
			'Accept': 'application/vnd.github+json',
			'X-GitHub-Api-Version': '2022-11-28',
		};
	}

	// 戻り値: {exists, sha, md} (md は正規形) / 認証等の失敗は throw
	async function fetchRemote(cfg) {
		const res = await fetch(contentsUrl(cfg, true), { headers: apiHeaders(cfg) });
		if (res.status === 404) return { exists: false };
		if (!res.ok) throw new Error(`GitHub GET ${res.status}`);
		const json = await res.json();
		return { exists: true, sha: json.sha, md: canonicalizeMd(b64decode(json.content)) };
	}

	// 戻り値: 新しい sha / sha 競合 (他端末や Obsidian 側が先に更新) は 'conflict'
	async function pushRemote(cfg, canonicalText, sha, keepalive) {
		const body = {
			message: `pokesleep sync ${new Date().toISOString()} (${navigator.platform || 'unknown'})`,
			content: b64encode(canonicalText + '\n'),
		};
		if (sha) body.sha = sha;
		if (cfg.branch) body.branch = cfg.branch;
		const res = await fetch(contentsUrl(cfg, false), {
			method: 'PUT',
			headers: { ...apiHeaders(cfg), 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
			keepalive: !!keepalive,
		});
		if (res.status === 409 || res.status === 422) return 'conflict';
		if (!res.ok) throw new Error(`GitHub PUT ${res.status}`);
		const json = await res.json();
		return json.content.sha;
	}

	// ---------- 状態表示バッジ ----------

	let badge = null;
	function setStatus(state, title) {
		if (!badge) {
			badge = document.createElement('div');
			badge.id = 'ghsync-badge';
			badge.style.cssText =
				'position:fixed;right:8px;bottom:8px;z-index:99999;' +
				'font:12px/1 sans-serif;padding:6px 10px;border-radius:12px;' +
				'background:rgba(0,0,0,.55);color:#fff;cursor:pointer;user-select:none;';
			badge.addEventListener('click', openPanel);
			document.body.appendChild(badge);
		}
		const marks = { ok: '☁✓', busy: '☁…', dirty: '☁●', error: '☁!', setup: '☁設定' };
		badge.textContent = marks[state] || state;
		badge.title = title || '';
		badge.style.background = state === 'error' ? 'rgba(180,30,30,.8)' : 'rgba(0,0,0,.55)';
	}

	// ---------- 設定パネル ----------

	function openPanel() {
		if (document.getElementById('ghsync-panel')) return;
		const cfg = loadJson(CONFIG_KEY) || {};
		const panel = document.createElement('div');
		panel.id = 'ghsync-panel';
		panel.style.cssText =
			'position:fixed;right:8px;bottom:40px;z-index:99999;width:280px;' +
			'font:13px/1.5 sans-serif;padding:12px;border-radius:8px;' +
			'background:#fff;color:#222;box-shadow:0 2px 12px rgba(0,0,0,.4);';
		panel.innerHTML = `
			<b>GitHub 同期設定</b><br>
			<label>一括貼り付け (JSON・任意)<br><textarea id="ghsync-bulk" rows="2" style="width:100%"
				placeholder='{"token":"github_pat_...","owner":"...","repo":"...","path":"...","branch":"main"}'></textarea></label>
			<label>Token<br><input id="ghsync-token" type="password" style="width:100%" value="${cfg.token || ''}"></label>
			<label>Owner<br><input id="ghsync-owner" style="width:100%" value="${cfg.owner || DEFAULTS.owner}"></label>
			<label>Repo<br><input id="ghsync-repo" style="width:100%" value="${cfg.repo || DEFAULTS.repo}"></label>
			<label>Path<br><input id="ghsync-path" style="width:100%" value="${cfg.path || DEFAULTS.path}"></label>
			<label>Branch<br><input id="ghsync-branch" style="width:100%" value="${cfg.branch || DEFAULTS.branch}"></label>
			<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">
				<button id="ghsync-save">保存して同期</button>
				<button id="ghsync-pull">GitHub から取得</button>
				<button id="ghsync-push">GitHub へ送信</button>
				<button id="ghsync-close">閉じる</button>
			</div>`;
		document.body.appendChild(panel);
		const val = (id) => document.getElementById(id).value.trim();
		// 一括貼り付け欄に JSON があればそれを優先し、なければ個別欄を読む
		const readCfg = () => {
			const bulk = val('ghsync-bulk');
			if (bulk !== '') {
				try {
					const j = JSON.parse(bulk);
					return {
						token: j.token || '', owner: j.owner || '',
						repo: j.repo || '', path: j.path || '', branch: j.branch || 'main',
					};
				} catch (e) {
					alert('一括貼り付けの JSON を解釈できません: ' + e);
					throw e;
				}
			}
			return {
				token: val('ghsync-token'), owner: val('ghsync-owner'),
				repo: val('ghsync-repo'), path: val('ghsync-path'), branch: val('ghsync-branch'),
			};
		};
		document.getElementById('ghsync-save').addEventListener('click', () => {
			saveJson(CONFIG_KEY, readCfg());
			panel.remove();
			boot();
		});
		document.getElementById('ghsync-pull').addEventListener('click', async () => {
			saveJson(CONFIG_KEY, readCfg());
			panel.remove();
			await forcePull();
		});
		document.getElementById('ghsync-push').addEventListener('click', async () => {
			saveJson(CONFIG_KEY, readCfg());
			panel.remove();
			await forcePush();
		});
		document.getElementById('ghsync-close').addEventListener('click', () => panel.remove());
	}

	// ---------- 同期本体 ----------

	let syncing = false;

	async function forcePull() {
		const cfg = loadJson(CONFIG_KEY);
		setStatus('busy', '取得中');
		try {
			const remote = await fetchRemote(cfg);
			if (!remote.exists) { setStatus('error', 'GitHub にファイルがありません'); return; }
			applyMd(remote.md);
			saveJson(META_KEY, { remoteSha: remote.sha, syncedMd: remote.md });
			location.reload();
		} catch (e) {
			setStatus('error', String(e));
		}
	}

	async function forcePush() {
		const cfg = loadJson(CONFIG_KEY);
		setStatus('busy', '送信中');
		try {
			const remote = await fetchRemote(cfg);
			const md = localToMd();
			const sha = await pushRemote(cfg, md, remote.exists ? remote.sha : null);
			if (sha === 'conflict') { setStatus('error', '競合しました。再読み込みしてください'); return; }
			saveJson(META_KEY, { remoteSha: sha, syncedMd: md });
			setStatus('ok', '送信完了');
		} catch (e) {
			setStatus('error', String(e));
		}
	}

	// 起動時同期: ローカル/リモートの変更有無で pull・push・競合確認を振り分ける
	async function startupSync() {
		const cfg = loadJson(CONFIG_KEY);
		const meta = loadJson(META_KEY);
		setStatus('busy', '同期中');
		const remote = await fetchRemote(cfg);
		const localMd = localToMd();

		if (!remote.exists) {
			// リモートにファイルが無い → ローカルを送って作成
			const sha = await pushRemote(cfg, localMd, null);
			saveJson(META_KEY, { remoteSha: sha, syncedMd: localMd });
			setStatus('ok', '初回アップロード完了');
			return;
		}

		if (remote.md === localMd) {
			// 内容が同一なら sha だけ揃えて終わり
			saveJson(META_KEY, { remoteSha: remote.sha, syncedMd: localMd });
			setStatus('ok', '同期済み');
			return;
		}

		const localChanged = !meta || localMd !== meta.syncedMd;
		const remoteChanged = !meta || remote.sha !== meta.remoteSha;

		let useRemote;
		if (!meta) {
			// この端末で初めて同期する場合: ローカルが空ならリモートを採用、
			// 両方に中身があるときだけユーザに確認する
			useRemote = localLooksEmpty() ||
				confirm('GitHub 上のデータとこの端末のボックスが異なります。\n\n' +
					'OK = GitHub のデータで置き換える\nキャンセル = この端末のボックスを GitHub へ送る');
		} else if (remoteChanged && !localChanged) {
			useRemote = true;
		} else if (!remoteChanged && localChanged) {
			useRemote = false;
		} else {
			// 両方変わっている (別端末や Obsidian で更新後、この端末もオフラインで更新した等)
			useRemote = confirm('GitHub と この端末の両方に変更があります。\n\n' +
				'OK = GitHub のデータを採用 (この端末の変更は破棄)\n' +
				'キャンセル = この端末のデータを採用 (GitHub 側を上書き)');
		}

		if (useRemote) {
			applyMd(remote.md);
			saveJson(META_KEY, { remoteSha: remote.sha, syncedMd: remote.md });
			// アプリは起動時に localStorage を読むため、反映には再読み込みが必要。
			// 同じ sha で2回連続リロードしない保険を掛ける
			if (sessionStorage.getItem('GhSyncReloadedFor') !== remote.sha) {
				sessionStorage.setItem('GhSyncReloadedFor', remote.sha);
				location.reload();
			} else {
				setStatus('ok', '同期済み');
			}
		} else {
			const sha = await pushRemote(cfg, localMd, remote.sha);
			if (sha === 'conflict') { setStatus('error', '競合しました。再読み込みしてください'); return; }
			saveJson(META_KEY, { remoteSha: sha, syncedMd: localMd });
			setStatus('ok', '送信完了');
		}
	}

	// 変更監視: ボックスが安定してから push する
	let lastSeen = null;
	let dirtySince = 0;

	async function pollTick() {
		if (syncing) return;
		const meta = loadJson(META_KEY);
		if (!meta) return;
		const md = localToMd();
		if (md === meta.syncedMd) {
			lastSeen = md;
			return;
		}
		const now = Date.now();
		if (md !== lastSeen) {
			lastSeen = md;
			dirtySince = now;
			setStatus('dirty', '未送信の変更あり');
			return;
		}
		if (now - dirtySince < STABLE_MS) return;

		syncing = true;
		setStatus('busy', '送信中');
		try {
			const sha = await pushRemote(loadJson(CONFIG_KEY), md, meta.remoteSha);
			if (sha === 'conflict') {
				// 他端末や Obsidian が先に更新していた。手動で判断してもらう
				setStatus('error', '他の更新と競合。バッジから「取得」か「送信」を選んでください');
			} else {
				saveJson(META_KEY, { remoteSha: sha, syncedMd: md });
				setStatus('ok', '同期済み');
			}
		} catch (e) {
			setStatus('error', String(e));
		} finally {
			syncing = false;
		}
	}

	// 画面を離れるときの保険 (成功保証はない。主役はあくまで自動 push)
	function flushOnHide() {
		const meta = loadJson(META_KEY);
		const cfg = loadJson(CONFIG_KEY);
		if (!meta || !cfg) return;
		const md = localToMd();
		if (md === meta.syncedMd) return;
		try { pushRemote(cfg, md, meta.remoteSha, true); } catch (e) { /* 無視 */ }
	}

	// ---------- 起動 ----------

	async function boot() {
		console.log('[ghsync] boot');
		const cfg = loadJson(CONFIG_KEY);
		if (!cfg || !cfg.token || !cfg.owner || !cfg.repo || !cfg.path) {
			setStatus('setup', 'クリックして GitHub 同期を設定');
			console.log('[ghsync] 設定未入力。バッジ表示:', !!document.getElementById('ghsync-badge'));
			return;
		}
		try {
			await startupSync();
		} catch (e) {
			setStatus('error', String(e));
		}
		setInterval(pollTick, POLL_MS);
		document.addEventListener('visibilitychange', () => {
			if (document.visibilityState === 'hidden') flushOnHide();
		});
		window.addEventListener('pagehide', flushOnHide);
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', boot);
	} else {
		boot();
	}
})();
