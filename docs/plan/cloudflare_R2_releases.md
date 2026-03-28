GitHub Actions を利用して、`[.github/workflows/cd-clipor.yml](C:/Projects/github/infinith4/dev-clipor/.github/workflows/cd-clipor.yml)` の CD で GitHub Releases 作成完了後に、ビルド済みバイナリ（MSI/EXE）を Cloudflare R2 へ自動アップロードする構成を定義します。

Cloudflare R2 は S3 互換の API を持っているため、標準的な S3 アップロード用の Action をそのまま利用できます。

---

### 1. Cloudflare R2 側の準備

まず、アップロードに必要な認証情報を取得します。

1.  **バケットの作成:** Cloudflare ダッシュボードの「R2」から、配信用のバケット（例: `my-app-packages`）を作成します。
2.  **API トークンの作成:**
    * R2 画面の右側にある「Manage R2 API Tokens」をクリック。
    * 「Create API token」を選択。
    * **Permissions:** `Object Read & Write` を選択。
    * **Bucket:** 作成したバケットに限定することをお勧めします。
3.  **情報の控え:** 以下の 3 点をメモしておきます。
    * **Access Key ID**
    * **Secret Access Key**
    * **Account ID**（エンドポイント URL に含まれます）

---

### 2. GitHub Secrets / Variables の設定

GitHub リポジトリの **Settings > Secrets and variables > Actions** に移動し、認証情報は `Secrets`、バケット名は `Variables` として設定します。

`Secrets` に追加するもの:
* `R2_ACCESS_KEY_ID`: （控えた Access Key）
* `R2_SECRET_ACCESS_KEY`: （控えた Secret Access Key）
* `R2_ACCOUNT_ID`: （Cloudflare のアカウント ID）

`Variables` に追加するもの:
* `R2_BUCKET_NAME`: （バケット名）

---

### 3. CD ワークフローへの組み込み

別 workflow を増やすのではなく、既存の `cd-clipor.yml` に `upload_r2` ジョブを追加します。`release` ジョブ完了後に同じ build artifact を再取得し、`.msi` と `.exe` のみを R2 のタグ別ディレクトリへ転送します。

```yaml
jobs:
  upload_r2:
    needs: [build, release, prepare_release]
    if: ${{ needs.prepare_release.outputs.should_release == 'true' && vars.R2_BUCKET_NAME != '' }}
    runs-on: ubuntu-latest

    steps:
      - name: Download build artifacts
        uses: actions/download-artifact@v5
        with:
          name: clipor-build
          path: artifacts
          run-id: ${{ needs.prepare_release.outputs.artifact_run_id }}
          github-token: ${{ secrets.GITHUB_TOKEN }}

      - name: Upload EXE and MSI to Cloudflare R2
        shell: bash
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.R2_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.R2_SECRET_ACCESS_KEY }}
          AWS_REGION: auto
          R2_ACCOUNT_ID: ${{ secrets.R2_ACCOUNT_ID }}
          R2_BUCKET_NAME: ${{ vars.R2_BUCKET_NAME }}
          RELEASE_TAG: ${{ needs.prepare_release.outputs.tag }}
        run: |
          DESTINATION="s3://${R2_BUCKET_NAME}/${RELEASE_TAG}/"
          ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

          aws s3 cp artifacts/ "$DESTINATION" \
            --recursive \
            --exclude "*" \
            --include "*.msi" \
            --include "*.exe" \
            --endpoint-url "$ENDPOINT" \
            --no-progress
```

アップロード先はタグごとのディレクトリとし、例えば `v0.2.14` の場合は以下のような構成になります。

- `s3://<R2_BUCKET_NAME>/v0.2.14/Clipor_0.2.14_x64_en-US.msi`
- `s3://<R2_BUCKET_NAME>/v0.2.14/Clipor_0.2.14_x64_ja-JP.msi`
- `s3://<R2_BUCKET_NAME>/v0.2.14/Clipor_0.2.14_x64-setup.exe`
- `s3://<R2_BUCKET_NAME>/v0.2.14/clipor.exe`

---

### 4. 公開用 URL の確認

アップロードされたファイルを Microsoft Store の Package URL として使用するには、R2 バケットの「Settings」タブで以下のいずれかを行う必要があります。

1.  **Public Access:** 「Allow Access」を有効にして、Cloudflare が提供する `pub-xxx.r2.dev` ドメインを使用する。
2.  **Custom Domain:** 自分のドメイン（例: `dl.example.com`）をバケットに紐付ける（推奨）。

これで、`https://dl.example.com/v1.0.0/setup.msi` のような、**リダイレクトのない直接ダウンロード URL** が手に入ります。

---

### ワンポイント・アドバイス
Microsoft Store の審査では、URL が長期間有効である必要があります。リリースごとにフォルダを分ける（例: `/v1.0.1/`）構成にしておくと、過去のバージョンを誤って上書きして Store のインストールを壊してしまうリスクを避けられます。

Cloudflare の設定や、YAML のビルドステップ部分の詳細についてさらに知りたい箇所はありますか？
