# Dark Ghoul AT Simulator

This project implements a **fully client‑side slot simulator** inspired by so‑called "スマスロ" machines. The aim is to reproduce the *hand feel* of a modern battle‑type AT machine while remaining independent of any proprietary artwork or audio. Everything is written in plain HTML/CSS/JavaScript—there is no build step. The simulator is designed for personal use and research; you can host it on GitHub Pages or run it locally by opening `index.html` in a modern mobile or desktop browser.

## 機能概要

- **スマホ縦画面対応**: UI elements scale sensibly in portrait orientation. The top bar shows credits, bet, current difference and (in debug mode) the internal state.
- **手動/自動操作**: `BET`、`レバー`、停止ボタン3つ、`AUTO`、`SKIP`、`MENU`を備えています。`AUTO`は連続試行、`SKIP`は演出短縮です。
- **内部状態の再現**: 通常、赫眼、高確、前兆、CZ（2種）、エピソードボーナス、AT、上位AT、バトル、特化ゾーン、ジャッジメントの各状態を用意しています。抽選値は `machine-config.js` にまとめてあり、設定1〜6の確率差もこのファイルで変更できます。
- **演出強化**: 外部映像に頼らず、Canvas で動的にノイズと色味を変化させて "液晶" 背景を生成します。状態遷移に応じて色が変わり、日本語のメッセージオーバーレイと★による期待度表示が挿入されます。強レア役や勝利時には画面が揺れる演出もあります。
- **セーブ/ロード**: `保存`/`読込` メニューからローカルストレージに最大3つのスロット状態を保存・復元できます。保存したデータには乱数シードも含まれており、同じ進行を再現できます。
- **統計表示**: 総回転数、CZ突入・突破回数、AT突入回数、バトル勝利回数、特化ゾーン回数、上位モード突入回数などを集計し表示します。
- **デバッグモード**: トップバーに内部状態を表示し、設定や乱数シードを確認できます。チェックボックスでオン/オフ可能です。

## ファイル構成

| ファイル | 内容 |
|---------|-----|
| `index.html` | アプリケーションの骨格となるHTML。各種ボタン、液晶表示、リール表示、モーダルを定義しています。 |
| `style.css` | ダークテーマ、グリッチ感のある色合い、メッセージ・スターオーバーレイ、モーダルなどのスタイルを定義しています。 |
| `machine-config.js` | 機械スペックや設定差、小役確率、バトル分布、特化ゾーン仕様、動画プレセットなどを集約しています。ここを書き換えれば数値の差し替えができます。 |
| `app.js` | PRNG・加重乱数、状態遷移ロジック、UI更新、メッセージ表示、セーブ/ロード処理などのメイン実装。 |
| `assets/` | ユーザーが用意した動画や画像を置くためのディレクトリ。デフォルトでは空です。動画が存在しない場合、Canvas グリッチが自動的に使用されます。 |
| `README.md` | このファイル。使用方法や改造ポイントを記載しています。 |

## カスタマイズ方法

1. **確率・テーブルの変更**: `machine-config.js` を開き、`settings` 配列や `roles`、`battleDistribution`、`zoneTypes` を編集します。例えば設定3のCZ確率を上げたい場合は `czProbability: 1 / 200` のように変更します。
2. **演出用映像の追加**: `assets/video/` 以下に `WebM` や `MP4` ファイルを置き、`machine-config.js` の `videoPresets` にファイル名を追加します。ファイルが存在しない場合は内蔵のグリッチCanvasが使われるため、動画が必須というわけではありません。
3. **メッセージや期待度演出の調整**: `app.js` の `showMessage()` や各状態遷移メソッド内で呼び出している `showMessage()` の引数を変更すると、表示される日本語テキストや★の数を自由にカスタマイズできます。
4. **追加ゾーンやバトル仕様**: `machine-config.js` の `zoneTypes` や `battleDistribution` にエントリを追加し、`app.js` の `enterZone()` や `enterBattle()` 呼び出しにそのキーを渡すように変更すれば、新しい特化ゾーンを組み込めます。

## ライセンスとクレジット

このシミュレータは個人利用を想定しており、商用機のコピーや版権のある映像・音声は一切含んでいません。外部の素材を追加する場合は必ずそのライセンスを確認してください。以下のような無料動画を例として利用できます。

| 動画素材 | 出典・ライセンス |
|--------|-----------------|
| Glitch Overlay Particles, Green Wiggle Glitch Texture, Psychedelic Cloud, Hypnotic Circles | Free Stock Footage Archive で提供され、Creative Commons CC BY 4.0 ライセンスの下で使用できます。個人・商用どちらでも無料で利用でき、クレジット表記が必要です【131317271297058†L67-L86】【796810408310993†L70-L82】【146142594557437†L71-L80】【710184536521551†L76-L82】。 |

なお、当リポジトリには動画ファイルを同梱していません。各自で合法的に取得した素材を `assets/video/` に配置し、`machine-config.js` の `videoPresets` を編集してください。

## 状態遷移図（概要）

```
NORMAL → PRE_CZ → CZ → (AT or NORMAL)
       ↘
        → EPISODE → AT
          ↘
           → KAKUGAN → NORMAL

AT → BATTLE (win→ZONE / lose→AT)
  ↘
   → ZONE (継続または終了→AT)
  ↘
   → 残差枚数0 → JUDGMENT (success→UPPER_AT / fail→NORMAL)

UPPER_AT は AT と同様の流れだが勝率や強レア役確率が上昇しています。
```

この図は簡略化したものですが、実装内ではさらに細かなカウンタや内部変数で遷移管理を行っています。

## 注意事項

- このシミュレータは教育・研究用途を目的としており、実機の正確な挙動を保証するものではありません。公営ギャンブルや賭博行為とは関係ありません。
- 商用機種の名称・演出文言・画像・音源・ロゴ等は使用していません。ユーザー側で追加する場合は版権侵害にならないよう十分に注意してください。
- ブラウザの制約上、ユーザーの操作があるまでは動画や音声が再生されない場合があります。演出を有効にするには一度画面をタップしてください。

---

個人利用向けに **自由に改造可能** な差し替え式ローカルシミュレータです。設定や演出を調整し、自分だけの「最強のダーク系AT機」を作ってみてください。