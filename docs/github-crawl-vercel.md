# Nối repo crawl GitHub với dashboard Vercel

Luồng đề xuất:

1. Repo crawl (ví dụ fork [vietlott](https://github.com/thanhnhu/vietlott)) chạy GitHub Actions hàng ngày, commit file `data/power655.jsonl` và `data/power645.jsonl`.
2. Dashboard trên Vercel đọc **raw URL** của hai file đó, upsert vào Supabase.
3. `/api/predict` luôn đọc lịch sử từ Supabase và tính lại gợi ý; phần **kỳ quay tiếp theo** dùng lịch cố định (6/55: Ba–Năm–Bảy; 6/45: Tư–Sáu–CN, giờ VN).

## Biến môi trường trên Vercel

```env
GITHUB_JSONL_RAW_BASE=https://raw.githubusercontent.com/USER/REPO/main/data
```

hoặc chỉ định từng file:

```env
GITHUB_POWER655_JSONL_URL=https://raw.githubusercontent.com/USER/REPO/main/data/power655.jsonl
GITHUB_POWER645_JSONL_URL=https://raw.githubusercontent.com/USER/REPO/main/data/power645.jsonl
```

Bắt buộc có `SUPABASE_*`. Nên bật `CRON_SECRET` (Vercel tự gửi `Authorization: Bearer …` cho Cron) và/hoặc `SYNC_TOKEN` cho nút sync thủ công.

## Cron trên Vercel

`vercel.json` gọi mỗi ngày:

`/api/sync?game=all&source=github`

Sau khi GitHub đã push JSONL mới (ví dụ ~20h VN nếu workflow crawl chạy 12:00 UTC), bạn chỉnh `schedule` trong `vercel.json` cho khớp.

## Gọi sync ngay sau khi crawl (tuỳ chọn)

Thêm workflow **ở repo crawl** (không phải repo dashboard), dùng secret `VERCEL_SYNC_URL` và `VERCEL_SYNC_TOKEN`:

```yaml
# .github/workflows/notify-vercel-sync.yml
name: Notify Vercel sync

on:
  push:
    branches: [main, master]
    paths:
      - "data/power655.jsonl"
      - "data/power645.jsonl"

jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger dashboard sync
        env:
          URL: ${{ secrets.VERCEL_SYNC_URL }}
          TOKEN: ${{ secrets.VERCEL_SYNC_TOKEN }}
        run: |
          curl -fsS -X POST "$URL" \
            -H "Authorization: Bearer $TOKEN"
```

Trong GitHub → **Secrets**:

- `VERCEL_SYNC_URL`: ví dụ `https://vietlot-nine.vercel.app/api/sync?game=all&source=github`
- `VERCEL_SYNC_TOKEN`: cùng giá trị với `CRON_SECRET` hoặc `SYNC_TOKEN` trên Vercel.

**Lưu ý:** URL chứa query string — đặt nguyên trong secret, không cần thêm dấu ngoặc.

Sau mỗi push dữ liệu, Supabase được cập nhật; người dùng mở dashboard hoặc gọi lại `/api/predict` sẽ thấy gợi ý mới theo kỳ quay mới nhất trong DB.
