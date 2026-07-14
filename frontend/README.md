# School ERP & LMS frontend

Next.js static frontend deployed at `https://erp-sand-eight-92.vercel.app`.

## Local development

```bash
cd frontend
npm ci
cp .env.local.example .env.local
npm run dev
```

Windows PowerShell:

```powershell
Copy-Item .env.local.example .env.local
```

The local file contains:

```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
```

## Vercel production

Configure this in **Vercel → Project → Settings → Environment Variables**:

```env
NEXT_PUBLIC_API_BASE_URL=https://erp-lms.onrender.com
```

Redeploy after changing a `NEXT_PUBLIC_*` variable because it is embedded during the static build. Do not put the production URL in `.env.local`.

## Checks

```bash
npm run lint
npm run build
```
