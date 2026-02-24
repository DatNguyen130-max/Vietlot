# Vietlott Internal Probability Dashboard (Power 6/55 + Mega 6/45)

Trang nội bộ để ước tính xác suất thống kê dãy số cho kỳ quay kế tiếp, dùng:
- `Next.js` (UI + API)
- `Supabase` (lưu dữ liệu lịch sử)
- `Vercel` (deploy)

Hỗ trợ song song:
- `Power 6/55` (`power655`)
- `Mega 6/45` (`power645`)

## Triển khai nhanh

1. Tạo bảng trên Supabase bằng `supabase/schema.sql`.
2. Cấu hình env theo `.env.example`.
3. Push code lên GitHub rồi import repo vào Vercel.
4. Sau deploy, gọi `/api/sync?game=all&source=local` để nạp dữ liệu full snapshot cả 2 game.

## 1) Chuẩn bị Supabase

1. Tạo project Supabase mới.
2. Mở SQL Editor và chạy file `supabase/schema.sql`.
3. Lấy:
   - `Project URL`
   - `service_role` key

## 2) Cấu hình môi trường

```bash
cp .env.example .env
```

```env
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY

SYNC_TOKEN=change-me
CRON_SECRET=change-me

# Optional: use remote sync source instead of local snapshot files
SYNC_SOURCE_URL_655=https://raw.githubusercontent.com/vietvudanh/vietlott-data/main/data/power655.jsonl
SYNC_SOURCE_URL_645=https://raw.githubusercontent.com/vietvudanh/vietlott-data/main/data/power645.jsonl
```

## 3) Chạy local

```bash
npm install
npm run dev
```

Mở `http://localhost:3000`.

## 4) Sync dữ liệu vào Supabase

UI:
- Chọn game (`Power 6/55` hoặc `Mega 6/45`) rồi bấm **Sync dữ liệu game đang chọn**.

API:

```bash
# Sync cả 2 game từ file local trong repo (mặc định)
curl -X POST "http://localhost:3000/api/sync?game=all&source=local&token=change-me"

# Sync riêng 6/55 từ local snapshot
curl -X POST "http://localhost:3000/api/sync?game=power655&source=local&token=change-me"

# Sync từ GitHub (remote) nếu muốn
curl -X POST "http://localhost:3000/api/sync?game=all&source=remote&token=change-me"
```

### Cập nhật thủ công từng kỳ quay

Bạn có thể thêm kỳ quay mới mà không cần sync remote:

```bash
# Power 6/55 (có bonus)
curl -X POST "http://localhost:3000/api/manual?token=change-me" \
  -H "Content-Type: application/json" \
  -d '{"game":"power655","drawId":1311,"drawDate":"2026-02-24","numbers":[1,5,12,22,33,44],"bonus":9}'

# Mega 6/45 (không bonus)
curl -X POST "http://localhost:3000/api/manual?token=change-me" \
  -H "Content-Type: application/json" \
  -d '{"game":"power645","drawId":1476,"drawDate":"2026-02-24","numbers":[2,8,19,21,34,45],"bonus":null}'
```

## 5) Deploy GitHub + Vercel

1. Push code lên GitHub repo của bạn.
2. Import repo vào Vercel.
3. Khai báo env vars trên Vercel:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SYNC_TOKEN` (optional)
   - `CRON_SECRET` (khuyến nghị)
   - `SYNC_SOURCE_URL_655` (optional)
   - `SYNC_SOURCE_URL_645` (optional)
4. Deploy.

## 6) Cron tự động cập nhật dữ liệu

File `vercel.json` đã cấu hình cron gọi `/api/sync?game=all&source=local` mỗi ngày lúc `01:00 UTC`.

- Nếu không truyền `game`, API sẽ sync mặc định cả `power655` và `power645`.
- Nếu không truyền `source`, API mặc định dùng `source=local` (file snapshot trong repo).
- Khuyến nghị đặt `CRON_SECRET` để Vercel Cron tự gửi `Authorization: Bearer <CRON_SECRET>`.

## API chính

```http
GET /api/predict?game=power655&lookback=420&simulations=40000&top=12&recentWindow=60
GET /api/predict?game=power645&lookback=420&simulations=40000&top=12&recentWindow=60

GET|POST /api/sync?game=all&source=local&token=...
GET|POST /api/sync?game=all&source=remote&token=...
POST /api/manual?token=...
```

## Ghi chú

- Mô hình dùng thống kê lịch sử + Monte Carlo để tham khảo nội bộ.
- Không có mô hình nào đảm bảo dự đoán đúng kết quả quay số.
- Một số bản ghi nguồn có thể không có số đặc biệt; hệ thống vẫn đồng bộ bình thường.
- `SUPABASE_SERVICE_ROLE_KEY` bắt buộc là service role key (không dùng `sb_publishable...` hoặc JWT `role=anon`).
