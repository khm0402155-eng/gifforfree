const ffmpeg = new window.FFmpeg();
let progressFloor = 0;
let progressSpan = 1;
let customProgressHandler = null;
let customLogHandler = null;

const VIDEO_FORMATS = [
  ["mp4", "MP4"],
  ["m4v", "M4V"],
  ["mov", "MOV"],
  ["qt", "QT"],
  ["avi", "AVI"],
  ["mkv", "MKV"],
  ["webm", "WEBM"],
  ["wmv", "WMV"],
  ["asf", "ASF"],
  ["flv", "FLV"],
  ["f4v", "F4V"],
  ["mpg", "MPG"],
  ["mpeg", "MPEG"],
  ["mpe", "MPE"],
  ["m2v", "M2V"],
  ["vob", "VOB"],
  ["ts", "TS"],
  ["mts", "MTS"],
  ["m2ts", "M2TS"],
  ["3gp", "3GP"],
  ["3g2", "3G2"],
  ["ogv", "OGV"],
  ["ogg", "OGG"],
  ["divx", "DIVX"],
];

const VIDEO_EXT = new Set(VIDEO_FORMATS.map(([ext]) => ext));
const NON_VIDEO_EXT = new Set([
  "jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "heic", "avif",
  "mp3", "wav", "aac", "flac", "m4a", "wma",
  "pdf", "txt", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
  "zip", "rar", "7z", "exe", "msi", "apk", "html", "css", "js", "json",
]);

let tail = Promise.resolve();

function enqueue(task) {
  const run = tail.then(task, task);
  tail = run.then(() => undefined, () => undefined);
  return run;
}

const BROWSER_PREVIEW = new Set(["mp4", "m4v", "webm", "ogv", "mov"]);

const $ = (id) => document.getElementById(id);

const picker = $("picker");
const fileInput = $("file-input");
const engineEl = $("engine");
const editorEngineEl = $("editor-engine-status");
const noticeEl = $("notice");
const formatError = $("format-error");
const formatErrorDetail = $("format-error-detail");
const formatSection = document.querySelector(".formats");
const formatList = $("format-list");
const workspace = $("workspace");
const videoPreview = $("video-preview");
const previewFallback = $("preview-fallback");
const fileInfo = $("file-info");
const settings = $("settings");
const widthInput = $("width");
const heightInput = $("height");
const lockRatio = $("lock-ratio");
const widthLabel = $("width-label");
const heightLabel = $("height-label");
const sizeReadout = $("size-readout");
const startInput = $("start");
const endInput = $("end");
const startNum = $("start-num");
const endNum = $("end-num");
const startLabel = $("start-label");
const endLabel = $("end-label");
const targetInput = $("target-kb");
const targetLabel = $("target-label");
const captionInput = $("caption");
const captionPlace = $("caption-place");
const captionColor = $("caption-color");
const captionType = $("caption-type");
const frameReadout = $("frame-readout");
const frameWarning = $("frame-warning");
const convertBtn = $("convert");
const progressWrap = $("progress-wrap");
const progressBar = $("progress-bar");
const progressText = $("progress-text");
const generatorRudolph = $("generator-rudolph");
const genLiveFrameImg = $("gen-live-frame-img");
const genLiveFrameBadge = $("gen-live-frame-badge");
const genFrameCounter = $("gen-frame-counter");
const genInternalStage = $("gen-internal-stage");
const genEngineTelemetry = $("gen-engine-telemetry");
let genLiveFrameUrl = "";
const result = $("result");
const gifPreview = $("gif-preview");
const gifInfo = $("gif-info");
const downloadBtn = $("download");
const editGeneratedBtn = $("edit-generated-gif");
const copyGeneratedBtn = $("copy-generated-gif");
const generatorOnelineSummary = $("generator-oneline-summary");
const doneName = $("done-name");
const thumbs = $("thumbs");
const progressTrack = $("progress-track");
const thumbUrls = [];

let engineReady = null;
let converting = false;
let logLines = [];
let mediaUrl = "";
let gifUrl = "";
let latestGeneratedBlob = null;
let latestGeneratedName = "";
let current = null;
let token = 0;

VIDEO_FORMATS.forEach(([ext, label]) => {
  const item = document.createElement("li");
  item.innerHTML = `<span class="fmt-glyph">${label}</span><span class="fmt-name">.${ext}</span>`;
  formatList.appendChild(item);
});

function extensionOf(name) {
  const match = /\.([a-z0-9]+)$/i.exec(name || "");
  return match ? match[1].toLowerCase() : "";
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "-";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[index]}`;
}

function formatSeconds(seconds) {
  if (!Number.isFinite(seconds)) return "-";
  const total = Math.max(0, seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const body = h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${s.toFixed(1).padStart(4, "0")}`
    : `${m}:${s.toFixed(1).padStart(4, "0")}`;
  return `${body}초`;
}

