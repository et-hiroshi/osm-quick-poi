# OSM Quick POI

外出先で、OpenStreetMapへ登録するPOIの位置を素早く正確に決めるためのiPhone向けPWAです。現在は **Phase 3-2** まで実装し、地図中央の登録予定位置周辺に既存のコンビニがないか確認して、OSMへ新しいコンビニnodeを登録できます。

## 技術構成

TypeScript、Leaflet、Vite、Vitestを使用します。この規模ではUIフレームワークを使わない方が、地図・測位・状態管理の責務を小さく保てるため、素のTypeScriptを選びました。位置情報は永続保存しません。周辺検索時は地図中央の座標をOverpass APIへ送信します（OSMタイル取得時にも通常のWebリクエストが発生します）。

## ローカル実行

Node.js 22以降を用意し、次を実行します。

```sh
npm ci
npm run dev
```

位置情報はHTTPSまたは `localhost` の安全なコンテキストでのみ利用できます。

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run preview
```

## OSM OAuth設定（Phase 3）

OSMのOAuth 2アプリケーションを「Confidential application」を無効にして登録し、Redirect URIへローカルURL（例：`http://127.0.0.1:5173/`）と公開URL（`https://et-hiroshi.github.io/osm-quick-poi/`）を登録します。OAuthアプリには `read_prefs` と `write_api` を許可してください。既にPhase 3-1でログイン済みの場合は、書き込み権限を反映するため一度ログアウトして再ログインします。

client IDは公開クライアントのアプリ設定としてソースコードで管理します。client secretはこのSPAでは使用せず、リポジトリやGitHub Pagesへ保存しないでください。

認証はAuthorization Code + PKCE（S256）を使用します。アクセストークンはWeb Storageへ置かず、同一オリジンのIndexedDBへ永続保存します。ログアウト、既知の期限到来、またはOSM APIの401応答時に削除します。

## コンビニ登録（Phase 3-2）

ブランドを選び「中央ピンへ登録」を押すと、その時点の地図中央座標を固定し、changeset作成、node作成、changeset終了の順にOSM Editing APIへ送信します。送信中はボタンを無効化します。セブン-イレブン、ファミリーマート、ローソン、ミニストップには日本向けName Suggestion Index準拠のタグを付け、「その他」では入力した店舗名と `shop=convenience` を付けます。

登録操作は実際のOSMデータを即座に変更します。現地、航空写真、周辺検索結果を確認し、既存店舗との重複がない場合だけ実行してください。

## GitHub Pages

`.github/workflows/deploy-pages.yml` が `main` へのpush時にlint、型検査、テスト、ビルドを通し、成功した成果物だけを公開します。ViteはGitHub Actionsの `GITHUB_REPOSITORY` からリポジトリ名を取得し、サブパス用のbase URLを設定します。

人間側で必要な初期設定：

1. GitHubで空のリポジトリを作成し、このローカルリポジトリへremoteを設定してpushする。
2. リポジトリの **Settings → Pages → Build and deployment → Source** を **GitHub Actions** にする。
3. Actionsの初回デプロイ完了後、公開URLをiPhone Safariで開く。

## iPhoneのホーム画面へ追加

Safariで公開URLを開き、共有ボタンから「ホーム画面に追加」を選びます。位置情報を求められたら許可してください。拒否・タイムアウト・非対応の場合も、地図は手動操作できます。「現在地」は保存座標ではなく、その都度新しく測位し、現在のズームを維持したまま中心を移動します。起動時の初回測位だけは店舗位置を確認しやすい既定ズームを使用します。最終測位の精度は、現在地を中心とする深緑の半透明円で示し、半径には実際の精度（m）を使用します。精度の数値は画面には表示しません。

## 周辺コンビニ検索（Phase 2）

地図操作の終了後、中央固定ピンから半径50m以内の `shop=convenience` をOverpass APIで検索します。nodeに加えて、way・relationも対象です。結果は距離順に表示され、一覧をタップすると地図上の該当マーカーを強調します。

検索はHTTPS・CORS対応の `overpass-api.de` を使用し、HTTP 429/502/503/504、タイムアウト、またはブラウザがCORS・DNS・TLS・一時的な通信失敗としてまとめて返す接続拒否時に、設定済みの `lz4.overpass-api.de` へ1回フォールバックします。検索要求不正や不正な応答では自動フォールバックせず、原因別のメッセージと再試行を表示します。

検索結果はOpenStreetMapの最新データ反映状況とOverpass APIの可用性に依存します。表示が0件でも、現地に店舗が存在しないことを保証するものではありません。

## 現在の制限

- オフライン地図には対応しません。Service WorkerはOSMタイルをキャッシュしません。
- コンビニ以外のPOI、既存要素の編集、履歴・下書きは未実装です。
- iPhone実機でのSafari/PWA動作は、実際の端末で別途確認が必要です。

実機確認では、位置情報の許可・拒否・再試行、地図操作後の検索、複数結果のスクロール、マーカー選択、検索エラーからの再試行、Safe Area、ホーム画面起動を確認してください。

詳しい段階計画は [ROADMAP.md](ROADMAP.md) を参照してください。
