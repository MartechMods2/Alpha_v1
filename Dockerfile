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

# Install the current BgUtils PO-token provider in on-demand script mode. This
# avoids a permanent sidecar process on small Render instances. Both the source
# revision and release plugin digest are pinned so upstream changes cannot alter
# a rebuild silently.
ARG BGUTIL_VERSION=1.3.2
ARG BGUTIL_COMMIT=7511309af023b09788dc8f2efc96cc3671291e6c
ARG BGUTIL_PLUGIN_SHA256=d51cf1c54e487137df749bd8778cceaa62304e6c5054c955b95f028f93ad6d57
RUN mkdir -p /etc/yt-dlp/plugins \
    && wget -q "https://github.com/Brainicism/bgutil-ytdlp-pot-provider/releases/download/${BGUTIL_VERSION}/bgutil-ytdlp-pot-provider.zip" \
        -O /etc/yt-dlp/plugins/bgutil-ytdlp-pot-provider.zip \
    && echo "${BGUTIL_PLUGIN_SHA256}  /etc/yt-dlp/plugins/bgutil-ytdlp-pot-provider.zip" | sha256sum -c - \
    && git clone --filter=blob:none https://github.com/Brainicism/bgutil-ytdlp-pot-provider.git /opt/bgutil-ytdlp-pot-provider \
    && cd /opt/bgutil-ytdlp-pot-provider \
    && git checkout --detach "${BGUTIL_COMMIT}" \
    && cd server \
    && npm ci \
    && npx tsc \
    && npm prune --omit=dev \
    && rm -rf /opt/bgutil-ytdlp-pot-provider/.git

ENV YTDLP_PATH=/usr/local/bin/yt-dlp
ENV FFMPEG_PATH=ffmpeg
ENV YTDLP_POT_PROVIDER_HOME=/opt/bgutil-ytdlp-pot-provider/server
ENV YTDLP_POT_PLUGIN_PATH=/etc/yt-dlp/plugins/bgutil-ytdlp-pot-provider.zip
ENV YTDLP_POT_PROVIDER_VERSION=1.3.2

WORKDIR /app

# Copy manifests for all workspace members before install (better layer caching)
COPY package.json bun.lock* ./
COPY dashboard/package.json ./dashboard/
RUN bun install --frozen-lockfile

# Copy full source and build dashboard
COPY . .
RUN bun run --cwd dashboard build

RUN mkdir -p temp

ENV NODE_ENV=production

EXPOSE 8080

CMD ["bun", "--smol", "index.js"]