function even(value) {
  const rounded = Math.max(2, Math.round(Number(value) || 2));
  return rounded - (rounded % 2);
}

function setEngineStatus(genText, edText) {
  if (engineEl) engineEl.textContent = genText;
  if (editorEngineEl) editorEngineEl.textContent = edText || genText;
}

function showNotice(message) {
  noticeEl.hidden = !message;
  noticeEl.textContent = message || "";
}

function showFormatError(detail) {
  formatErrorDetail.textContent = detail;
  formatError.hidden = false;
  formatSection.classList.add("is-alert");
  workspace.hidden = true;
  result.hidden = true;
  window.GifStudio?.syncSnow?.();
  formatError.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function clearFormatError() {
  formatError.hidden = true;
  formatSection.classList.remove("is-alert");
}

function infoRows(target, rows) {
  target.replaceChildren();
  rows.forEach(([label, value]) => {
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = label;
    dd.textContent = value;
    target.append(dt, dd);
  });
}

function revoke(url) {
  if (url) URL.revokeObjectURL(url);
}

function base64ToBytes(b64) {
  const chunkSize = 1024 * 1024;
  const parts = [];
  for (let index = 0; index < b64.length; index += chunkSize) {
    const binary = atob(b64.slice(index, index + chunkSize));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    parts.push(bytes);
  }
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  parts.forEach((part) => {
    out.set(part, offset);
    offset += part.length;
  });
  return out;
}

function loadScript(src) {
  if (window.__addScript) return window.__addScript(src);
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("필요한 파일을 불러오지 못했습니다."));
    document.body.appendChild(script);
  });
}

