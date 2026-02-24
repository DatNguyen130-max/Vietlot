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
4. Sau deploy, gọi `/api/sync?game=all` để nạp dữ liệu cả 2 game.

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
# Sync cả 2 game
curl -X POST "http://localhost:3000/api/sync?game=all&token=change-me"

# Sync riêng 6/55
curl -X POST "http://localhost:3000/api/sync?game=power655&token=change-me"

# Sync riêng 6/45
curl -X POST "http://localhost:3000/api/sync?game=power645&token=change-me"
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

File `vercel.json` đã cấu hình cron gọi `/api/sync` mỗi ngày lúc `01:00 UTC`.

- Nếu không truyền `game`, API sẽ sync mặc định cả `power655` và `power645`.
- Khuyến nghị đặt `CRON_SECRET` để Vercel Cron tự gửi `Authorization: Bearer <CRON_SECRET>`.

## API chính

```http
GET /api/predict?game=power655&lookback=420&simulations=40000&top=12&recentWindow=60
GET /api/predict?game=power645&lookback=420&simulations=40000&top=12&recentWindow=60

GET|POST /api/sync?game=all&token=...
GET|POST /api/sync?game=power655&token=...
GET|POST /api/sync?game=power645&token=...
```

## Ghi chú

- Mô hình dùng thống kê lịch sử + Monte Carlo để tham khảo nội bộ.
- Không có mô hình nào đảm bảo dự đoán đúng kết quả quay số.
- Một số bản ghi nguồn có thể không có số đặc biệt; hệ thống vẫn đồng bộ bình thường.
