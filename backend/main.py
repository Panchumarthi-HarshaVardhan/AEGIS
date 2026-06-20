# ============================================================
# JARVIS Guardian AI — FastAPI Backend Server
# Exposes ML pipelines to the Electron desktop client
# ============================================================

import os
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

# Load env variables
# Search in current directory and parent directory (.env is in root)
load_dotenv(dotenv_path="../.env")
load_dotenv(dotenv_path="./.env")

# Initialize FastAPI
app = FastAPI(
    title="JARVIS Guardian AI Backend Service",
    description="Python ML backend exposing deepfake analysis, document scans, fact checks, and OCR.",
    version="1.0.0"
)

# Enable CORS for local cross-origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API key validation helper
def get_groq_api_key() -> str:
    key = os.getenv("GROQ_API_KEY", "")
    if not key or key == "your_groq_api_key_here":
        raise HTTPException(
            status_code=500,
            detail="GROQ_API_KEY is not set or invalid in backend env configuration."
        )
    return key

# --- Request Schemas ---

class TextCheckRequest(BaseModel):
    text: str

class FileCheckRequest(BaseModel):
    file_path: str

# --- Endpoints ---

@app.get("/health")
def health_check():
    return {
        "status": "HEALTHY",
        "service": "JARVIS Python Backend",
        "api_key_set": bool(os.getenv("GROQ_API_KEY"))
    }

@app.post("/api/fake-news")
async def check_fake_news(request: TextCheckRequest):
    from services.fake_news import FakeNewsDetector
    key = get_groq_api_key()
    detector = FakeNewsDetector(api_key=key)
    res = await detector.analyze_article(request.text)
    return res

@app.post("/api/deepfake/video")
async def check_video_deepfake(request: FileCheckRequest):
    from services.deepfake_detector import DeepfakeDetector
    detector = DeepfakeDetector()
    res = await detector.analyze_video(request.file_path)
    if not res.get("success", True):
        raise HTTPException(status_code=400, detail=res.get("error", "Analysis failed"))
    return res

@app.post("/api/deepfake/audio")
async def check_audio_deepfake(request: FileCheckRequest):
    from services.deepfake_detector import DeepfakeDetector
    detector = DeepfakeDetector()
    res = await detector.analyze_audio(request.file_path)
    if not res.get("success", True):
        raise HTTPException(status_code=400, detail=res.get("error", "Analysis failed"))
    return res

@app.post("/api/ocr")
async def check_ocr(request: FileCheckRequest):
    from services.ocr_engine import OCREngine
    engine = OCREngine()
    res = await engine.extract_text(request.file_path)
    if not res.get("success", True):
        raise HTTPException(status_code=400, detail=res.get("error", "OCR extraction failed"))
    return res

@app.post("/api/malware/scan")
async def scan_malware(request: FileCheckRequest):
    from services.download_protection import DownloadProtectionScanner
    scanner = DownloadProtectionScanner()
    res = await scanner.scan_file(request.file_path)
    if res.get("status") == "ERROR":
        raise HTTPException(status_code=400, detail=res.get("reason", "Scan error"))
    return res

@app.post("/api/document/analyze")
async def analyze_document(request: FileCheckRequest):
    from services.document_intel import DocumentIntelAnalyzer
    key = get_groq_api_key()
    analyzer = DocumentIntelAnalyzer(api_key=key)
    res = await analyzer.analyze_document(request.file_path)
    if not res.get("success", True):
        raise HTTPException(status_code=400, detail=res.get("error", "Document analysis failed"))
    return res

@app.post("/api/shutdown")
async def shutdown_server():
    import signal
    import os
    # Send SIGTERM to our own process to trigger uvicorn's graceful shutdown lifecycle
    os.kill(os.getpid(), signal.SIGTERM)
    return {"success": True, "message": "Backend shutting down..."}


if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    print(f"Starting JARVIS Python Backend on port {port}...")
    uvicorn.run("main:app", host="127.0.0.1", port=port, reload=False)