async function ensureFileEngine() {
  if (window.FFMPEG_CORE_B64 && window.FFMPEG_WASM_B64) return;
  setEngineStatus("변환 엔진 파일을 불러오는 중입니다. 잠시만 기다려 주세요.");
  await loadScript("vendor/core/parts/manifest.js");
  await loadScript("vendor/core/parts/core.js");
  const files = window.FFMPEG_PART_FILES || [];
  for (let index = 0; index < files.length; index += 1) {
    setEngineStatus(`엔진 구성 요소를 불러오는 중 (${index + 1}/${files.length})`);
    await loadScript(`vendor/core/parts/${files[index]}`);
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  window.FFMPEG_WASM_B64 = (window.FFMPEG_WASM_PARTS || []).join("");
  window.FFMPEG_WASM_PARTS = [];
  if (!window.FFMPEG_CORE_B64 || !window.FFMPEG_WASM_B64) {
    throw new Error("변환 엔진 데이터를 읽지 못했습니다.");
  }
}

function classicCoreSource(sourceText) {
  return sourceText
    .replaceAll("import.meta.url", '""')
    .replace(/export default createFFmpegCore;\s*$/, "self.createFFmpegCore = createFFmpegCore;\n");
}

function errorText(error) {
  if (!error) return "새로고침 해 주세요.";
  if (typeof error === "string") return error;
  return error.message || String(error);
}

async function engineFiles() {
  if (location.protocol === "file:") {
    await ensureFileEngine();
    setEngineStatus("변환 엔진을 준비하고 있습니다.");
    const coreText = new TextDecoder().decode(base64ToBytes(window.FFMPEG_CORE_B64));
    const wasmBinary = base64ToBytes(window.FFMPEG_WASM_B64);
    window.FFMPEG_CORE_B64 = "";
    window.FFMPEG_WASM_B64 = "";
    return { coreSource: classicCoreSource(coreText), wasmBinary };
  }
  const here = new URL(".", document.baseURI);
  const [coreRes, wasmRes] = await Promise.all([
    fetch(new URL("vendor/core/ffmpeg-core.js", here)),
    fetch(new URL("vendor/core/ffmpeg-core.wasm", here)),
  ]);
  if (!coreRes.ok || !wasmRes.ok) throw new Error("변환 엔진 파일을 읽지 못했습니다.");
  return {
    coreSource: classicCoreSource(await coreRes.text()),
    wasmBinary: new Uint8Array(await wasmRes.arrayBuffer()),
  };
}

function setProgress(percent, text) {
  const pct = Math.max(0, Math.min(100, Math.round(percent)));
  progressBar.style.width = `${pct}%`;
  if (generatorRudolph) generatorRudolph.style.left = `${pct}%`;
  progressTrack.setAttribute("aria-valuenow", String(pct));
  if (text) progressText.textContent = text;
}

function gifFileName(filename) {
  const trimmed = (filename || "animation").trim();
  const dot = trimmed.lastIndexOf(".");
  const base = dot > 0 ? trimmed.slice(0, dot) : trimmed;
  return `${base || "animation"}.gif`;
}

function clearThumbs() {
  while (thumbUrls.length) revoke(thumbUrls.pop());
  thumbs.replaceChildren();
}

function addThumb(bytes, index) {
  const url = URL.createObjectURL(new Blob([bytes], { type: "image/jpeg" }));
  thumbUrls.push(url);
  const img = document.createElement("img");
  img.src = url;
  img.alt = `${index}번 GIF 프레임`;
  thumbs.appendChild(img);
  thumbs.scrollLeft = thumbs.scrollWidth;
}

function loadEngine() {
  engineReady = (async () => {
    ffmpeg.on("log", ({ message }) => {
      logLines.push(message);
      if (customLogHandler) {
        customLogHandler(message);
      } else if (converting && genEngineTelemetry && message && message.trim()) {
        genEngineTelemetry.textContent = `[FFmpeg WASM] ${message.trim()}`;
      }
    });
    ffmpeg.on("progress", ({ progress }) => {
      const local = Math.max(0, Math.min(1, Number(progress) || 0));
      if (customProgressHandler) {
        customProgressHandler(local);
        return;
      }
      if (!converting) return;
      setProgress((progressFloor + local * progressSpan) * 100);
    });
    const files = await engineFiles();
    await ffmpeg.load(files);
    setEngineStatus(
      "❄️ 변환 엔진 준비 완료! 동영상 하나를 선택해 주세요.",
      "❄️ 초 고성능 GIF 편집 엔진 준비 완료! GIF 파일을 올려주세요."
    );
    return true;
  })().catch((error) => {
    console.error(error);
    setEngineStatus(`엔진을 불러오지 못했습니다. ${errorText(error)}`);
    return false;
  });
  return engineReady;
}

function parseProbe(lines) {
  const durationMatch = lines.join("\n").match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  const duration = durationMatch
    ? Number(durationMatch[1]) * 3600 + Number(durationMatch[2]) * 60 + Number(durationMatch[3])
    : null;
  const videoLines = lines.filter((line) => line.includes("Video:"));
  const videoLine = videoLines.find((line) => !/attached pic/i.test(line)) || videoLines[0];
  if (!videoLine) return { duration, video: null };
  const size = videoLine.match(/(\d{2,5})x(\d{2,5})/);
  const fps = videoLine.match(/([\d.]+)\s*fps/);
  const codec = videoLine.match(/Video:\s*([^,\s(]+)/);
  if (!size) return { duration, video: null };
  return {
    duration,
    video: {
      codec: codec ? codec[1] : "-",
      width: Number(size[1]),
      height: Number(size[2]),
      fps: fps ? Number(fps[1]) : null,
    },
  };
}

async function probe(file, ext) {
  const ready = await engineReady;
  if (!ready) throw new Error("변환 엔진이 아직 준비되지 않았습니다.");
  const inputName = `input.${ext || "bin"}`;
  logLines = [];
  try {
    await ffmpeg.writeFile(inputName, new Uint8Array(await file.arrayBuffer()));
    await ffmpeg.exec(["-hide_banner", "-i", inputName], 60000);
    const parsed = parseProbe(logLines);
    if (!parsed.video) {
      const error = new Error("이 파일을 영상으로 읽지 못했습니다.");
      error.unsupported = true;
      throw error;
    }
    return parsed;
  } finally {
    try { await ffmpeg.deleteFile(inputName); } catch { /* already gone */ }
  }
}

function outputSize() {
  let width = Math.min(960, even(widthInput.value));
  let height = lockRatio.checked && current?.video
    ? even((width * current.video.height) / current.video.width)
    : even(heightInput.value);
  if (height > 960 && current?.video && lockRatio.checked) {
    width = even((width * 960) / height);
    height = even((width * current.video.height) / current.video.width);
  }
  return {
    width: Math.min(960, Math.max(2, width)),
    height: Math.min(960, Math.max(2, height)),
  };
}

function syncSizeControls() {
  const { width, height } = outputSize();
  widthLabel.textContent = `${width}px`;
  heightLabel.textContent = `${height}px`;
  sizeReadout.textContent = `출력 크기 ${width} × ${height}`;
  heightInput.disabled = lockRatio.checked;
  if (lockRatio.checked) heightInput.value = String(height);
}

function clipBounds() {
  const duration = current?.duration;
  const hasDuration = Number.isFinite(duration) && duration > 0.2;
  const videoEnd = hasDuration ? duration : 600;
  const maxStart = Math.max(0, videoEnd - 0.2);
  let start = Number(startNum.value);
  let end = Number(endNum.value);
  if (!Number.isFinite(start)) start = 0;
  if (!Number.isFinite(end)) end = Math.min(videoEnd, 8);
  start = Math.min(Math.max(0, start), maxStart);
  end = Math.min(videoEnd, Math.max(start + 0.2, end));
  const length = end - start;
  startInput.max = String(maxStart);
  endInput.max = String(videoEnd);
  startInput.value = start.toFixed(1);
  endInput.value = end.toFixed(1);
  startNum.value = start.toFixed(1);
  endNum.value = end.toFixed(1);
  startNum.max = String(maxStart);
  endNum.max = String(videoEnd);
  startLabel.textContent = `${start.toFixed(1)}초`;
  endLabel.textContent = `${end.toFixed(1)}초`;
  const frames = Math.max(1, Math.round(length * 30));
  frameReadout.textContent = `선택 길이 ${length.toFixed(1)}초 · 약 ${frames.toLocaleString("ko-KR")}프레임 · 30FPS`;
  frameWarning.hidden = frames < 450;
  return { start, end, length, frames };
}

function targetBytes() {
  const kb = Number(targetInput.value);
  if (!Number.isFinite(kb) || kb <= 0) return 0;
  return Math.round(kb * 1024);
}

function updateTargetLabel() {
  const bytes = targetBytes();
  targetLabel.textContent = bytes ? formatBytes(bytes) : "제한 없음";
}

function renderInfo() {
  const file = current.file;
  const video = current.video;
  infoRows(fileInfo, [
    ["파일 이름", file.name],
    ["형식", current.ext ? `.${current.ext}` : "확장자 없음"],
    ["용량", formatBytes(file.size)],
    ["재생 시간", formatSeconds(current.duration)],
    ["해상도", video ? `${video.width} × ${video.height}` : "-"],
    ["원본 속도", video?.fps ? `${video.fps} FPS` : "확인되지 않음"],
    ["코덱", video?.codec || "-"],
    ["변환 방식", "30FPS로 프레임을 잘라 GIF 저장"],
  ]);
}

function setPreview(file, ext) {
  revoke(mediaUrl);
  mediaUrl = URL.createObjectURL(file);
  const canPreview = BROWSER_PREVIEW.has(ext) && file.size < 120 * 1024 * 1024;
  videoPreview.hidden = !canPreview;
  previewFallback.hidden = canPreview;
  if (canPreview) {
    videoPreview.src = mediaUrl;
  } else {
    videoPreview.removeAttribute("src");
    videoPreview.load();
  }
}

function resetResult() {
  result.hidden = true;
  revoke(gifUrl);
  gifUrl = "";
  latestGeneratedBlob = null;
  latestGeneratedName = "";
  gifPreview.removeAttribute("src");
  downloadBtn.disabled = true;
  downloadBtn.dataset.name = "";
  doneName.hidden = true;
  doneName.textContent = "";
  progressWrap.hidden = true;
  setProgress(0, "프레임을 자르는 중입니다.");
  clearThumbs();
}

async function acceptFile(file, extraNote = false) {
  const myToken = ++token;
  resetResult();
  clearFormatError();
  showNotice("");
  const ext = extensionOf(file.name);

  if (NON_VIDEO_EXT.has(ext)) {
    const label = ext ? `.${ext}` : "확장자가 없는 파일";
    showFormatError(`${file.name} (${label}) 은 동영상 형식이 아닙니다.`);
    current = null;
    window.GifStudio?.syncSnow?.();
    return;
  }

  if (file.size === 0) {
    showFormatError("빈 파일입니다. 내용이 있는 동영상 파일을 선택해 주세요.");
    current = null;
    window.GifStudio?.syncSnow?.();
    return;
  }

  if (file.size > 400 * 1024 * 1024) {
    showFormatError("파일이 400MB보다 큽니다. 더 짧은 영상이나 더 작은 파일로 다시 선택해 주세요.");
    current = null;
    window.GifStudio?.syncSnow?.();
    return;
  }

  current = { file, ext, duration: null, video: null };
  workspace.hidden = false;
  window.GifStudio?.syncSnow?.();
  setPreview(file, ext);
  infoRows(fileInfo, [
    ["파일 이름", file.name],
    ["형식", ext ? `.${ext}` : "확장자 없음"],
    ["용량", formatBytes(file.size)],
    ["영상 정보", "읽는 중입니다"],
  ]);
  convertBtn.disabled = true;

  try {
    const parsed = await enqueue(() => probe(file, ext));
    if (myToken !== token) return;
    current.duration = parsed.duration;
    current.video = parsed.video;
    const sourceWidth = parsed.video.width;
    widthInput.value = String(even(Math.min(sourceWidth, 480)));
    heightInput.value = String(even((widthInput.value * parsed.video.height) / sourceWidth));
    const duration = parsed.duration;
    startNum.value = "0";
    endNum.value = String(duration && duration > 0 ? Math.min(duration, 8) : 5);
    renderInfo();
    syncSizeControls();
    clipBounds();
    convertBtn.disabled = false;
    window.GifStudio?.syncSnow?.();
    const notes = [];
    if (extraNote) notes.push("한 번에 파일 하나만 선택할 수 있습니다. 첫 번째 파일만 사용합니다.");
    if (!VIDEO_EXT.has(ext)) notes.push("목록 밖의 형식이지만 영상 트랙을 읽었습니다. 크기 조정 후 30FPS GIF로 변환할 수 있습니다.");
    if (notes.length) showNotice(notes.join(" "));
  } catch (error) {
    if (myToken !== token) return;
    console.error(error);
    current = null;
    workspace.hidden = true;
    window.GifStudio?.syncSnow?.();
    const label = ext ? `.${ext}` : "이 형식";
    const detail = errorText(error);
    if (error.unsupported) {
      showFormatError(`${file.name} 은 ${label} 파일로 보였지만 변환할 영상 트랙을 찾지 못했습니다. 파일이 손상되었거나 지원되지 않는 형식일 수 있습니다.`);
    } else {
      showNotice(`${file.name} 을 확인하지 못했습니다. ${detail}`);
    }
  }
}

function takeFiles(fileList) {
  const files = [...fileList];
  if (!files.length) return;
  if (files.length > 1) {
    showNotice("한 번에 파일 하나만 선택할 수 있습니다. 첫 번째 파일만 사용합니다.");
  }
  if (converting) {
    showNotice("변환이 끝난 뒤 다른 파일을 선택할 수 있습니다.");
    return;
  }
  acceptFile(files[0], files.length > 1);
}

fileInput.addEventListener("change", () => {
  takeFiles(fileInput.files);
  fileInput.value = "";
});
window.__takeFiles = takeFiles;
if (window.__pendingFile && window.__pendingFile.length) {
  const queued = window.__pendingFile;
  window.__pendingFile = null;
  takeFiles(queued);
}

picker.addEventListener("dragover", (event) => {
  event.preventDefault();
  picker.classList.add("is-over");
});
picker.addEventListener("dragleave", () => picker.classList.remove("is-over"));
picker.addEventListener("drop", (event) => {
  event.preventDefault();
  picker.classList.remove("is-over");
  takeFiles(event.dataTransfer.files);
});

document.addEventListener("dragover", (event) => event.preventDefault());
document.addEventListener("drop", (event) => {
  if (document.body.getAttribute("data-mode") !== "generator") return;
  if (!event.target.closest("#picker")) event.preventDefault();
});

[widthInput, heightInput, lockRatio].forEach((el) => {
  el.addEventListener("input", () => {
    syncSizeControls();
  });
});
startInput.addEventListener("input", () => {
  startNum.value = startInput.value;
  clipBounds();
});
endInput.addEventListener("input", () => {
  endNum.value = endInput.value;
  clipBounds();
});
[startNum, endNum].forEach((el) => {
  el.addEventListener("input", () => clipBounds());
});
targetInput.addEventListener("input", updateTargetLabel);

videoPreview.addEventListener("error", () => {
  videoPreview.hidden = true;
  previewFallback.hidden = false;
});

function sampleFrames(frames, fromFps, toFps) {
  if (toFps >= fromFps - 0.01) return frames;
  const step = fromFps / toFps;
  const picked = [];
  for (let index = 0; index < frames.length; index += step) {
    picked.push(frames[Math.min(frames.length - 1, Math.floor(index))]);
  }
  return picked.length ? picked : [frames[0]];
}

function scaledSize(width, height, factor) {
  return {
    width: Math.max(80, even(width * factor)),
    height: Math.max(2, even(height * factor)),
  };
}

function compressionPlans() {
  const plans = [{ fps: 30, scale: 1, colors: 256 }];
  if (!targetBytes()) return plans;
  [
    [24, 1, 192],
    [20, 0.85, 128],
    [15, 0.7, 128],
    [12, 0.55, 96],
    [10, 0.45, 64],
    [8, 0.34, 48],
    [6, 0.26, 32],
  ].forEach(([fps, scale, colors]) => plans.push({ fps, scale, colors }));
  return plans;
}

function captionOptions() {
  return {
    text: captionInput.value.trim(),
    place: captionPlace.value,
    color: captionColor.value || "#ffffff",
    typewriter: captionType.checked,
  };
}

function wrapCaption(ctx, text, maxWidth) {
  const lines = [];
  let line = "";
  for (const char of text) {
    const trial = line + char;
    if (line && ctx.measureText(trial).width > maxWidth) {
      lines.push(line);
      line = char;
    } else {
      line = trial;
    }
  }
  if (line) lines.push(line);
  return lines.slice(-4);
}

async function paintFrame(jpegBytes, caption, revealCount, outW, outH) {
  const bitmap = await createImageBitmap(new Blob([jpegBytes], { type: "image/jpeg" }));
  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0, outW, outH);
  bitmap.close?.();
  const shown = caption.text.slice(0, revealCount);
  if (!shown) {
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
    return new Uint8Array(await blob.arrayBuffer());
  }
  const fontSize = Math.max(18, Math.round(outW / 16));
  const lineHeight = Math.round(fontSize * 1.25);
  ctx.font = `700 ${fontSize}px "Noto Sans KR", "Malgun Gothic", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const lines = wrapCaption(ctx, shown, outW - 24);
  const block = lines.length * lineHeight;
  let y = outH - 18 - block + fontSize;
  if (caption.place === "top") y = 16 + fontSize;
  if (caption.place === "center") y = (outH - block) / 2 + fontSize;
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(3, fontSize / 7);
  ctx.strokeStyle = "rgba(0,0,0,0.78)";
  ctx.fillStyle = caption.color;
  lines.forEach((line, index) => {
    const yy = y + index * lineHeight;
    ctx.strokeText(line, outW / 2, yy);
    ctx.fillText(line, outW / 2, yy);
  });
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
  return new Uint8Array(await blob.arrayBuffer());
}

function showFrameStrip(bytesList) {
  clearThumbs();
  const stride = Math.max(1, Math.ceil(bytesList.length / 36));
  bytesList.forEach((bytes, index) => {
    if (index % stride === 0 || index === bytesList.length - 1) addThumb(bytes.slice(), index + 1);
  });
}

async function clearFrameFiles() {
  let nodes = [];
  try {
    nodes = await ffmpeg.listDir("frames");
  } catch {
    try { await ffmpeg.createDir("frames"); } catch { /* ignore */ }
    return;
  }
  for (const node of nodes || []) {
    if (node.name === "." || node.name === "..") continue;
    try { await ffmpeg.deleteFile(`frames/${node.name}`); } catch { /* ignore */ }
  }
}

async function encodeSelection(master, plan, baseWidth, baseHeight, caption) {
  const picked = sampleFrames(master, 30, plan.fps);
  const size = scaledSize(baseWidth, baseHeight, plan.scale);
  const painted = [];
  for (let index = 0; index < picked.length; index += 1) {
    const reveal = caption.text
      ? (caption.typewriter
        ? Math.max(1, Math.ceil(((index + 1) / picked.length) * caption.text.length))
        : caption.text.length)
      : 0;
    const needsPaint = Boolean(caption.text) || size.width !== baseWidth || size.height !== baseHeight;
    painted.push(needsPaint
      ? await paintFrame(picked[index], caption, reveal, size.width, size.height)
      : picked[index]);
  }
  await clearFrameFiles();
  for (let index = 0; index < painted.length; index += 1) {
    await ffmpeg.writeFile(`frames/f_${String(index + 1).padStart(4, "0")}.jpg`, painted[index].slice());
  }
  const palette = plan.colors >= 192 ? "stats_mode=diff" : "stats_mode=single";
  const filter = `split[s0][s1];[s0]palettegen=max_colors=${plan.colors}:${palette}[p];[s1][p]paletteuse=dither=bayer:bayer_scale=4`;
  const code = await ffmpeg.exec([
    "-framerate", String(plan.fps),
    "-start_number", "1",
    "-i", "frames/f_%04d.jpg",
    "-vf", filter,
    "-loop", "0",
    "output.gif",
  ], 180000);
  if (code !== 0) throw new Error("GIF 저장에 실패했습니다. 구간을 줄이거나 가로 크기를 낮춰 다시 시도해 주세요.");
  const gif = await ffmpeg.readFile("output.gif");
  return { gif, painted, ...size, fps: plan.fps, colors: plan.colors };
}

settings.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!current?.video || converting) {
    if (!converting) showNotice("먼저 동영상 파일을 선택해 주세요.");
    return;
  }
  const ready = await engineReady;
  if (!ready) {
    showNotice("변환 엔진이 준비되지 않았습니다.");
    return;
  }

  const { start, frames } = clipBounds();
  const { width, height } = outputSize();
  const ext = current.ext || "bin";
  const inputName = `input.${ext}`;
  const outputName = "output.gif";
  const fileName = gifFileName(current.file.name);
  converting = true;
  convertBtn.disabled = true;
  resetResult();
  progressWrap.hidden = false;
  downloadBtn.disabled = true;
  setProgress(0, "🦌 루돌프가 영상 파일을 읽고 있습니다...");
  if (genFrameCounter) genFrameCounter.textContent = `0/${frames} 프레임 처리 중`;
  if (genInternalStage) {
    genInternalStage.textContent = `내부 작업: 동영상 디코딩 및 ${width}×${height}px Lanczos 리샘플링 준비 중`;
  }
  if (genEngineTelemetry) genEngineTelemetry.textContent = "[FFmpeg WASM] 입력 스트림 버퍼 적재 중...";
  logLines = [];

  try {
    const limit = targetBytes();
    const caption = captionOptions();
    const savedFrames = await enqueue(async () => {
      await ffmpeg.writeFile(inputName, new Uint8Array(await current.file.arrayBuffer()));
      try { await ffmpeg.createDir("frames"); } catch { /* already exists */ }
      const master = [];
      const thumbStride = Math.max(1, Math.ceil(frames / 36));
      let produced = 0;
      const batchSize = 10;
      while (produced < frames) {
        const count = Math.min(batchSize, frames - produced);
        const at = start + produced / 30;
        progressFloor = (produced / frames) * 0.6;
        progressSpan = (count / frames) * 0.6;
        setProgress(progressFloor * 100, `🦌 루돌프가 30FPS 프레임 추출 중 (${produced}/${frames})`);
        const code = await ffmpeg.exec([
          "-ss", at.toFixed(3),
          "-i", inputName,
          "-frames:v", String(count),
          "-an",
          "-vf", `fps=30,scale=${width}:${height}:flags=lanczos`,
          "-q:v", "4",
          "batch_%03d.jpg",
        ], 120000);
        let wrote = 0;
        for (let n = 1; n <= count; n += 1) {
          const src = `batch_${String(n).padStart(3, "0")}.jpg`;
          let data;
          try {
            data = await ffmpeg.readFile(src);
          } catch {
            break;
          }
          master.push(data.slice());
          if (genLiveFrameImg) {
            revoke(genLiveFrameUrl);
            genLiveFrameUrl = URL.createObjectURL(new Blob([data.slice()], { type: "image/jpeg" }));
            genLiveFrameImg.src = genLiveFrameUrl;
          }
          if (genLiveFrameBadge) genLiveFrameBadge.textContent = `#${master.length}`;
          if (genFrameCounter) genFrameCounter.textContent = `${master.length}/${frames} 프레임 처리 중`;
          if (genInternalStage) {
            genInternalStage.textContent = `내부 작업: 영상 구간(${(start + master.length / 30).toFixed(2)}s) 디코딩 → ${width}×${height}px 프레임 추출 중`;
          }
          if (master.length === 1 || master.length % thumbStride === 0) addThumb(data.slice(), master.length);
          try { await ffmpeg.deleteFile(src); } catch { /* ignore */ }
          wrote += 1;
          setProgress((master.length / frames) * 60, `${master.length}/${frames} 프레임 처리 중 (30FPS 프레임 분리)`);
        }
        if (!wrote) {
          const text = logLines.join("\n").toLowerCase();
          const error = new Error(code !== 0 && /invalid data|unknown format|decoder|not supported|moov atom/.test(text)
            ? "unsupported"
            : "프레임을 만들지 못했습니다. 구간을 줄이거나 가로 크기를 낮춰 다시 시도해 주세요.");
          if (error.message === "unsupported") error.unsupported = true;
          throw error;
        }
        produced += wrote;
        if (wrote < count) break;
      }
      const plans = compressionPlans();
      let chosen = null;
      for (let index = 0; index < plans.length; index += 1) {
        const plan = plans[index];
        progressFloor = 0.62 + (index / plans.length) * 0.33;
        progressSpan = 0.33 / plans.length;
        if (genInternalStage) {
          genInternalStage.textContent = `내부 작업: ${plan.colors}색 최적 팔레트(Palettegen) 생성 및 바이어 디더링 GIF 합성 중 (${plan.fps}FPS)`;
        }
        setProgress(progressFloor * 100, limit
          ? `🦌 목표 용량에 맞추는 중 · ${plan.fps}FPS (${plan.colors}색 팔레트 압축)`
          : "🦌 루돌프가 추출된 프레임을 팔레트 매핑하여 GIF로 묶는 중입니다...");
        chosen = await encodeSelection(master, plan, width, height, caption);
        if (!limit || chosen.gif.byteLength <= limit) break;
      }
      if (genFrameCounter) genFrameCounter.textContent = `${chosen.painted.length}/${chosen.painted.length} 프레임 처리 완료`;
      if (genInternalStage) genInternalStage.textContent = "내부 작업 완료: GIF89a 루프 스트림 패키징이 끝났습니다!";
      showFrameStrip(chosen.painted);
      return chosen;
    });
    const blob = new Blob([savedFrames.gif], { type: "image/gif" });
    latestGeneratedBlob = blob;
    latestGeneratedName = fileName;
    gifUrl = URL.createObjectURL(blob);
    gifPreview.src = gifUrl;
    downloadBtn.disabled = false;
    downloadBtn.dataset.name = fileName;
    doneName.hidden = false;
    doneName.textContent = fileName;
    const fitted = !limit || blob.size <= limit;
    setProgress(100, fitted && limit && savedFrames.fps < 30 ? "🎄 목표 용량에 맞춰 압축 완료!" : "🎄 GIF 변환이 완료되었습니다!");
    if (limit && blob.size > limit) {
      showNotice(`만든 GIF는 ${formatBytes(blob.size)}입니다. 목표 ${formatBytes(limit)}에 맞추려면 구간을 짧게 하거나 가로 크기를 낮춰 주세요.`);
    }
    infoRows(gifInfo, [
      ["파일 이름", fileName],
      ["용량", formatBytes(blob.size)],
      ["목표 용량", limit ? formatBytes(limit) : "제한 없음"],
      ["크기", `${savedFrames.width} × ${savedFrames.height}`],
      ["프레임", `${savedFrames.painted.length.toLocaleString("ko-KR")}장`],
      ["속도", `${savedFrames.fps}FPS`],
      ["글자", caption.text || "없음"],
    ]);
    if (generatorOnelineSummary) {
      const estSec = Number((savedFrames.painted.length / savedFrames.fps).toFixed(1));
      generatorOnelineSummary.textContent = `✨ 이 GIF는 총 ${savedFrames.painted.length.toLocaleString("ko-KR")}장, ${estSec}초, 초당 ${savedFrames.fps}프레임입니다.`;
    }
    result.hidden = false;
  } catch (error) {
    console.error(error);
    downloadBtn.disabled = true;
    if (error.unsupported) {
      showFormatError(`${current.file.name} 은 변환 중에 지원되지 않는 영상으로 확인되었습니다. 아래 형식의 다른 파일을 선택해 주세요.`);
    } else {
      setProgress(progressTrack.getAttribute("aria-valuenow") || 0, "변환에 실패했습니다.");
      showNotice(error.message || "변환에 실패했습니다. 구간을 줄이거나 가로 크기를 낮춰 다시 시도해 주세요.");
    }
  } finally {
    progressFloor = 0;
    progressSpan = 1;
    try {
      await enqueue(async () => {
        try { await ffmpeg.deleteFile(inputName); } catch { /* ignore */ }
        try { await ffmpeg.deleteFile(outputName); } catch { /* ignore */ }
        try {
          const nodes = await ffmpeg.listDir("frames");
          for (const node of nodes || []) {
            if (node.name === "." || node.name === "..") continue;
            try { await ffmpeg.deleteFile(`frames/${node.name}`); } catch { /* ignore */ }
          }
        } catch { /* ignore */ }
      });
    } catch { /* ignore */ }
    converting = false;
    convertBtn.disabled = !current?.video;
  }
});

