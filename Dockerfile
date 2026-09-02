# yt-dlp currently supports Bun through 1.3.14 for YouTube's JavaScript
# challenge solver. Pinning avoids a future base-image upgrade silently breaking
# music/video extraction.
FROM oven/bun:1.3.14-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    ca-certificates \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    ffmpeg \
    webp \
	poppler-utils \
	ghostscript \
	tesseract-ocr \
	qrencode \
	zbar-tools \
	python3-img2pdf \
    git \
    wget \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Bust the Docker cache whenever a new yt-dlp release ships. Without this, the RUN
# layer below stays cached across rebuilds and yt-dlp freezes at its first-built
# version — which modern YouTube rejects ("Requested format is not available").
ADD https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest /tmp/yt-dlp-latest.json
RUN wget -q https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux \
    -O /usr/local/bin/yt-dlp && chmod a+rx /usr/local/bin/yt-dlp

ENV YTDLP_PATH=/usr/local/bin/yt-dlp
ENV FFMPEG_PATH=ffmpeg
ENV YTDLP_POT_PROVIDER_VERSION=1.3.2

WORKDIR /app

# The vendored on-demand PO-token workspace is used by native Render and Docker
# alike. Copy its manifest before install so the frozen workspace lock resolves.
COPY package.json bun.lock* ./
COPY dashboard/package.json ./dashboard/
COPY vendor/bgutil-ytdlp-pot-provider/package.json ./vendor/bgutil-ytdlp-pot-provider/
RUN bun install --frozen-lockfile

# Copy full source and build dashboard
COPY . .
RUN bun run --cwd dashboard build

RUN mkdir -p temp

ENV NODE_ENV=production

EXPOSE 8080

CMD ["bun", "--smol", "index.js"]
