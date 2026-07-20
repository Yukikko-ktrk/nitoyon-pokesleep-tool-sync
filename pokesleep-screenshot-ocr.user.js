// ==UserScript==
// @name         PokeSleep Screenshot Import (AI OCR)
// @namespace    pokesleep-screenshot-import
// @version      1.0.0
// @description  ポケスリのスクショを Gemini (無料枠) / Claude API の vision で読み取り、個体をボックスへ追加する
// @match        https://nitoyon.github.io/pokesleep-tool/*
// @grant        none
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/Yukikko-ktrk/nitoyon-pokesleep-tool-sync/main/pokesleep-screenshot-ocr.user.js
// @downloadURL  https://raw.githubusercontent.com/Yukikko-ktrk/nitoyon-pokesleep-tool-sync/main/pokesleep-screenshot-ocr.user.js
// ==/UserScript==

(function () {
	'use strict';

	const BOX_KEY = 'PstPokeBox';       // 同期スクリプトと同じボックス
	const CFG_KEY = 'PstOcrConfig';     // {model, geminiKey, claudeKey}
	const DEFAULT_MODEL = 'gemini-2.5-flash';
	// モデル一覧。gemini-* は Google AI Studio の無料枠で使える
	const MODELS = {
		'gemini-2.5-flash': 'Gemini Flash (無料枠・推奨)',
		'gemini-2.5-pro': 'Gemini Pro (無料枠・高精度だが回数少)',
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

	// ---------- Claude API (vision) ----------

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

	async function callGemini(cfg, jpegBase64) {
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

	// ---------- ボックス操作 ----------

	function addToBox(lines) {
		let box;
		try {
			box = JSON.parse(localStorage.getItem(BOX_KEY)) || [];
		} catch (e) {
			box = [];
		}
		const added = [];
		for (const line of lines) {
			if (!box.includes(line)) {
				box.push(line);
				added.push(line);
			}
		}
		if (added.length > 0) localStorage.setItem(BOX_KEY, JSON.stringify(box));
		return added;
	}

	// ---------- UI ----------

	function loadCfg() {
		try {
			return JSON.parse(localStorage.getItem(CFG_KEY)) || {};
		} catch (e) {
			return {};
		}
	}

	const ui = {};

	function makeButton() {
		const btn = document.createElement('div');
		btn.id = 'ocr-btn';
		btn.textContent = '📷取込';
		btn.style.cssText =
			'position:fixed;left:8px;bottom:8px;z-index:99999;' +
			'font:12px/1 sans-serif;padding:6px 10px;border-radius:12px;' +
			'background:rgba(0,0,0,.55);color:#fff;cursor:pointer;user-select:none;';
		btn.addEventListener('click', openPanel);
		document.body.appendChild(btn);
	}

	function openPanel() {
		if (document.getElementById('ocr-panel')) return;
		const cfg = loadCfg();
		const panel = document.createElement('div');
		panel.id = 'ocr-panel';
		panel.style.cssText =
			'position:fixed;left:8px;bottom:40px;z-index:99999;width:300px;max-height:70vh;overflow:auto;' +
			'font:13px/1.6 sans-serif;padding:12px;border-radius:8px;' +
			'background:#fff;color:#222;box-shadow:0 2px 12px rgba(0,0,0,.4);';
		const modelOptions = Object.entries(MODELS).map(([id, label]) =>
			`<option value="${id}"${(cfg.model || DEFAULT_MODEL) === id ? ' selected' : ''}>${label}</option>`).join('');
		panel.innerHTML = `
			<b>スクショ取込 (AI 読取)</b><br>
			<label>モデル<br><select id="ocr-model" style="width:100%">${modelOptions}</select></label>
			<label>Gemini API キー (aistudio.google.com で無料発行)<br>
				<input id="ocr-gemini-key" type="password" style="width:100%" value="${cfg.geminiKey || ''}"></label>
			<label>Claude API キー (有料モデル利用時のみ)<br>
				<input id="ocr-claude-key" type="password" style="width:100%" value="${cfg.claudeKey || ''}"></label>
			<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">
				<button id="ocr-pick">画像を選ぶ</button>
				<button id="ocr-close">閉じる</button>
			</div>
			<input id="ocr-file" type="file" accept="image/*" multiple style="display:none">
			<div id="ocr-log" style="margin-top:8px;white-space:pre-wrap"></div>
			<div id="ocr-result"></div>`;
		document.body.appendChild(panel);
		ui.log = (msg) => { document.getElementById('ocr-log').textContent = msg; };

		document.getElementById('ocr-close').addEventListener('click', () => panel.remove());
		document.getElementById('ocr-pick').addEventListener('click', () => {
			const model = document.getElementById('ocr-model').value;
			const geminiKey = document.getElementById('ocr-gemini-key').value.trim();
			const claudeKey = document.getElementById('ocr-claude-key').value.trim();
			if (model.startsWith('gemini') && !geminiKey) { ui.log('Gemini API キーを入力してください'); return; }
			if (model.startsWith('claude') && !claudeKey) { ui.log('Claude API キーを入力してください'); return; }
			localStorage.setItem(CFG_KEY, JSON.stringify({ model, geminiKey, claudeKey }));
			document.getElementById('ocr-file').click();
		});
		document.getElementById('ocr-file').addEventListener('change', (ev) => {
			const files = [...ev.target.files];
			if (files.length > 0) processFiles(files);
			ev.target.value = '';
		});
	}

	async function processFiles(files) {
		const cfg = loadCfg();
		const results = [];   // {line, summary} or {error, name}
		for (let i = 0; i < files.length; i++) {
			ui.log(`読取中... ${i + 1}/${files.length}`);
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
		showResults(results);
	}

	function showResults(results) {
		ui.log('');
		const div = document.getElementById('ocr-result');
		if (!div) return;
		const ok = results.filter((r) => r.line);
		const ng = results.filter((r) => r.error);
		div.innerHTML =
			ok.map((r) => `<div style="margin:4px 0;padding:4px;background:#eef">${r.summary}</div>`).join('') +
			ng.map((r) => `<div style="margin:4px 0;padding:4px;background:#fee">${r.name}: ${r.error}</div>`).join('') +
			(ok.length > 0
				? `<div style="margin-top:8px"><button id="ocr-add">${ok.length}匹をボックスへ追加</button></div>`
				: '');
		const addBtn = document.getElementById('ocr-add');
		if (addBtn) {
			addBtn.addEventListener('click', () => {
				const added = addToBox(ok.map((r) => r.line));
				ui.log(`${added.length} 匹を追加しました。再読み込みします...`);
				// アプリは起動時に localStorage を読むため反映には再読み込みが必要。
				// 再読み込み後、同期スクリプトが GitHub へ自動 push する
				setTimeout(() => location.reload(), 800);
			});
		}
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', makeButton);
	} else {
		makeButton();
	}
})();
