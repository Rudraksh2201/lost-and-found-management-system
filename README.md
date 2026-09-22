# Campus Lost & Found — AI-Powered Management System

An AI-enhanced campus lost-and-found platform. Students report lost/found items with a photo, an intelligent pipeline detects objects, reads image similarity and extracts text attributes, and a hybrid matcher surfaces likely matches. Owners can submit a claim, which admins review and approve to mark an item as recovered.

## Problem

Items are lost on campus every day. Reports are scattered across notice boards and group chats, matching is manual, and there is no central review or recovery workflow.

## Solution

One platform where:

- Students/finders report items with photos and details.
- An AI pipeline analyzes every report automatically.
- A hybrid matching engine ranks lost/found pairs by relevance.
- Claimants submit claims with a private verification detail.
- Admins review claims, approve/reject, delete reports and track recovery — behind a password-protected login.

## Main Features

- Lost & Found report forms with photo upload (JPG/PNG/WEBP/GIF, max 5 MB)
- Real-time report grid with search + category/location/status filters
- Smart Match Engine tab showing high-confidence pairs with human-readable reasons
- Claim flow: claimant name + email + private verification detail (e.g. distinguishing feature, contents, marking)
- Admin dashboard: view reports, view pending claims, approve/reject claims, delete reports, mark recovered, live statistics
- Admin authentication (credentials from environment variables, server-side protected routes, logout)
- Optional real YOLOv8 + CLIP integration

## AI Architecture

| Component | Purpose |
|-----------|---------|
| **YOLOv8** (`yolov8n.onnx`, run via ONNX Runtime Node) | Real-time object detection. Detects objects in report photos and generates object labels + confidence + bounding boxes. |
| **CLIP** (ViT-B/32 via `@xenova/transformers`) | Visual similarity. Produces 512-dim image embeddings; cosine similarity between lost/found photos feeds the image-similarity score. |
| **NLP / Text attribute extraction** | Extracts keywords, colors, brands, features and location hints from report descriptions. |
| **Hybrid matching engine** | Weighted scoring: category 30%, description keywords 25%, location 15%, date proximity 10%, detected object overlap 10%, image similarity 10%. Emits per-rule explanations. |

All AI output is real inference — no fake/stubbed results. If a heavy runtime is missing, the pipeline reports its availability per item instead of failing.

## Tech Stack

- **Backend:** Node.js + Express
- **Database:** MongoDB via Mongoose (optional) or built-in JSON file store (`data/db.json`)
- **Frontend:** Vanilla HTML/CSS (Tailwind via CDN) served by Express
- **AI:** ONNX Runtime Node (`yolov8n.onnx`), `@xenova/transformers` (CLIP ViT-B/32), custom regex/keyword extraction
- **Media:** `sharp` for image processing, `multer` for uploads

## Project Structure

```
.
├── server.js               # Express app entry point
├── package.json
├── .env.example            # Environment variable template (no secrets)
├── models/
│   └── yolov8n.onnx        # Pre-trained YOLOv8 nano model (~13MB)
├── public/
│   └── index.html          # Single-page UI
├── src/
│   ├── config.js           # Environment-driven config
│   ├── auth.js             # Admin token sessions + requireAdmin middleware
│   ├── db/                 # store adapter (JSON file / MongoDB backends)
│   ├── middleware/upload.js
│   ├── models/             # Mongoose schemas (Item, Claim)
│   ├── routes/             # items, matches, claims, auth API routes
│   └── services/           # aiService, yolo, embedding (CLIP), textExtractor, matcher
└── uploads/                # Uploaded user images (gitignored)
```

## Installation

Requirements: Node.js 18+.

```bash
npm install
npm start
```

The server runs at **http://localhost:5000**.

## Environment Variables

Copy `.env.example` to `.env` and adjust. Never commit `.env`.

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default `5000`) |
| `MONGO_URI` | Mongo connection string. Leave empty to use the JSON file store. |
| `DB_FILE` | JSON store path (default `./data/db.json`) |
| `UPLOAD_DIR` | Where uploaded images are stored (default `./uploads`) |
| `IMG_MAX_MB` | Max upload size in MB (default `5`) |
| `EMBEDDINGS_ENABLED` | `true` enables CLIP image embeddings |
| `DETECTION_ENABLED` | `true` enables YOLOv8 object detection |
| `DETECTION_MODEL` | Path to the YOLO `.onnx` model (default `./models/yolov8n.onnx`) |
| `ADMIN_USERNAME` | Admin login username |
| `ADMIN_PASSWORD` | Admin login password |

## YOLO Object Detection Model

`yolov8n.onnx` is included in this repository (~13MB, well within GitHub's file size limit).

If you need to fetch it fresh instead (e.g. corrupt/missing model):

```
# PowerShell
Invoke-WebRequest -Uri "https://github.com/ultralytics/assets/releases/download/v0.0.0/yolov8n.onnx" -OutFile "models/yolov8n.onnx"
```

For other YOLO ONNX exports, export from Ultralytics: `yolo export model=yolov8n.pt format=onnx`.

## Running the Application

1. `npm install`
2. Create `.env` from `.env.example` (set `EMBEDDINGS_ENABLED=true` and `DETECTION_ENABLED=true` for full AI).
3. `npm start`
4. Open http://localhost:5000
5. Check the API: http://localhost:5000/api/health returns `{"ok":true}`.

### Admin Login Setup

- Set `ADMIN_USERNAME` and `ADMIN_PASSWORD` in your `.env` (any values you choose — change them before deploying).
- Restart the server.
- Open the **Admin** tab at http://localhost:5000 and log in with those credentials.
- Sessions expire after 12 hours; use the Logout button when done.

## Demo Workflow

1. Student reports a **Lost** item with a photo.
2. Finder reports a **Found** item with a photo.
3. The AI pipeline runs per item: YOLO object detection → CLIP image embedding → text attribute extraction.
4. The Smart Match Engine ranks pairs; matched items show a score and reasons (category, keywords, location, date, object, image similarity).
5. The claimant opens the item's **Contact** modal and submits a claim with a verification detail.
6. Admin logs in, reviews the pending claim in the Admin tab.
7. Admin approves → the item's status changes to **Recovered** and dashboard statistics update.

## Team

- Rishabh Dhillon
- Rudraksh Maurya
- Rakshit Nautiyal

Guided by **Prof. Jaya Mishra**