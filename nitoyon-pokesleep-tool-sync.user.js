// ==UserScript==
// @name         PokeSleep Tool Sync + AI Import
// @namespace    nitoyon-pokesleep-tool-sync
// @version      3.0.1
// @description  nitoyon pokesleep-tool のボックスを GitHub と自動同期し、スクショの AI 読取 (Gemini 無料枠 / Claude) で個体を取り込む統合ツール
// @match        https://nitoyon.github.io/pokesleep-tool/*
// @grant        none
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/Yukikko-ktrk/nitoyon-pokesleep-tool-sync/main/nitoyon-pokesleep-tool-sync.user.js
// @downloadURL  https://raw.githubusercontent.com/Yukikko-ktrk/nitoyon-pokesleep-tool-sync/main/nitoyon-pokesleep-tool-sync.user.js
// ==/UserScript==

(function () {
	'use strict';

	console.log('[pst] script loaded (v3.0.1)', typeof location !== 'undefined' ? location.href : 'node');

	// ---------- 定数 ----------

	// ボックスの localStorage キー。中身は ["シリアル値@ニックネーム", ...] の JSON 配列で、
	// 同期 md ファイルの各行と 1:1 に対応する (ツールのカスタム形式エクスポートと同一)
	const BOX_KEY = 'PstPokeBox';
	const CONFIG_KEY = 'GhSyncConfig';   // GitHub 同期設定 (v2 系から引き継ぎ)
	const META_KEY = 'GhSyncMeta';
	const OCR_CFG_KEY = 'PstOcrConfig';  // AI 読取設定 (v1 系から引き継ぎ)
	const PENDING_KEY = 'PstOcrPending'; // 編集画面で開く際に残りの読取結果を退避する
	const POLL_MS = 5000;   // ローカル変更の監視間隔
	const STABLE_MS = 4000; // 変更が止まってから push するまでの猶予

	const DEFAULT_MODEL = 'gemini-3.5-flash';
	// モデル一覧。gemini-* は Google AI Studio の無料枠で使える。
	// 廃止済みモデルを指定した場合は callGemini が現行モデルを自動で探して切り替える
	const MODELS = {
		'gemini-3.5-flash': 'Gemini 3.5 Flash (無料枠・推奨)',
		'gemini-3.1-flash-lite': 'Gemini Flash Lite (無料枠・速い)',
		'gemini-3.1-pro-preview': 'Gemini Pro (無料枠・高精度だが回数少)',
		'claude-opus-4-8': 'Claude Opus (有料 約5円/枚・最高精度)',
		'claude-haiku-4-5': 'Claude Haiku (有料 約1円/枚)',
	};

	// ---------- 索引データ (make_userscript.py が data.json から生成して埋め込む) ----------
	/*DATA_START*/
	const DATA = {"ingTypes":["AAA","AAB","AAC","ABA","ABB","ABC"],"natures":["てれや","がんばりや","すなお","きまぐれ","まじめ","ずぶとい","わんぱく","のうてんき","のんき","おくびょう","せっかち","ようき","むじゃき","さみしがり","いじっぱり","やんちゃ","ゆうかん","おだやか","おとなしい","しんちょう","なまいき","ひかえめ","おっとり","うっかりや","れいせい"],"subskills":["きのみの数S","ゆめのかけらボーナス","げんき回復ボーナス","おてつだいボーナス","リサーチEXPボーナス","スキルレベルアップM","睡眠EXPボーナス","おてつだいスピードM","食材確率アップM","最大所持数アップL","最大所持数アップM","スキルレベルアップS","スキル確率アップM","おてつだいスピードS","食材確率アップS","最大所持数アップS","スキル確率アップS"],"ingredients":["あじわいキノコ","あったかジンジャー","あまいミツ","あんみんトマト","おいしいシッポ","げきからハーブ","ずっしりカボチャ","つやつやアボカド","とくせんエッグ","とくせんリンゴ","ふといながねぎ","ほっこりポテト","めざましコーヒー","ピュアなオイル","マメミート","モーモーミルク","リラックスカカオ","ワカクサコーン","ワカクサ大豆"],"pokemons":[[1,"フシギダネ",0,"あまいミツ","あんみんトマト","ほっこりポテト","",0],[2,"フシギソウ",0,"あまいミツ","あんみんトマト","ほっこりポテト","",1],[3,"フシギバナ",0,"あまいミツ","あんみんトマト","ほっこりポテト","",2],[4,"ヒトカゲ",0,"マメミート","あったかジンジャー","げきからハーブ","",0],[5,"リザード",0,"マメミート","あったかジンジャー","げきからハーブ","",1],[6,"リザードン",0,"マメミート","あったかジンジャー","げきからハーブ","",2],[7,"ゼニガメ",0,"モーモーミルク","リラックスカカオ","マメミート","",0],[8,"カメール",0,"モーモーミルク","リラックスカカオ","マメミート","",1],[9,"カメックス",0,"モーモーミルク","リラックスカカオ","マメミート","",2],[10,"キャタピー",0,"あまいミツ","あんみんトマト","ワカクサ大豆","",0],[11,"トランセル",0,"あまいミツ","あんみんトマト","ワカクサ大豆","",1],[12,"バタフリー",0,"あまいミツ","あんみんトマト","ワカクサ大豆","",2],[19,"コラッタ",0,"とくせんリンゴ","ワカクサ大豆","マメミート","",0],[20,"ラッタ",0,"とくせんリンゴ","ワカクサ大豆","マメミート","",1],[23,"アーボ",0,"マメミート","とくせんエッグ","げきからハーブ","",0],[24,"アーボック",0,"マメミート","とくせんエッグ","げきからハーブ","",1],[25,"ピカチュウ",0,"とくせんリンゴ","あったかジンジャー","とくせんエッグ","",1],[25,"ピカチュウ (ホリデー)",2,"とくせんリンゴ","あったかジンジャー","とくせんエッグ","",-1],[25,"ピカチュウ (ハロウィン)",1,"とくせんリンゴ","あったかジンジャー","とくせんエッグ","",-1],[26,"ライチュウ",0,"とくせんリンゴ","あったかジンジャー","とくせんエッグ","",2],[27,"サンド",0,"ずっしりカボチャ","ワカクサコーン","ほっこりポテト","",0],[28,"サンドパン",0,"ずっしりカボチャ","ワカクサコーン","ほっこりポテト","",1],[35,"ピッピ",0,"とくせんリンゴ","あまいミツ","ワカクサ大豆","",1],[36,"ピクシー",0,"とくせんリンゴ","あまいミツ","ワカクサ大豆","",2],[37,"ロコン",0,"ワカクサ大豆","ワカクサコーン","ほっこりポテト","",0],[37,"ロコン (アローラ)",3,"ワカクサ大豆","ワカクサコーン","ほっこりポテト","",0],[38,"キュウコン",0,"ワカクサ大豆","ワカクサコーン","ほっこりポテト","",1],[38,"キュウコン (アローラ)",3,"ワカクサ大豆","ワカクサコーン","ほっこりポテト","",1],[39,"プリン",0,"あまいミツ","ピュアなオイル","リラックスカカオ","",1],[40,"プクリン",0,"あまいミツ","ピュアなオイル","リラックスカカオ","",2],[50,"ディグダ",0,"あんみんトマト","ふといながねぎ","ワカクサ大豆","",0],[51,"ダグトリオ",0,"あんみんトマト","ふといながねぎ","ワカクサ大豆","",1],[52,"ニャース",0,"モーモーミルク","マメミート",null,"",0],[53,"ペルシアン",0,"モーモーミルク","マメミート",null,"",1],[54,"コダック",0,"リラックスカカオ","とくせんリンゴ","マメミート","",0],[55,"ゴルダック",0,"リラックスカカオ","とくせんリンゴ","マメミート","",1],[56,"マンキー",0,"マメミート","あじわいキノコ","あまいミツ","",0],[57,"オコリザル",0,"マメミート","あじわいキノコ","あまいミツ","",1],[58,"ガーディ",0,"げきからハーブ","マメミート","モーモーミルク","",0],[59,"ウインディ",0,"げきからハーブ","マメミート","モーモーミルク","",1],[69,"マダツボミ",0,"あんみんトマト","ほっこりポテト","ふといながねぎ","",0],[70,"ウツドン",0,"あんみんトマト","ほっこりポテト","ふといながねぎ","",1],[71,"ウツボット",0,"あんみんトマト","ほっこりポテト","ふといながねぎ","",2],[74,"イシツブテ",0,"ワカクサ大豆","ほっこりポテト","あじわいキノコ","",0],[75,"ゴローン",0,"ワカクサ大豆","ほっこりポテト","あじわいキノコ","",1],[76,"ゴローニャ",0,"ワカクサ大豆","ほっこりポテト","あじわいキノコ","",2],[79,"ヤドン",0,"リラックスカカオ","おいしいシッポ","あんみんトマト","",0],[80,"ヤドラン",0,"リラックスカカオ","おいしいシッポ","あんみんトマト","",1],[81,"コイル",0,"ピュアなオイル","げきからハーブ",null,"",0],[82,"レアコイル",0,"ピュアなオイル","げきからハーブ",null,"",1],[83,"カモネギ",0,"ふといながねぎ","マメミート","あったかジンジャー","",-1],[84,"ドードー",0,"ワカクサ大豆","リラックスカカオ","マメミート","",0],[85,"ドードリオ",0,"ワカクサ大豆","リラックスカカオ","マメミート","",1],[92,"ゴース",0,"げきからハーブ","あじわいキノコ","ピュアなオイル","",0],[93,"ゴースト",0,"げきからハーブ","あじわいキノコ","ピュアなオイル","",1],[94,"ゲンガー",0,"げきからハーブ","あじわいキノコ","ピュアなオイル","",2],[95,"イワーク",0,"あんみんトマト","マメミート","ほっこりポテト","",0],[104,"カラカラ",0,"あったかジンジャー","リラックスカカオ",null,"",0],[105,"ガラガラ",0,"あったかジンジャー","リラックスカカオ",null,"",1],[113,"ラッキー",0,"とくせんエッグ","ほっこりポテト","あまいミツ","",1],[115,"ガルーラ",0,"あったかジンジャー","ほっこりポテト","ワカクサ大豆","",-1],[122,"バリヤード",0,"あんみんトマト","ほっこりポテト","ふといながねぎ","",1],[127,"カイロス",0,"あまいミツ","とくせんリンゴ","マメミート","",-1],[132,"メタモン",0,"ピュアなオイル","ふといながねぎ","おいしいシッポ","",-1],[133,"イーブイ",0,"モーモーミルク","リラックスカカオ","マメミート","",0],[133,"イーブイ (ハロウィン)",1,"ずっしりカボチャ","リラックスカカオ","モーモーミルク","",-1],[133,"イーブイ (ホリデー)",2,"モーモーミルク","リラックスカカオ","マメミート","",-1],[134,"シャワーズ",0,"モーモーミルク","リラックスカカオ","マメミート","",1],[135,"サンダース",0,"モーモーミルク","リラックスカカオ","マメミート","",1],[136,"ブースター",0,"モーモーミルク","リラックスカカオ","マメミート","",1],[147,"ミニリュウ",0,"げきからハーブ","ワカクサコーン","ピュアなオイル","",0],[148,"ハクリュー",0,"げきからハーブ","ワカクサコーン","ピュアなオイル","",1],[149,"カイリュー",0,"げきからハーブ","ワカクサコーン","ピュアなオイル","",2],[151,"ミュウ",0,"とくせんエッグ","げきからハーブ",null,"M",-1,["ふといながねぎ","とくせんエッグ","げきからハーブ","マメミート","ピュアなオイル","おいしいシッポ","ワカクサ大豆","つやつやアボカド"]],[152,"チコリータ",0,"リラックスカカオ","あまいミツ","ふといながねぎ","",0],[153,"ベイリーフ",0,"リラックスカカオ","あまいミツ","ふといながねぎ","",1],[154,"メガニウム",0,"リラックスカカオ","あまいミツ","ふといながねぎ","",2],[155,"ヒノアラシ",0,"あったかジンジャー","げきからハーブ","ピュアなオイル","",0],[156,"マグマラシ",0,"あったかジンジャー","げきからハーブ","ピュアなオイル","",1],[157,"バクフーン",0,"あったかジンジャー","げきからハーブ","ピュアなオイル","",2],[158,"ワニノコ",0,"マメミート","ピュアなオイル",null,"",0],[159,"アリゲイツ",0,"マメミート","ピュアなオイル",null,"",1],[160,"オーダイル",0,"マメミート","ピュアなオイル",null,"",2],[172,"ピチュー",0,"とくせんリンゴ","あったかジンジャー","とくせんエッグ","",0],[173,"ピィ",0,"とくせんリンゴ","あまいミツ","ワカクサ大豆","",0],[174,"ププリン",0,"あまいミツ","ピュアなオイル","リラックスカカオ","",0],[175,"トゲピー",0,"とくせんエッグ","あったかジンジャー","リラックスカカオ","",0],[176,"トゲチック",0,"とくせんエッグ","あったかジンジャー","リラックスカカオ","",1],[177,"ネイティ",0,"とくせんエッグ","リラックスカカオ","とくせんリンゴ","",0],[178,"ネイティオ",0,"とくせんエッグ","リラックスカカオ","とくせんリンゴ","",1],[179,"メリープ",0,"げきからハーブ","とくせんエッグ",null,"",0],[180,"モココ",0,"げきからハーブ","とくせんエッグ",null,"",1],[181,"デンリュウ",0,"げきからハーブ","とくせんエッグ",null,"",2],[185,"ウソッキー",0,"あんみんトマト","ワカクサ大豆","あじわいキノコ","",1],[194,"ウパー",0,"あじわいキノコ","ほっこりポテト","マメミート","",0],[194,"ウパー (パルデア)",4,"リラックスカカオ","めざましコーヒー","ほっこりポテト","",0],[195,"ヌオー",0,"あじわいキノコ","ほっこりポテト","マメミート","",1],[196,"エーフィ",0,"モーモーミルク","リラックスカカオ","マメミート","",1],[197,"ブラッキー",0,"モーモーミルク","リラックスカカオ","マメミート","",1],[198,"ヤミカラス",0,"めざましコーヒー","ワカクサ大豆","げきからハーブ","",0],[199,"ヤドキング",0,"リラックスカカオ","おいしいシッポ","あんみんトマト","",1],[202,"ソーナンス",0,"とくせんリンゴ","あじわいキノコ","ピュアなオイル","",1],[208,"ハガネール",0,"あんみんトマト","マメミート","ほっこりポテト","",1],[213,"ツボツボ",0,"ピュアなオイル","めざましコーヒー","あまいミツ","",-1],[214,"ヘラクロス",0,"あまいミツ","あじわいキノコ","マメミート","",-1],[215,"ニューラ",0,"マメミート","とくせんエッグ","ワカクサ大豆","",0],[225,"デリバード",0,"とくせんエッグ","とくせんリンゴ","リラックスカカオ","",-1],[228,"デルビル",0,"げきからハーブ","あったかジンジャー","ふといながねぎ","",0],[229,"ヘルガー",0,"げきからハーブ","あったかジンジャー","ふといながねぎ","",1],[242,"ハピナス",0,"とくせんエッグ","ほっこりポテト","あまいミツ","",2],[243,"ライコウ",0,"マメミート","げきからハーブ","ふといながねぎ","",-1],[244,"エンテイ",0,"ピュアなオイル","あんみんトマト","あじわいキノコ","",-1],[245,"スイクン",0,"とくせんリンゴ","ピュアなオイル","ワカクサコーン","",-1],[246,"ヨーギラス",0,"あったかジンジャー","ワカクサ大豆","マメミート","",0],[247,"サナギラス",0,"あったかジンジャー","ワカクサ大豆","マメミート","",1],[248,"バンギラス",0,"あったかジンジャー","ワカクサ大豆","マメミート","",2],[252,"キモリ",0,"とくせんエッグ","めざましコーヒー","ふといながねぎ","",0],[253,"ジュプトル",0,"とくせんエッグ","めざましコーヒー","ふといながねぎ","",1],[254,"ジュカイン",0,"とくせんエッグ","めざましコーヒー","ふといながねぎ","",2],[255,"アチャモ",0,"あじわいキノコ","ワカクサ大豆","ピュアなオイル","",0],[256,"ワカシャモ",0,"あじわいキノコ","ワカクサ大豆","ピュアなオイル","",1],[257,"バシャーモ",0,"あじわいキノコ","ワカクサ大豆","ピュアなオイル","",2],[258,"ミズゴロウ",0,"ワカクサコーン","モーモーミルク","あじわいキノコ","",0],[259,"ヌマクロー",0,"ワカクサコーン","モーモーミルク","あじわいキノコ","",1],[260,"ラグラージ",0,"ワカクサコーン","モーモーミルク","あじわいキノコ","",2],[280,"ラルトス",0,"とくせんリンゴ","ワカクサコーン","ふといながねぎ","",0],[281,"キルリア",0,"とくせんリンゴ","ワカクサコーン","ふといながねぎ","",1],[282,"サーナイト",0,"とくせんリンゴ","ワカクサコーン","ふといながねぎ","",2],[287,"ナマケロ",0,"あんみんトマト","あまいミツ","とくせんリンゴ","",0],[288,"ヤルキモノ",0,"あんみんトマト","あまいミツ","とくせんリンゴ","",1],[289,"ケッキング",0,"あんみんトマト","あまいミツ","とくせんリンゴ","",2],[302,"ヤミラミ",0,"ピュアなオイル","あじわいキノコ","リラックスカカオ","",-1],[303,"クチート",0,"ピュアなオイル","ワカクサコーン","あんみんトマト","",-1],[304,"ココドラ",0,"マメミート","めざましコーヒー","ワカクサ大豆","",0],[305,"コドラ",0,"マメミート","めざましコーヒー","ワカクサ大豆","",1],[306,"ボスゴドラ",0,"マメミート","めざましコーヒー","ワカクサ大豆","",2],[311,"プラスル",0,"めざましコーヒー","ふといながねぎ","モーモーミルク","",-1],[312,"マイナン",0,"あまいミツ","とくせんエッグ","モーモーミルク","",-1],[316,"ゴクリン",0,"ワカクサ大豆","あじわいキノコ","あまいミツ","",0],[317,"マルノーム",0,"ワカクサ大豆","あじわいキノコ","あまいミツ","",1],[328,"ナックラー",0,"つやつやアボカド","げきからハーブ","ワカクサ大豆","",0],[329,"ビブラーバ",0,"つやつやアボカド","げきからハーブ","ワカクサ大豆","",1],[330,"フライゴン",0,"つやつやアボカド","げきからハーブ","ワカクサ大豆","",2],[333,"チルット",0,"とくせんエッグ","ワカクサ大豆","とくせんリンゴ","",0],[334,"チルタリス",0,"とくせんエッグ","ワカクサ大豆","とくせんリンゴ","",1],[353,"カゲボウズ",0,"ピュアなオイル","あったかジンジャー","あじわいキノコ","",0],[354,"ジュペッタ",0,"ピュアなオイル","あったかジンジャー","あじわいキノコ","",1],[359,"アブソル",0,"リラックスカカオ","とくせんリンゴ","あじわいキノコ","",-1],[360,"ソーナノ",0,"とくせんリンゴ","あじわいキノコ","ピュアなオイル","",0],[363,"タマザラシ",0,"ピュアなオイル","マメミート","あったかジンジャー","",0],[363,"タマザラシ (ホリデー)",2,"ピュアなオイル","マメミート","あったかジンジャー","",-1],[364,"トドグラー",0,"ピュアなオイル","マメミート","あったかジンジャー","",1],[365,"トドゼルガ",0,"ピュアなオイル","マメミート","あったかジンジャー","",2],[371,"タツベイ",0,"ほっこりポテト","あったかジンジャー","マメミート","",0],[372,"コモルー",0,"ほっこりポテト","あったかジンジャー","マメミート","",1],[373,"ボーマンダ",0,"ほっこりポテト","あったかジンジャー","マメミート","",2],[380,"ラティアス",0,"あんみんトマト","ずっしりカボチャ","あじわいキノコ","",-1],[381,"ラティオス",0,"あんみんトマト","とくせんエッグ","モーモーミルク","",-1],[387,"ナエトル",0,"あじわいキノコ","ほっこりポテト","あったかジンジャー","",0],[388,"ハヤシガメ",0,"あじわいキノコ","ほっこりポテト","あったかジンジャー","",1],[389,"ドダイトス",0,"あじわいキノコ","ほっこりポテト","あったかジンジャー","",2],[390,"ヒコザル",0,"げきからハーブ","あったかジンジャー","めざましコーヒー","",0],[391,"モウカザル",0,"げきからハーブ","あったかジンジャー","めざましコーヒー","",1],[392,"ゴウカザル",0,"げきからハーブ","あったかジンジャー","めざましコーヒー","",2],[393,"ポッチャマ",0,"とくせんエッグ","ふといながねぎ","あまいミツ","",0],[394,"ポッタイシ",0,"とくせんエッグ","ふといながねぎ","あまいミツ","",1],[395,"エンペルト",0,"とくせんエッグ","ふといながねぎ","あまいミツ","",2],[403,"コリンク",0,"あんみんトマト","ピュアなオイル","めざましコーヒー","",0],[404,"ルクシオ",0,"あんみんトマト","ピュアなオイル","めざましコーヒー","",1],[405,"レントラー",0,"あんみんトマト","ピュアなオイル","めざましコーヒー","",2],[425,"フワンテ",0,"ワカクサコーン","ピュアなオイル","ほっこりポテト","",0],[426,"フワライド",0,"ワカクサコーン","ピュアなオイル","ほっこりポテト","",1],[430,"ドンカラス",0,"めざましコーヒー","ワカクサ大豆","げきからハーブ","",1],[438,"ウソハチ",0,"あんみんトマト","ワカクサ大豆","あじわいキノコ","",0],[439,"マネネ",0,"あんみんトマト","ほっこりポテト","ふといながねぎ","",0],[440,"ピンプク",0,"とくせんエッグ","ほっこりポテト","あまいミツ","",0],[442,"ミカルゲ",0,"あじわいキノコ","ずっしりカボチャ","ふといながねぎ","",-1],[447,"リオル",0,"ピュアなオイル","ほっこりポテト","とくせんエッグ","",0],[448,"ルカリオ",0,"ピュアなオイル","ほっこりポテト","とくせんエッグ","",1],[453,"グレッグル",0,"ピュアなオイル","マメミート",null,"",0],[454,"ドクロッグ",0,"ピュアなオイル","マメミート",null,"",1],[459,"ユキカブリ",0,"あんみんトマト","とくせんエッグ","あじわいキノコ","",0],[460,"ユキノオー",0,"あんみんトマト","とくせんエッグ","あじわいキノコ","",1],[461,"マニューラ",0,"マメミート","とくせんエッグ","ワカクサ大豆","",1],[462,"ジバコイル",0,"ピュアなオイル","げきからハーブ",null,"",2],[468,"トゲキッス",0,"とくせんエッグ","あったかジンジャー","リラックスカカオ","",2],[470,"リーフィア",0,"モーモーミルク","リラックスカカオ","マメミート","",1],[471,"グレイシア",0,"モーモーミルク","リラックスカカオ","マメミート","",1],[475,"エルレイド",0,"とくせんリンゴ","ワカクサコーン","ふといながねぎ","",2],[488,"クレセリア",0,"あったかジンジャー","リラックスカカオ","あんみんトマト","",-1],[491,"ダークライ",0,"マメミート",null,null,"M",-1,["とくせんリンゴ","げきからハーブ","マメミート","モーモーミルク","あまいミツ","ワカクサ大豆","ワカクサコーン","めざましコーヒー"]],[517,"ムンナ",0,"モーモーミルク","あまいミツ","めざましコーヒー","",0],[518,"ムシャーナ",0,"モーモーミルク","あまいミツ","めざましコーヒー","",1],[557,"イシズマイ",0,"つやつやアボカド","ほっこりポテト","ピュアなオイル","",0],[558,"イワパレス",0,"つやつやアボカド","ほっこりポテト","ピュアなオイル","",1],[627,"ワシボン",0,"マメミート","ワカクサコーン","めざましコーヒー","",0],[628,"ウォーグル",0,"マメミート","ワカクサコーン","めざましコーヒー","",1],[696,"チゴラス",0,"マメミート","とくせんリンゴ","ほっこりポテト","",0],[697,"ガチゴラス",0,"マメミート","とくせんリンゴ","ほっこりポテト","",1],[700,"ニンフィア",0,"モーモーミルク","リラックスカカオ","マメミート","",1],[702,"デデンネ",0,"とくせんリンゴ","リラックスカカオ","ワカクサコーン","",-1],[710,"バケッチャ (こだましゅ)",7,"ずっしりカボチャ","ワカクサ大豆","ほっこりポテト","",0],[710,"バケッチャ (ちゅうだましゅ)",8,"ずっしりカボチャ","ワカクサ大豆","ほっこりポテト","",0],[710,"バケッチャ (おおだましゅ)",9,"ずっしりカボチャ","ワカクサ大豆","ほっこりポテト","",0],[710,"バケッチャ (ギガだましゅ)",10,"ずっしりカボチャ","ワカクサ大豆","ほっこりポテト","",0],[711,"パンプジン (こだましゅ)",7,"ずっしりカボチャ","ワカクサ大豆","ほっこりポテト","",1],[711,"パンプジン (ちゅうだましゅ)",8,"ずっしりカボチャ","ワカクサ大豆","ほっこりポテト","",1],[711,"パンプジン (おおだましゅ)",9,"ずっしりカボチャ","ワカクサ大豆","ほっこりポテト","",1],[711,"パンプジン (ギガだましゅ)",10,"ずっしりカボチャ","ワカクサ大豆","ほっこりポテト","",1],[714,"オンバット",0,"とくせんリンゴ","ふといながねぎ","マメミート","",0],[715,"オンバーン",0,"とくせんリンゴ","ふといながねぎ","マメミート","",1],[736,"アゴジムシ",0,"めざましコーヒー","あじわいキノコ","あまいミツ","",0],[737,"デンヂムシ",0,"めざましコーヒー","あじわいキノコ","あまいミツ","",1],[738,"クワガノン",0,"めざましコーヒー","あじわいキノコ","あまいミツ","",2],[742,"アブリー",0,"あまいミツ","ピュアなオイル","ワカクサコーン","",0],[743,"アブリボン",0,"あまいミツ","ピュアなオイル","ワカクサコーン","",1],[759,"ヌイコグマ",0,"ワカクサコーン","マメミート","とくせんエッグ","",0],[760,"キテルグマ",0,"ワカクサコーン","マメミート","とくせんエッグ","",1],[764,"キュワワー",0,"ワカクサコーン","あったかジンジャー","リラックスカカオ","",-1],[777,"トゲデマル",0,"モーモーミルク","つやつやアボカド","リラックスカカオ","",-1],[778,"ミミッキュ",0,"とくせんリンゴ","めざましコーヒー","あじわいキノコ","",-1],[780,"ジジーロン",0,"ワカクサ大豆","つやつやアボカド","マメミート","",-1],[845,"ウッウ",0,"ピュアなオイル","ほっこりポテト","とくせんエッグ","",-1],[848,"エレズン",0,"モーモーミルク","とくせんリンゴ","ふといながねぎ","",0],[849,"ストリンダー (ハイ)",5,"モーモーミルク","とくせんリンゴ","ふといながねぎ","",1],[849,"ストリンダー (ロー)",6,"モーモーミルク","とくせんリンゴ","ふといながねぎ","",1],[906,"ニャオハ",0,"ほっこりポテト","モーモーミルク","あったかジンジャー","",0],[907,"ニャローテ",0,"ほっこりポテト","モーモーミルク","あったかジンジャー","",1],[908,"マスカーニャ",0,"ほっこりポテト","モーモーミルク","あったかジンジャー","",2],[909,"ホゲータ",0,"とくせんリンゴ","マメミート","げきからハーブ","",0],[910,"アチゲータ",0,"とくせんリンゴ","マメミート","げきからハーブ","",1],[911,"ラウドボーン",0,"とくせんリンゴ","マメミート","げきからハーブ","",2],[912,"クワッス",0,"ワカクサ大豆","ふといながねぎ","ピュアなオイル","",0],[913,"ウェルカモ",0,"ワカクサ大豆","ふといながねぎ","ピュアなオイル","",1],[914,"ウェーニバル",0,"ワカクサ大豆","ふといながねぎ","ピュアなオイル","",2],[921,"パモ",0,"リラックスカカオ","モーモーミルク","とくせんエッグ","",0],[922,"パモット",0,"リラックスカカオ","モーモーミルク","とくせんエッグ","",1],[923,"パーモット",0,"リラックスカカオ","モーモーミルク","とくせんエッグ","",2],[974,"アルクジラ",0,"ほっこりポテト","マメミート","ずっしりカボチャ","",0],[975,"ハルクジラ",0,"ほっこりポテト","マメミート","ずっしりカボチャ","",1],[980,"ドオー",4,"リラックスカカオ","めざましコーヒー","ほっこりポテト","",1]]};
	/*DATA_END*/

	// ---------- シリアル変換 (pokesleep_serial.py と同一ロジックの JS 移植) ----------

	function findPokemon(ja) {
		const exact = DATA.pokemons.filter((p) => p[1] === ja);
		if (exact.length === 1) return exact[0];
		const partial = DATA.pokemons.filter((p) => p[1].includes(ja));
		if (partial.length === 1) return partial[0];
		throw new Error(`ポケモン名「${ja}」を特定できません`);
	}

	// p: [id, ja, form, ing1ja, ing2ja, ing3ja, flag, evolutionCount, mythJa[]]
	function ingredientType(p, ings) {
		if (!ings || !ings[0]) throw new Error(`${p[1]} の第1食材が読み取れていません`);
		if (ings[0] !== p[3]) {
			throw new Error(`${p[1]} の第1食材は ${p[3]} のはずですが ${ings[0]} と読み取りました`);
		}
		const letter = (ing, slot) => {
			if (ing === null || ing === undefined) return null;
			if (ing === p[3]) return 'A';
			if (ing === p[4]) return 'B';
			if (ing === p[5] && slot === 2) return 'C';
			throw new Error(`${p[1]} のスロット${slot + 1} に ${ing} は指定できません`);
		};
		let l2 = letter(ings[1], 1);
		let l3 = letter(ings[2], 2);
		if (l2 === null) l2 = 'A';
		if (l3 === null) l3 = p[5] ? 'C' : 'A';
		const t = 'A' + l2 + l3;
		if (!DATA.ingTypes.includes(t)) throw new Error(`不正な食材パターン ${t}`);
		return t;
	}

	function subskillIndex(ja) {
		if (ja === null || ja === undefined || ja === '') return 31;
		const i = DATA.subskills.indexOf(ja);
		if (i < 0) throw new Error(`サブスキル「${ja}」が見つかりません`);
		return i;
	}

	function encode(ind) {
		const p = findPokemon(ind.pokemon);
		const level = Math.trunc(ind.level);
		if (!(level >= 1 && level <= 100)) throw new Error(`レベル ${ind.level} が範囲外です`);
		let skillLevel = ind.skill_level ? Math.trunc(ind.skill_level) : p[7] + 1;
		skillLevel = Math.max(1, Math.min(8, skillLevel));
		const natureIdx = DATA.natures.indexOf(ind.nature);
		if (natureIdx < 0) throw new Error(`せいかく「${ind.nature}」が見つかりません`);
		const subs = (ind.subskills || []).concat([null, null, null, null, null]).slice(0, 5);
		const ss = subs.map(subskillIndex);
		const ingIdx = DATA.ingTypes.indexOf(ingredientType(p, ind.ingredients));
		const ribbon = ind.ribbon || 0;
		const shiny = ind.shiny ? 1 : 0;
		// ミュウ (いろいろ) は既定で Metronome = VersatileCandidates[10] → index 11
		const versatileIdx = p[6] === 'V' ? 11 : 0;

		const a = [0, 0, 0, 0, 0, 0];
		a[0] = 1 | (p[0] << 4);
		a[1] = p[2] | (level << 6) | (ingIdx << 13);
		a[2] = shiny | ((skillLevel - 1) << 2) | (natureIdx << 6) | (ss[0] << 11);
		a[3] = ss[1] | (ss[2] << 5) | (ss[3] << 10);
		a[4] = ss[4] | (ribbon << 5) | (versatileIdx << 8);

		const mythical = p[6] === 'M';
		if (mythical) {
			const myth = (ind.myth_ingredients || []).concat([null, null, null]).slice(0, 3);
			const n = p[8].length + 1;
			const idx = myth.map((m) => {
				if (m === null || m === undefined) return 0;
				const i = p[8].indexOf(m);
				if (i < 0) throw new Error(`${p[1]} の食材に ${m} は指定できません`);
				return i + 1;
			});
			a[5] = idx[0] + idx[1] * n + idx[2] * n * n;
		}

		const buf = new ArrayBuffer(12);
		const view = new DataView(buf);
		for (let i = 0; i < 6; i++) view.setUint16(i * 2, a[i], true);
		let bin = '';
		for (const b of new Uint8Array(buf)) bin += String.fromCharCode(b);
		return btoa(bin).replace(/\//g, '-').substring(0, mythical ? 16 : 12);
	}

	// 追加前の自己検証用に decode も持つ (encode と往復一致を確認する)
	function decode(serial) {
		let b64;
		if (serial.length === 12) b64 = serial.replace(/-/g, '/') + 'AAAA';
		else if (serial.length === 16) b64 = serial.replace(/-/g, '/');
		else throw new Error(`シリアル長 ${serial.length} が不正です`);
		const bin = atob(b64);
		const buf = new ArrayBuffer(12);
		const u8 = new Uint8Array(buf);
		for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
		const view = new DataView(buf);
		const a = [];
		for (let i = 0; i < 6; i++) a.push(view.getUint16(i * 2, true));
		if ((a[0] & 0xf) !== 1) throw new Error('バージョンが不正です');
		let pid = a[0] >> 4;
		if (pid === 231) pid = 213; // Shuckle ID 移行 (ツール側と同じ)
		const form = a[1] & 0x3f;
		const cands = DATA.pokemons.filter((p) => p[0] === pid);
		if (cands.length === 0) throw new Error(`ID ${pid} のポケモンが見つかりません`);
		const p = cands.find((c) => c[2] === form) || cands[0];
		const ss = [
			(a[2] >> 11) & 31,
			a[3] & 31, (a[3] >> 5) & 31, (a[3] >> 10) & 31,
			a[4] & 31,
		];
		const ingType = DATA.ingTypes[(a[1] >> 13) & 0x7];
		const slotMap = { A: p[3], B: p[4], C: p[5] };
		return {
			pokemon: p[1],
			level: (a[1] >> 6) & 0x7f,
			skill_level: ((a[2] >> 2) & 0x7) + 1,
			nature: DATA.natures[(a[2] >> 6) & 31],
			subskills: ss.map((i) => (i === 31 ? null : DATA.subskills[i])),
			ingredient_type: ingType,
			ingredients: ingType.split('').map((c) => slotMap[c] ?? null),
			shiny: (a[2] & 1) !== 0,
			ribbon: (a[4] >> 5) & 7,
		};
	}

	// node からロジックを検証できるように公開し、UI 部分はブラウザのみ実行
	const Serial = { DATA, findPokemon, ingredientType, encode, decode };
	if (typeof module !== 'undefined' && module.exports) {
		module.exports = Serial;
		return;
	}

	// iOS の「ホーム画面に追加」は manifest の display:standalone により独立 Web アプリ化し、
	// Safari 拡張が動かず localStorage も別コンテナになって同期できない。
	// manifest を DOM から外し、ホーム画面追加を「Safari で開くブックマーク」に落とす
	const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
		(navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
	if (isIOS) {
		for (const el of document.querySelectorAll('link[rel="manifest"]')) el.remove();
		console.log('[pst] iOS: manifest を除去 (ホーム画面追加が Safari ブックマークになる)');
	}

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

	// ---------- AI 読取 (Gemini / Claude) ----------

	function loadOcrCfg() {
		return loadJson(OCR_CFG_KEY) || {};
	}

	function buildPrompt() {
		return [
			'ポケモンスリープの個体詳細画面のスクリーンショットから、写っている1匹の情報を読み取れ。',
			'',
			'- pokemon: 種族名 (カタカナ)。上部の名前がニックネームに変更されている場合も、姿・食材アイコンから種族名を判定する',
			'- nickname: 表示されている名前が種族名と異なる場合のみその表示名。同じなら null',
			'- level: 名前の横の Lv. の数値',
			'- ingredients: 食材欄の3スロットを左から順に日本語名で。Lv.30 / Lv.60 のロック付きスロットもアイコンは見えるので判定する。' +
				'スロット自体が写っていなければ null。名前は次のいずれか: ' + DATA.ingredients.join(', '),
			'- skill_level: メインスキル枠の右上の Lv. の数値。見えなければ null',
			'- subskills: サブスキル5枠を [Lv10(左上), Lv25(右上), Lv50(左中), Lv70(右中), Lv80(左下)] の順で。' +
				'ロック中 (鍵アイコン付き) でも名前は読める。読めない枠は null。名前は次のいずれか: ' + DATA.subskills.join(', '),
			'- nature: せいかく欄の名前。見えなければ null。名前は次のいずれか: ' + DATA.natures.join(', '),
			'- ribbon: 「一緒に眠った時間」が写っていれば 0=200時間未満, 1=200時間以上, 2=500時間以上, 3=1000時間以上, 4=2000時間以上。写っていなければ null',
			'- shiny: 色違いだと確実に分かる場合のみ true。不明なら null',
		].join('\n');
	}

	// Claude 用 (JSON Schema)
	const CLAUDE_SCHEMA = {
		type: 'object',
		properties: {
			pokemon: { type: 'string' },
			nickname: { type: ['string', 'null'] },
			level: { type: 'integer' },
			ingredients: { type: 'array', items: { type: ['string', 'null'] } },
			skill_level: { type: ['integer', 'null'] },
			subskills: { type: 'array', items: { type: ['string', 'null'] } },
			nature: { type: ['string', 'null'] },
			ribbon: { type: ['integer', 'null'] },
			shiny: { type: ['boolean', 'null'] },
		},
		required: ['pokemon', 'nickname', 'level', 'ingredients', 'skill_level',
			'subskills', 'nature', 'ribbon', 'shiny'],
		additionalProperties: false,
	};

	// Gemini 用 (OpenAPI サブセット形式・nullable 指定)
	const GEMINI_SCHEMA = {
		type: 'OBJECT',
		properties: {
			pokemon: { type: 'STRING' },
			nickname: { type: 'STRING', nullable: true },
			level: { type: 'INTEGER' },
			ingredients: { type: 'ARRAY', items: { type: 'STRING', nullable: true } },
			skill_level: { type: 'INTEGER', nullable: true },
			subskills: { type: 'ARRAY', items: { type: 'STRING', nullable: true } },
			nature: { type: 'STRING', nullable: true },
			ribbon: { type: 'INTEGER', nullable: true },
			shiny: { type: 'BOOLEAN', nullable: true },
		},
		required: ['pokemon', 'level', 'ingredients', 'subskills'],
	};

	async function callClaude(cfg, jpegBase64) {
		const res = await fetch('https://api.anthropic.com/v1/messages', {
			method: 'POST',
			headers: {
				'x-api-key': cfg.claudeKey,
				'anthropic-version': '2023-06-01',
				'anthropic-dangerous-direct-browser-access': 'true',
				'content-type': 'application/json',
			},
			body: JSON.stringify({
				model: cfg.model,
				max_tokens: 2000,
				messages: [{
					role: 'user',
					content: [
						{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: jpegBase64 } },
						{ type: 'text', text: buildPrompt() },
					],
				}],
				output_config: { format: { type: 'json_schema', schema: CLAUDE_SCHEMA } },
			}),
		});
		if (!res.ok) {
			const body = await res.text();
			throw new Error(`Claude API エラー ${res.status}: ${body.slice(0, 300)}`);
		}
		const json = await res.json();
		if (json.stop_reason === 'refusal') throw new Error('API が読取を拒否しました');
		const text = (json.content || []).find((b) => b.type === 'text');
		if (!text) throw new Error('API 応答にテキストがありません');
		return JSON.parse(text.text);
	}

	// 指定モデルが廃止されていたとき用: 利用可能なモデルから現行の flash 系を選ぶ
	async function pickCurrentGeminiModel(key) {
		const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', {
			headers: { 'x-goog-api-key': key },
		});
		if (!res.ok) throw new Error(`モデル一覧の取得に失敗しました (${res.status})`);
		const json = await res.json();
		const names = (json.models || [])
			.filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
			.map((m) => m.name.replace(/^models\//, ''))
			.filter((n) => /^gemini-[\d.]+-flash(-lite)?(-preview)?$/.test(n));
		if (names.length === 0) throw new Error('利用可能な Gemini flash モデルが見つかりません');
		// 安定版 flash > preview 版 flash > flash-lite の順に、バージョンが新しいものを選ぶ
		const ver = (n) => parseFloat((n.match(/^gemini-([\d.]+)/) || [])[1] || '0');
		const rank = (n) => (/-lite/.test(n) ? 0 : /-preview$/.test(n) ? 1 : 2);
		names.sort((a, b) => (rank(b) - rank(a)) || (ver(b) - ver(a)));
		return names[0];
	}

	async function callGemini(cfg, jpegBase64, isRetry) {
		const url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
			encodeURIComponent(cfg.model) + ':generateContent';
		const res = await fetch(url, {
			method: 'POST',
			headers: {
				'x-goog-api-key': cfg.geminiKey,
				'content-type': 'application/json',
			},
			body: JSON.stringify({
				contents: [{
					role: 'user',
					parts: [
						{ inline_data: { mime_type: 'image/jpeg', data: jpegBase64 } },
						{ text: buildPrompt() },
					],
				}],
				generationConfig: {
					responseMimeType: 'application/json',
					responseSchema: GEMINI_SCHEMA,
					temperature: 0,
				},
			}),
		});
		if (!res.ok) {
			const body = await res.text();
			if (res.status === 429) throw new Error('Gemini 無料枠の上限に達しました。少し待つか翌日に再実行してください');
			// モデル廃止 (404) は現行モデルへ自動で切り替えて1回だけ再試行する
			if (res.status === 404 && !isRetry) {
				const newModel = await pickCurrentGeminiModel(cfg.geminiKey);
				const saved = loadOcrCfg();
				saved.model = newModel;
				saveJson(OCR_CFG_KEY, saved);
				ocrLog(`モデルを ${newModel} に自動切替しました`);
				return callGemini({ ...cfg, model: newModel }, jpegBase64, true);
			}
			throw new Error(`Gemini API エラー ${res.status}: ${body.slice(0, 300)}`);
		}
		const json = await res.json();
		const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('');
		if (!text) throw new Error('Gemini 応答にテキストがありません');
		return JSON.parse(text);
	}

	function extractFromImage(cfg, jpegBase64) {
		return cfg.model.startsWith('gemini')
			? callGemini(cfg, jpegBase64)
			: callClaude(cfg, jpegBase64);
	}

	// 画像を JPEG (base64) に変換。PNG のまま送るより転送量が小さい
	function fileToJpegBase64(file) {
		return new Promise((resolve, reject) => {
			const img = new Image();
			const url = URL.createObjectURL(file);
			img.onload = () => {
				URL.revokeObjectURL(url);
				const canvas = document.createElement('canvas');
				canvas.width = img.naturalWidth;
				canvas.height = img.naturalHeight;
				canvas.getContext('2d').drawImage(img, 0, 0);
				const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
				resolve(dataUrl.split(',')[1]);
			};
			img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('画像を読み込めません')); };
			img.src = url;
		});
	}

	function addToBox(lines) {
		let box = loadJson(BOX_KEY);
		if (!Array.isArray(box)) box = [];
		const added = [];
		for (const line of lines) {
			if (!box.includes(line)) {
				box.push(line);
				added.push(line);
			}
		}
		if (added.length > 0) saveJson(BOX_KEY, box);
		return added;
	}

	// ---------- 状態表示バッジ (唯一のボタン) ----------

	let badge = null;
	let lastStatus = { state: 'busy', title: '' };

	function setStatus(state, title) {
		lastStatus = { state, title: title || '' };
		if (!badge) {
			badge = document.createElement('div');
			badge.id = 'pst-badge';
			badge.style.cssText =
				'position:fixed;right:8px;bottom:8px;z-index:99999;' +
				'font:12px/1 sans-serif;padding:6px 10px;border-radius:12px;' +
				'background:rgba(0,0,0,.55);color:#fff;cursor:pointer;user-select:none;';
			// バッジはトグル: 開いていれば閉じる (読取の続きは保持し、再度開くと復元される)
			badge.addEventListener('click', () => {
				const p = document.getElementById('pst-panel');
				if (p) p.remove();
				else openPanel();
			});
			document.body.appendChild(badge);
		}
		const marks = { ok: '☁✓', busy: '☁…', dirty: '☁●', error: '☁!', setup: '☁設定' };
		badge.textContent = (marks[state] || state) + ' 📷';
		badge.title = title || '';
		badge.style.background = state === 'error' ? 'rgba(180,30,30,.8)' : 'rgba(0,0,0,.55)';
		// パネルのメインタブにも状態を映す
		const el = document.getElementById('pst-sync-state');
		if (el) el.textContent = syncStateText();
	}

	function syncStateText() {
		const labels = {
			ok: '同期済み', busy: '通信中...', dirty: '未送信の変更あり',
			error: 'エラー', setup: '未設定 (Git設定タブで設定)',
		};
		const base = labels[lastStatus.state] || lastStatus.state;
		return lastStatus.title ? `${base} — ${lastStatus.title}` : base;
	}

	// ---------- パネル (3タブ) ----------

	function ocrLog(msg) {
		const el = document.getElementById('pst-log');
		if (el) el.textContent = msg;
	}

	function openPanel(initialTab) {
		const existing = document.getElementById('pst-panel');
		if (existing) {
			if (initialTab) switchTab(initialTab);
			return;
		}
		const gh = loadJson(CONFIG_KEY) || {};
		const ocr = loadOcrCfg();
		const panel = document.createElement('div');
		panel.id = 'pst-panel';
		panel.style.cssText =
			'position:fixed;right:8px;bottom:40px;z-index:99999;width:300px;max-height:75vh;overflow:auto;' +
			'font:13px/1.6 sans-serif;padding:12px;border-radius:8px;' +
			'background:#fff;color:#222;box-shadow:0 2px 12px rgba(0,0,0,.4);';
		const modelOptions = Object.entries(MODELS).map(([id, label]) =>
			`<option value="${id}"${(ocr.model || DEFAULT_MODEL) === id ? ' selected' : ''}>${label}</option>`).join('');
		const tabBtn = (id, label) =>
			`<button class="pst-tab" data-tab="${id}" style="flex:1;padding:4px 0;border:none;border-bottom:2px solid transparent;background:none;cursor:pointer">${label}</button>`;
		panel.innerHTML = `
			<div style="display:flex;gap:2px;margin-bottom:8px;border-bottom:1px solid #ddd">
				${tabBtn('main', 'メイン')}${tabBtn('git', 'Git設定')}${tabBtn('api', 'API設定')}
			</div>

			<div class="pst-tabbody" id="pst-tab-main">
				<b>スクショ取込</b>
				<div style="margin:4px 0"><button id="pst-pick">画像を選ぶ</button></div>
				<input id="pst-file" type="file" accept="image/*" multiple style="display:none">
				<div id="pst-log" style="white-space:pre-wrap"></div>
				<div id="pst-result"></div>
				<hr style="margin:10px 0">
				<b>GitHub 同期</b>
				<div>状態: <span id="pst-sync-state">${syncStateText()}</span></div>
				<div style="margin-top:4px;display:flex;gap:6px;flex-wrap:wrap">
					<button id="pst-pull">GitHub から取得</button>
					<button id="pst-push">GitHub へ送信</button>
				</div>
			</div>

			<div class="pst-tabbody" id="pst-tab-git" style="display:none">
				<b>GitHub 同期設定</b><br>
				<label>一括貼り付け (JSON・任意)<br><textarea id="pst-gh-bulk" rows="2" style="width:100%"
					placeholder='{"token":"github_pat_...","owner":"...","repo":"...","path":"...","branch":"main"}'></textarea></label>
				<label>Token<br><input id="pst-gh-token" type="password" style="width:100%" value="${gh.token || ''}"></label>
				<label>Owner<br><input id="pst-gh-owner" style="width:100%" value="${gh.owner || ''}"></label>
				<label>Repo<br><input id="pst-gh-repo" style="width:100%" value="${gh.repo || ''}"></label>
				<label>Path<br><input id="pst-gh-path" style="width:100%" value="${gh.path || ''}"></label>
				<label>Branch<br><input id="pst-gh-branch" style="width:100%" value="${gh.branch || 'main'}"></label>
				<div style="margin-top:8px"><button id="pst-gh-save">保存して同期</button></div>
			</div>

			<div class="pst-tabbody" id="pst-tab-api" style="display:none">
				<b>AI 読取設定</b><br>
				<label>モデル<br><select id="pst-model" style="width:100%">${modelOptions}</select></label>
				<label>Gemini API キー (aistudio.google.com で無料発行)<br>
					<input id="pst-gemini-key" type="password" style="width:100%" value="${ocr.geminiKey || ''}"></label>
				<label>Claude API キー (有料モデル利用時のみ)<br>
					<input id="pst-claude-key" type="password" style="width:100%" value="${ocr.claudeKey || ''}"></label>
				<div style="margin-top:8px"><button id="pst-api-save">保存</button></div>
			</div>

			<div style="margin-top:10px;text-align:right"><button id="pst-close">閉じる</button></div>`;
		document.body.appendChild(panel);

		for (const btn of panel.querySelectorAll('.pst-tab')) {
			btn.addEventListener('click', () => switchTab(btn.getAttribute('data-tab')));
		}
		switchTab(initialTab || 'main');

		document.getElementById('pst-close').addEventListener('click', () => {
			localStorage.removeItem(PENDING_KEY); // 続き待ちの読取結果も破棄する
			panel.remove();
		});

		// --- メイン: 同期操作 ---
		document.getElementById('pst-pull').addEventListener('click', () => forcePull());
		document.getElementById('pst-push').addEventListener('click', () => forcePush());

		// --- メイン: スクショ取込 ---
		document.getElementById('pst-pick').addEventListener('click', () => {
			if (!saveOcrCfgFromForm()) return;
			document.getElementById('pst-file').click();
		});
		document.getElementById('pst-file').addEventListener('change', (ev) => {
			const files = [...ev.target.files];
			if (files.length > 0) processFiles(files);
			ev.target.value = '';
		});

		// --- Git設定 ---
		document.getElementById('pst-gh-save').addEventListener('click', async () => {
			const val = (id) => document.getElementById(id).value.trim();
			let cfg;
			const bulk = val('pst-gh-bulk');
			if (bulk !== '') {
				try {
					const j = JSON.parse(bulk);
					cfg = {
						token: j.token || '', owner: j.owner || '',
						repo: j.repo || '', path: j.path || '', branch: j.branch || 'main',
					};
				} catch (e) {
					alert('一括貼り付けの JSON を解釈できません: ' + e);
					return;
				}
			} else {
				cfg = {
					token: val('pst-gh-token'), owner: val('pst-gh-owner'),
					repo: val('pst-gh-repo'), path: val('pst-gh-path'), branch: val('pst-gh-branch'),
				};
			}
			saveJson(CONFIG_KEY, cfg);
			panel.remove();
			await bootSync();
		});

		// --- API設定 ---
		document.getElementById('pst-api-save').addEventListener('click', () => {
			if (saveOcrCfgFromForm()) switchTab('main');
		});

		// 読取の続き (キュー) が残っていれば一覧を復元する
		const pending = loadJson(PENDING_KEY);
		if (Array.isArray(pending) && pending.length > 0) {
			ocrLog('前回の読取の続きです。1匹ずつ編集画面で開いて追加してください');
			showResults(pending);
		}
	}

	function switchTab(tab) {
		for (const div of document.querySelectorAll('.pst-tabbody')) {
			div.style.display = div.id === `pst-tab-${tab}` ? '' : 'none';
		}
		for (const btn of document.querySelectorAll('.pst-tab')) {
			const active = btn.getAttribute('data-tab') === tab;
			btn.style.borderBottom = active ? '2px solid #47f' : '2px solid transparent';
			btn.style.fontWeight = active ? 'bold' : 'normal';
		}
	}

	// API設定タブの入力を検証して保存する。モデルに必要なキーが無ければ false
	function saveOcrCfgFromForm() {
		const model = document.getElementById('pst-model').value;
		const geminiKey = document.getElementById('pst-gemini-key').value.trim();
		const claudeKey = document.getElementById('pst-claude-key').value.trim();
		if (model.startsWith('gemini') && !geminiKey) {
			switchTab('api');
			alert('Gemini API キーを入力してください (aistudio.google.com で無料発行)');
			return false;
		}
		if (model.startsWith('claude') && !claudeKey) {
			switchTab('api');
			alert('Claude API キーを入力してください');
			return false;
		}
		saveJson(OCR_CFG_KEY, { model, geminiKey, claudeKey });
		return true;
	}

	// ---------- スクショ取込フロー ----------

	async function processFiles(files) {
		const cfg = loadOcrCfg();
		const results = [];   // {line, summary} or {error, name}
		for (let i = 0; i < files.length; i++) {
			ocrLog(`読取中... ${i + 1}/${files.length}`);
			try {
				const b64 = await fileToJpegBase64(files[i]);
				const ind = await extractFromImage(cfg, b64);
				const serial = encode(ind);
				// 自己検証: decode して読取値と主要項目が一致するか確認
				const d = decode(serial);
				if (d.pokemon !== findPokemon(ind.pokemon)[1] || d.level !== ind.level) {
					throw new Error('変換の自己検証に失敗しました');
				}
				const line = ind.nickname ? `${serial}@${ind.nickname}` : serial;
				results.push({
					line,
					summary: `${d.pokemon} Lv.${d.level} ${d.nature} ` +
						`[${d.subskills.map((s) => s || '?').join(' / ')}] 食材${d.ingredient_type}`,
				});
			} catch (e) {
				results.push({ error: String(e.message || e), name: files[i].name });
			}
		}
		const ok = results.filter((r) => r.line);
		const ng = results.filter((r) => r.error);
		// 1匹だけ読めてエラーもないときは、そのまま編集画面へ
		if (ok.length === 1 && ng.length === 0) {
			openInEditor(ok[0], []);
			return;
		}
		showResults(results);
	}

	// 読取結果1匹をツールの編集フォーム (ポケモンタブ) に読み込む。
	// #p=シリアル はツール自身の共有 URL 機能で、起動時にフォームへ反映される。
	// 追加はツール純正のメニュー「ボックスに追加」から行う (ニックネームもそこで入力)
	function openInEditor(item, remaining) {
		try {
			// 再読み込み後にポケモンタブ (編集フォーム) が前面になるようにする
			const st = loadJson('PstIvState') || {};
			st.lowerTabIndex = 0;
			saveJson('PstIvState', st);
		} catch (e) { /* 無視 */ }
		if (remaining.length > 0) {
			saveJson(PENDING_KEY, remaining);
		} else {
			localStorage.removeItem(PENDING_KEY);
		}
		location.hash = '#p=' + item.line.split('@')[0];
		location.reload();
	}

	function showResults(results) {
		ocrLog('');
		const div = document.getElementById('pst-result');
		if (!div) return;
		const ok = results.filter((r) => r.line);
		const ng = results.filter((r) => r.error);
		const nick = (r) => {
			const i = r.line.indexOf('@');
			return i < 0 ? '' : `<br><small>ニックネーム候補: ${r.line.slice(i + 1)} (追加時に入力)</small>`;
		};
		div.innerHTML =
			ok.map((r, i) =>
				`<div style="margin:4px 0;padding:4px;background:#eef">${r.summary}${nick(r)}<br>` +
				`<button class="pst-edit" data-i="${i}">編集画面で開く</button></div>`).join('') +
			ng.map((r) => `<div style="margin:4px 0;padding:4px;background:#fee">${r.name}: ${r.error}</div>`).join('') +
			(ok.length > 0
				? `<div style="margin-top:8px"><button id="pst-add">${ok.length}匹を確認せず直接追加</button></div>`
				: '');
		for (const btn of div.querySelectorAll('.pst-edit')) {
			btn.addEventListener('click', () => {
				const i = Number(btn.getAttribute('data-i'));
				openInEditor(ok[i], ok.filter((_, j) => j !== i));
			});
		}
		const addBtn = document.getElementById('pst-add');
		if (addBtn) {
			addBtn.addEventListener('click', () => {
				const added = addToBox(ok.map((r) => r.line));
				localStorage.removeItem(PENDING_KEY);
				ocrLog(`${added.length} 匹を追加しました。再読み込みします...`);
				// アプリは起動時に localStorage を読むため反映には再読み込みが必要。
				// 再読み込み後、同期処理が GitHub へ自動 push する
				setTimeout(() => location.reload(), 800);
			});
		}
	}

	// 編集画面へ移動した後の残り (キュー) があればパネルを自動再表示する
	// (一覧の復元は openPanel 自身が行う)
	function resumePending() {
		const pending = loadJson(PENDING_KEY);
		if (!Array.isArray(pending) || pending.length === 0) return;
		openPanel('main');
	}

	// ---------- 同期本体 ----------

	let syncing = false;

	async function forcePull() {
		const cfg = loadJson(CONFIG_KEY);
		if (!cfg || !cfg.token) { setStatus('setup', 'Git設定が未入力です'); return; }
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
		if (!cfg || !cfg.token) { setStatus('setup', 'Git設定が未入力です'); return; }
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
				setStatus('error', '他の更新と競合。パネルから「取得」か「送信」を選んでください');
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

	async function bootSync() {
		const cfg = loadJson(CONFIG_KEY);
		if (!cfg || !cfg.token || !cfg.owner || !cfg.repo || !cfg.path) {
			setStatus('setup', 'タップして GitHub 同期を設定');
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

	function boot() {
		console.log('[pst] boot');
		bootSync();
		resumePending();
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', boot);
	} else {
		boot();
	}
})();
