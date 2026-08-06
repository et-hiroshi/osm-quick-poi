# Development

## 責務

- `src/map`: Leafletの生成と地図中心変更通知
- `src/app`: 登録予定座標、ズーム、最終測位結果、UI状態の一元管理
- `src/geolocation`: Geolocation API境界、利用者向けエラー、再入防止
- `src/search`: Overpass API境界、レスポンス変換、距離計算、検索制御
- `src/components`: DOM構築と表示整形
- `src/config`: 地図、測位、検索半径・デバウンス・タイムアウトの設定値
- `src/pwa`: Service Worker登録

地図中心が将来の登録座標です。ユーザー操作に対応する `moveend` / `zoomend` 後、または明示的な現在地移動後に `map.getCenter()` とズームを一度読み、そこからだけストアを更新します。現在地取得に失敗した場合は中心とズームを更新しません。初回測位は既定ズーム、現在地ボタンからの再測位は操作中のズームを維持します。測位精度は最新の測位座標を中心とするLeafletの円として描画し、半径には `coords.accuracy` のメートル値をそのまま使います。

検索状態は未検索、デバウンス待ち、検索中、成功、エラーを区別してアプリストアで一元管理します。新しいユーザー操作の開始時だけ古いタイマーと通信を中断し、要求番号でも古い応答を無効化します。地図検索と座標表示は `dragstart` / `zoomstart` で開始したユーザー操作の完了時にだけ更新します。`invalidateSize()`、レイヤー更新、結果パネル描画などのプログラム起因イベントは検索へ通知しません。現在地への移動は、`setView`完了後の中心を明示的に1回検索予約します。Overpassレスポンスは永続化せず、Service Workerでもキャッシュしません。

下部パネルは検索状態や結果件数にかかわらず固定高です。地図コンテナのリサイズ時は変更前の中心・ズームを保存し、`invalidateSize({ pan: false })` 後に同じ値を復元するため、静止中の登録予定座標は変化しません。

Overpass endpointは `src/config/appConfig.ts` の優先順リストで管理します。要求は`URLSearchParams`をbodyにしたPOSTで送り、ブラウザにCORS-safeなContent-Type設定を委ねます。HTTP 429/502/503/504、クライアントタイムアウト、またはfetch拒否時に次のendpointを1回試します。ブラウザはCORS・DNS・TLS・一般ネットワークの拒否を区別して公開しないため、fetch拒否はendpoint固有の失敗としてフォールバック対象にします。`OverpassError`はkind、endpoint、HTTP statusを保持し、400、混雑、タイムアウト、fetch拒否、不正JSON、その他HTTPを内部で区別します。

Phase 3のOSM認証・書き込みは検索境界へ混ぜず、独立したサービスとして追加します。現在地および検索結果の永続化は禁止です。
