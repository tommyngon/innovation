# AI Lab

Local test app: chat with NTNU IDUN LLMs + NB-Whisper transcription.

## Setup
```
cd ai-lab
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.example .env   # then put your IDUN_API_KEY in .env
.venv/bin/uvicorn server:app --port 8010
```
Open http://localhost:8010. First transcription downloads the NB-Whisper model from Hugging Face.

## VPN
The IDUN LLM API (https://llm.hpc.ntnu.no/v1) is only reachable on the NTNU network/VPN. Transcription works offline of IDUN.
Alternative to VPN:
```
sshuttle -r <user>@login.stud.ntnu.no 129.241.121.16/32
```