downloadBtn.addEventListener("click", () => {
  if (downloadBtn.disabled || !gifUrl) return;
  const link = document.createElement("a");
  link.href = gifUrl;
  link.download = downloadBtn.dataset.name || "animation.gif";
  document.body.appendChild(link);
  link.click();
  link.remove();
  if (copyGeneratedBtn) {
    copyGeneratedBtn.classList.add("tree-btn");
    copyGeneratedBtn.classList.remove("ghost-holiday-btn");
    showNotice("✅ 다운로드 완료! 아래 '클립보드에 복사' 버튼으로 바로 복사할 수도 있습니다.");
  }
});

if (copyGeneratedBtn) {
  copyGeneratedBtn.addEventListener("click", () => {
    if (!latestGeneratedBlob) return;
    window.GifStudio?.copyToClipboard?.(latestGeneratedBlob, "image/gif", copyGeneratedBtn);
  });
}

if (editGeneratedBtn) {
  editGeneratedBtn.addEventListener("click", () => {
    if (!latestGeneratedBlob) return;
    const generatedFile = new File([latestGeneratedBlob], latestGeneratedName || "generated.gif", {
      type: "image/gif",
    });
    window.GifStudio?.openInEditor?.(generatedFile, { fromGenerator: true });
  });
}

window.GifStudio = {
  ffmpeg,
  getEngineReady: () => engineReady,
  enqueue,
  setProgressHook: (fn) => { customProgressHandler = fn; },
  setLogHook: (fn) => { customLogHandler = fn; },
  clearLogs: () => { logLines = []; },
  getLogs: () => logLines.slice(),
  formatBytes,
  formatSeconds,
  infoRows,
  isGeneratorUploaded: () => Boolean(current && !workspace.hidden),
  syncSnow: null,
  openInEditor: null,
};

clipBounds();
updateTargetLabel();
convertBtn.disabled = true;
loadEngine();
