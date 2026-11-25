(function () {
  const studio = window.GifStudio;
  const $ = (id) => document.getElementById(id);

  // 탭 & 뷰 요소
  const tabEditor = $("tab-editor");
  const tabGenerator = $("tab-generator");
  const viewEditor = $("view-editor");
  const viewGenerator = $("view-generator");
  const snowCanvas = $("snow-canvas");

  // 업로드 전 영역 요소
  const editorUploadArea = $("editor-upload-area");
  const editorDropzone = $("editor-dropzone");
  const editorSelectBtn = $("editor-select-btn");
  const editorFileInput = $("editor-file-input");
  const nonGifAlert = $("editor-non-gif-alert");
  const nonGifDetail = $("editor-non-gif-detail");
  const editorRetryBtn = $("editor-retry-btn");
  const editorNotice = $("editor-notice");
  const editorEngineStatus = $("editor-engine-status");

  // 워크스페이스 상단 & 한 줄 요약 & 다운로드 후 클립보드 바
  const editorWorkspace = $("editor-workspace");
  const activeFilenameEl = $("editor-active-filename");
  const toggleCompareBtn = $("toggle-compare-btn");
  const resetEditsBtn = $("editor-reset-edits-btn");
  const changeFileBtn = $("editor-change-file-btn");
  const summaryBanner = $("editor-summary-banner");
  const summaryTextEl = $("editor-summary-text");
  const summaryTagEl = $("editor-summary-tag");
  const postDownloadBar = $("post-download-bar");
  const postDownloadMsg = $("post-download-msg");
  const postDownloadCopyBtn = $("post-download-copy-btn");

  // 원본 -> 결과 나란히 비교 패널 요소
  const comparePanel = $("compare-panel");
  const compareDeltaPill = $("compare-delta-pill");
  const compareSyncBtn = $("compare-sync-btn");
  const compareCopyBtn = $("compare-copy-btn");
  const compareHideBtn = $("compare-hide-btn");
  const compareOrigMeta = $("compare-orig-meta");
  const compareOrigImg = $("compare-orig-img");
  const compareStepLabel = $("compare-step-label");
  const compareResBadge = $("compare-res-badge");
  const compareResMeta = $("compare-res-meta");
  const compareResStage = $("compare-res-stage");

  // 왼쪽 컬럼 요소
  const origPanel = $("orig-panel");
  const origToggleBtn = $("orig-toggle-btn");
  const origGifPreview = $("orig-gif-preview");
  const origGifInfo = $("orig-gif-info");
  const resultsStack = $("editor-results-stack");

  // 오른쪽 편집 패널 & 편집 기록 요소
  const toolSelectorView = $("tool-selector-view");
  const editSourceIndicator = $("edit-source-indicator");
  const toolGrid = $("tool-grid");
  const finishSaveDesc = $("finish-save-desc");
  const openSaveModalBtn = $("open-save-modal-btn");

  const toolDetailView = $("tool-detail-view");
  const toolDetailHeader = $("tool-detail-header");
  const toolDetailBody = $("tool-detail-body");
  const editorProgressWrap = $("editor-progress-wrap");
  const editorLiveFrameImg = $("editor-live-frame-img");
  const editorLiveFrameBadge = $("editor-live-frame-badge");
  const editorFrameCounter = $("editor-frame-counter");
  const editorInternalStage = $("editor-internal-stage");
  const editorPipelineSteps = $("editor-pipeline-steps");
  const editorEngineTelemetry = $("editor-engine-telemetry");
  const editorProgressTrack = $("editor-progress-track");
  const editorProgressBar = $("editor-progress-bar");
  const editorRudolph = $("editor-rudolph");
  const editorProgressText = $("editor-progress-text");
  const editorProgressPct = $("editor-progress-pct");
  const toolInlineError = $("tool-inline-error");
  const toolReturnBtn = $("tool-return-btn");
  const toolProceedBtn = $("tool-proceed-btn");
  const toolQuickFinish = $("tool-quick-finish");
  const toolSaveBtn = $("tool-save-btn");

  const editHistoryCount = $("edit-history-count");
  const editHistoryList = $("edit-history-list");

  // 저장 모달 요소
  const saveModalBackdrop = $("save-modal-backdrop");
  const saveModalClose = $("save-modal-close");
  const saveModalCancel = $("save-modal-cancel");
  const saveModalConfirm = $("save-modal-confirm");
  const saveFilenameInput = $("save-filename-input");
  const saveExtBadge = $("save-ext-badge");
  const saveFolderDisplay = $("save-folder-display");
  const saveFolderSub = $("save-folder-sub");
  const saveChooseFolderBtn = $("save-choose-folder-btn");
  const saveModalStatus = $("save-modal-status");

  // 상태 관리
  let activeMode = "editor";
  let processing = false;
  let origState = null;         // { file, name, baseName, bytes, blobUrl, meta, fileHandle, folderLabel }
  let workingGif = null;        // { bytes, meta, label, _framesPromise }
  let latestSaveTarget = null;  // { bytes, mime, ext, label, meta }
  let lastDownloadedTarget = null;
  let compareTarget = null;     // 현재 나란히 비교 중인 결과 엔트리
  let historyEntries = [];      // [{ step, title, summary, bytes, mime, ext, meta, blobUrl, cardEl }]
  let historyCursor = 0;
  let chosenDirHandle = null;
  let currentToolId = null;
  let currentProceedAction = null;
  const allocatedUrls = [];

  function trackUrl(blob) {
    const url = URL.createObjectURL(blob);
    allocatedUrls.push(url);
    return url;
  }

  function clearAllocatedUrls() {
    while (allocatedUrls.length) {
      URL.revokeObjectURL(allocatedUrls.pop());
    }
  }

  /* =========================================================
     공통 유틸리티: 한 줄 요약 & 클립보드 복사 API
  ========================================================= */
  function cleanNumber(num) {
    if (!Number.isFinite(num)) return "0";
    const rounded = Number(num.toFixed(1));
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  }

  function formatOneLineGifSummary(meta, mime = "image/gif") {
    if (!meta) {
      if (mime === "video/mp4") return "이 결과물은 고호환성 MP4 동영상으로 변환되었습니다.";
      if (mime === "image/jpeg") return "이 결과물은 선택한 프레임의 정지 JPG 이미지(총 1장)입니다.";
      return "";
    }
    return `이 GIF는 총 ${meta.frames.toLocaleString("ko-KR")}장, ${cleanNumber(meta.duration)}초, 초당 ${cleanNumber(meta.fps)}프레임입니다.`;
  }

  function updateSummaryBanner(meta, stageLabel, mime = "image/gif") {
    summaryTextEl.textContent = formatOneLineGifSummary(meta, mime);
    summaryTagEl.textContent = stageLabel || "편집 완료";
    summaryBanner.classList.remove("is-pulsing");
    void summaryBanner.offsetWidth;
    summaryBanner.classList.add("is-pulsing");
    setTimeout(() => summaryBanner.classList.remove("is-pulsing"), 550);
  }

  function bytesToBase64(bytes) {
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  async function blobToPngBlob(blob, mime) {
    if (mime === "video/mp4") {
      return new Promise((resolve, reject) => {
        const video = document.createElement("video");
        const url = URL.createObjectURL(blob);
        video.muted = true;
        video.playsInline = true;
        video.preload = "auto";
        video.onloadeddata = () => {
          video.currentTime = Math.min(0.05, video.duration || 0);
        };
        video.onseeked = () => {
          try {
            const canvas = document.createElement("canvas");
            canvas.width = video.videoWidth || 320;
            canvas.height = video.videoHeight || 240;
            canvas.getContext("2d").drawImage(video, 0, 0);
            URL.revokeObjectURL(url);
            canvas.toBlob((png) => (png ? resolve(png) : reject(new Error("PNG 변환 실패"))), "image/png");
          } catch (e) {
            URL.revokeObjectURL(url);
            reject(e);
          }
        };
        video.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error("영상 프레임 로드 실패"));
        };
        video.src = url;
      });
    }

    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close?.();
    return new Promise((resolve, reject) => {
      canvas.toBlob((png) => (png ? resolve(png) : reject(new Error("PNG 변환 실패"))), "image/png");
    });
  }

  async function copyToClipboard(blobOrBytes, mime, btnEl) {
    const origLabel = btnEl ? btnEl.textContent : "";
    try {
      if (!navigator.clipboard || typeof window.ClipboardItem === "undefined") {
        throw new Error("이 브라우저 환경에서는 클립보드 이미지 복사를 지원하지 않습니다.");
      }

      const blob = blobOrBytes instanceof Blob
        ? blobOrBytes
        : new Blob([blobOrBytes], { type: mime });
      const rawBytes = blobOrBytes instanceof Uint8Array
        ? blobOrBytes
        : new Uint8Array(await blob.arrayBuffer());

      const pngPromise = blobToPngBlob(blob, mime);
      let copied = false;

      // 1) 브라우저가 image/gif 직접 지원 시
      if (mime === "image/gif" && typeof ClipboardItem.supports === "function" && ClipboardItem.supports("image/gif")) {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({
              "image/gif": blob,
              "image/png": pngPromise,
            }),
          ]);
          copied = true;
        } catch { /* fallback below */ }
      }

      // 2) 표준 호환: image/png + 애니메이션 보존용 text/html 데이터 URI 동시 기록
      if (!copied && mime === "image/gif" && rawBytes.byteLength <= 6 * 1024 * 1024) {
        try {
          const b64 = bytesToBase64(rawBytes);
          const htmlBlob = new Blob([`<img src="data:image/gif;base64,${b64}" alt="edited.gif">`], {
            type: "text/html",
          });
          await navigator.clipboard.write([
            new ClipboardItem({
              "image/png": pngPromise,
              "text/html": htmlBlob,
            }),
          ]);
          copied = true;
        } catch { /* fallback to png only */ }
      }

      // 3) 순수 image/png 클립보드 기록 폴백
      if (!copied) {
        const pngBlob = await pngPromise;
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": pngBlob }),
        ]);
      }

      if (btnEl) {
        btnEl.textContent = "✅ 클립보드에 복사 완료!";
        setTimeout(() => {
          btnEl.textContent = origLabel;
        }, 2300);
      }
      showEditorNotice("📋 클립보드에 복사되었습니다! 메신저나 문서에 바로 붙여넣기(Ctrl+V) 해보세요.");
    } catch (err) {
      console.error(err);
      if (btnEl) {
        btnEl.textContent = "⚠️ 복사 실패";
        setTimeout(() => {
          btnEl.textContent = origLabel;
        }, 2200);
      }
      showEditorNotice(err?.message || "클립보드 복사에 실패했습니다. HTTPS 또는 localhost 환경인지 확인해 주세요.");
    }
  }

  studio.copyToClipboard = copyToClipboard;

  function notifyDownloadComplete(target, fileName) {
    lastDownloadedTarget = target;
    postDownloadMsg.textContent = `✅ "${fileName}" 다운로드 완료! 지금 바로 클립보드에 복사해 붙여넣을 수 있어요.`;
    postDownloadBar.hidden = false;
  }

  postDownloadCopyBtn.addEventListener("click", () => {
    const target = lastDownloadedTarget || latestSaveTarget;
    if (!target) return;
    copyToClipboard(target.bytes, target.mime, postDownloadCopyBtn);
  });

  /* =========================================================
     1. 업로드 전 메인화면 눈 내리는 배경 애니메이션
  ========================================================= */
  const snowCtx = snowCanvas.getContext("2d");
  let snowFlakes = [];
  let snowRunning = false;
  let snowRaf = 0;

  function initSnowFlakes() {
    const w = window.innerWidth || 1200;
    const h = window.innerHeight || 800;
    snowCanvas.width = w;
    snowCanvas.height = h;
    const count = Math.min(110, Math.max(55, Math.floor((w * h) / 14000)));
    snowFlakes = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: 2.2 + Math.random() * 4.8,
      vy: 0.65 + Math.random() * 1.45,
      vx: (Math.random() - 0.5) * 0.6,
      phase: Math.random() * Math.PI * 2,
      crystal: Math.random() > 0.62,
      alpha: 0.65 + Math.random() * 0.35,
    }));
  }

  function drawCrystal(ctx, x, y, r, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const angle = (Math.PI / 3) * i;
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(angle) * r * 1.45, Math.sin(angle) * r * 1.45);
    }
    ctx.strokeStyle = "rgba(255, 255, 255, 0.96)";
    ctx.lineWidth = 1.4;
    ctx.shadowColor = "rgba(95, 148, 201, 0.55)";
    ctx.shadowBlur = 5;
    ctx.stroke();
    ctx.restore();
  }

  function stepSnow() {
    if (!snowRunning) return;
    const w = snowCanvas.width;
    const h = snowCanvas.height;
    snowCtx.clearRect(0, 0, w, h);

    for (const f of snowFlakes) {
      f.phase += 0.018;
      f.y += f.vy;
      f.x += f.vx + Math.sin(f.phase) * 0.42;
      if (f.y > h + 12) {
        f.y = -10;
        f.x = Math.random() * w;
      }
      if (f.x < -12) f.x = w + 10;
      if (f.x > w + 12) f.x = -10;

      if (f.crystal && f.r > 4.2) {
        drawCrystal(snowCtx, f.x, f.y, f.r, f.phase * 0.35);
      } else {
        snowCtx.save();
        snowCtx.beginPath();
        snowCtx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        snowCtx.fillStyle = `rgba(255, 255, 255, ${f.alpha})`;
        snowCtx.shadowColor = "rgba(100, 152, 206, 0.52)";
        snowCtx.shadowBlur = 6;
        snowCtx.fill();
        snowCtx.restore();
      }
    }
    snowRaf = requestAnimationFrame(stepSnow);
  }

  function shouldShowSnow() {
    if (activeMode === "editor") return !origState;
    return !studio.isGeneratorUploaded();
  }

  function syncSnow() {
    const show = shouldShowSnow();
    document.body.classList.toggle("snow-hidden", !show);
    if (show && !snowRunning) {
      snowRunning = true;
      if (!snowFlakes.length) initSnowFlakes();
      snowRaf = requestAnimationFrame(stepSnow);
    } else if (!show && snowRunning) {
      snowRunning = false;
      cancelAnimationFrame(snowRaf);
    }
  }

  window.addEventListener("resize", initSnowFlakes);
  studio.syncSnow = syncSnow;
  initSnowFlakes();
  syncSnow();

  /* =========================================================
     2. 상단 모드 전환 (초 고성능 GIF 편집기 <-> 스마트 GIF 생성기)
  ========================================================= */
  function switchMode(mode) {
    activeMode = mode;
    document.body.setAttribute("data-mode", mode);
    const isEditor = mode === "editor";
    tabEditor.classList.toggle("is-active", isEditor);
    tabEditor.setAttribute("aria-selected", String(isEditor));
    tabGenerator.classList.toggle("is-active", !isEditor);
    tabGenerator.setAttribute("aria-selected", String(!isEditor));
    viewEditor.hidden = !isEditor;
    viewGenerator.hidden = isEditor;
    syncSnow();
  }

  tabEditor.addEventListener("click", () => switchMode("editor"));
  tabGenerator.addEventListener("click", () => switchMode("generator"));

  /* =========================================================
     3. 고속 GIF 바이너리 헤더 & 프레임 파서
  ========================================================= */
  function isGifHeader(bytes) {
    if (!bytes || bytes.length < 13) return false;
    const sig = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5]);
    return sig === "GIF87a" || sig === "GIF89a";
  }

  function parseGifBinary(bytes) {
    if (!isGifHeader(bytes)) return null;
    const width = bytes[6] | (bytes[7] << 8);
    const height = bytes[8] | (bytes[9] << 8);
    const packed = bytes[10];
    let pos = 13;
    if (packed & 0x80) {
      pos += 3 * (1 << ((packed & 0x07) + 1));
    }

    let frames = 0;
    let totalSeconds = 0;
    const frameDelays = [];
    let pendingDelayCs = 10;

    while (pos < bytes.length) {
      const blockId = bytes[pos++];
      if (blockId === 0x3b) break;
      if (blockId === 0x00) continue;

      if (blockId === 0x21) {
        if (pos >= bytes.length) break;
        const label = bytes[pos++];
        if (label === 0xf9) {
          const subSize = bytes[pos++] || 0;
          if (subSize >= 4 && pos + 2 < bytes.length) {
            pendingDelayCs = bytes[pos + 1] | (bytes[pos + 2] << 8);
          }
          pos += subSize;
          while (pos < bytes.length) {
            const sz = bytes[pos++];
            if (!sz) break;
            pos += sz;
          }
        } else {
          while (pos < bytes.length) {
            const sz = bytes[pos++];
            if (!sz) break;
            pos += sz;
          }
        }
      } else if (blockId === 0x2c) {
        if (pos + 9 > bytes.length) break;
        const imgPacked = bytes[pos + 8];
        pos += 9;
        if (imgPacked & 0x80) {
          pos += 3 * (1 << ((imgPacked & 0x07) + 1));
        }
        pos += 1;
        while (pos < bytes.length) {
          const sz = bytes[pos++];
          if (!sz) break;
          pos += sz;
        }
        const frameSec = pendingDelayCs >= 2 ? pendingDelayCs * 0.01 : 0.1;
        frameDelays.push(frameSec);
        frames += 1;
        totalSeconds += frameSec;
        pendingDelayCs = 10;
      } else {
        break;
      }
    }

    if (frames === 0) {
      frames = 1;
      frameDelays.push(0.1);
    }
    if (totalSeconds <= 0) totalSeconds = frames * 0.1;
    const fps = frames > 1 ? +(frames / totalSeconds).toFixed(1) : 10;
    return {
      width,
      height,
      frames,
      duration: totalSeconds,
      fps,
      frameDelays,
    };
  }

  function stripExtension(filename) {
    const clean = (filename || "image.gif").trim();
    const dot = clean.lastIndexOf(".");
    return dot > 0 ? clean.slice(0, dot) : clean;
  }

  function extensionLower(filename) {
    const m = /\.([a-z0-9]+)$/i.exec(filename || "");
    return m ? m[1].toLowerCase() : "";
  }

  function showEditorNotice(msg) {
    editorNotice.hidden = !msg;
    editorNotice.textContent = msg || "";
  }

  /* =========================================================
     4. 원본 -> 결과 나란히 비교 패널 (Side-by-Side Comparison)
  ========================================================= */
  function updateComparisonPanel(entry, autoShow = false) {
    if (!origState || !entry || entry.step === 0) {
      comparePanel.hidden = true;
      toggleCompareBtn.hidden = true;
      compareTarget = null;
      return;
    }

    compareTarget = entry;
    toggleCompareBtn.hidden = false;
    if (autoShow) {
      comparePanel.hidden = false;
    }
    updateToggleCompareText();

    // 왼쪽: 원본
    compareOrigImg.src = origState.blobUrl;
    compareOrigMeta.textContent = `${origState.meta.width}×${origState.meta.height}px · ${origState.meta.frames}장 · ${studio.formatBytes(origState.bytes.byteLength)}`;

    // 가운데 화살표 정보
    compareStepLabel.textContent = entry.title;
    const sizeDiffPct = Math.round(((entry.bytes.byteLength - origState.bytes.byteLength) / origState.bytes.byteLength) * 100);
    const sizeDiffStr = sizeDiffPct <= 0 ? `용량 ${sizeDiffPct}%` : `용량 +${sizeDiffPct}%`;
    compareDeltaPill.textContent = `${entry.title} (${sizeDiffStr})`;

    // 오른쪽: 편집 결과
    compareResBadge.textContent = entry.title;
    if (entry.meta) {
      compareResMeta.textContent = `${entry.meta.width}×${entry.meta.height}px · ${entry.meta.frames}장 · ${studio.formatBytes(entry.bytes.byteLength)}`;
    } else {
      compareResMeta.textContent = `${entry.ext.toUpperCase().slice(1)} · ${studio.formatBytes(entry.bytes.byteLength)}`;
    }

    compareResStage.replaceChildren();
    if (entry.mime === "video/mp4") {
      const vid = document.createElement("video");
      vid.src = entry.blobUrl;
      vid.controls = true;
      vid.loop = true;
      vid.autoplay = true;
      vid.muted = true;
      vid.playsInline = true;
      compareResStage.appendChild(vid);
    } else {
      const img = document.createElement("img");
      img.id = "compare-res-img";
      img.src = entry.blobUrl;
      img.alt = `${entry.title} 비교 미리보기`;
      compareResStage.appendChild(img);
    }
  }

  function updateToggleCompareText() {
    toggleCompareBtn.textContent = comparePanel.hidden
      ? "🔍 원본 ↔ 결과 비교 펼치기"
      : "🔍 원본 ↔ 결과 비교 접기";
  }

  toggleCompareBtn.addEventListener("click", () => {
    if (!compareTarget) return;
    comparePanel.hidden = !comparePanel.hidden;
    updateToggleCompareText();
  });

  compareHideBtn.addEventListener("click", () => {
    comparePanel.hidden = true;
    updateToggleCompareText();
  });

  // 첫 프레임 동시 싱크 재생
  compareSyncBtn.addEventListener("click", () => {
    if (!origState || !compareTarget) return;
    const freshOrig = trackUrl(new Blob([origState.bytes], { type: "image/gif" }));
    origState.blobUrl = freshOrig;
    origGifPreview.src = freshOrig;

    const freshRes = trackUrl(new Blob([compareTarget.bytes], { type: compareTarget.mime }));
    compareTarget.blobUrl = freshRes;

    compareOrigImg.src = "";
    const resImg = compareResStage.querySelector("img");
    const resVid = compareResStage.querySelector("video");
    if (resImg) resImg.src = "";

    requestAnimationFrame(() => {
      compareOrigImg.src = freshOrig;
      if (resImg) resImg.src = freshRes;
      if (resVid) {
        resVid.currentTime = 0;
        resVid.play().catch(() => {});
      }
    });
  });

  compareCopyBtn.addEventListener("click", () => {
    if (!compareTarget) return;
    copyToClipboard(compareTarget.bytes, compareTarget.mime, compareCopyBtn);
  });

  /* =========================================================
     5. 오른쪽 패널 편집 기록 (Edit History & 중간 단계 되돌아가기)
  ========================================================= */
  function renderEditHistory() {
    editHistoryList.replaceChildren();
    if (!historyEntries.length) return;

    const editCount = historyEntries.length - 1;
    editHistoryCount.textContent = editCount === 0
      ? "원본 상태"
      : `총 ${editCount}단계 기록 (현재 #${historyCursor})`;

    historyEntries.forEach((entry, idx) => {
      const li = document.createElement("li");
      const isActive = idx === historyCursor;
      const isFuture = idx > historyCursor;
      li.className = `history-item${isActive ? " is-active" : ""}${isFuture ? " is-future" : ""}`;

      const subInfo = entry.meta
        ? `${entry.meta.width}×${entry.meta.height} · ${entry.meta.frames}장 · ${studio.formatBytes(entry.bytes.byteLength)}`
        : `${entry.ext.toUpperCase().slice(1)} · ${studio.formatBytes(entry.bytes.byteLength)}`;

      li.innerHTML = `
        <div class="history-item-main">
          <span class="history-step-num">${idx === 0 ? "0" : idx}</span>
          <div class="history-item-texts">
            <strong>${entry.title}</strong>
            <span>${subInfo}</span>
          </div>
        </div>
        <span class="history-revert-pill">${isActive ? "현재 단계" : "이 단계로 복귀"}</span>
      `;

      li.addEventListener("click", () => {
        if (processing || idx === historyCursor) return;
        jumpToHistoryStep(idx);
      });

      editHistoryList.appendChild(li);
    });
  }

  function findNearestGifEntry(upToIdx) {
    for (let i = upToIdx; i >= 0; i -= 1) {
      if (historyEntries[i] && historyEntries[i].mime === "image/gif" && historyEntries[i].meta) {
        return historyEntries[i];
      }
    }
    return historyEntries[0];
  }

  function jumpToHistoryStep(idx) {
    if (!historyEntries[idx] || processing) return;
    historyCursor = idx;
    const entry = historyEntries[idx];
    const gifBase = findNearestGifEntry(idx);

    workingGif = {
      bytes: gifBase.bytes,
      meta: gifBase.meta,
      label: gifBase.title,
      _framesPromise: gifBase._framesPromise || null,
    };

    latestSaveTarget = {
      bytes: entry.bytes,
      mime: entry.mime,
      ext: entry.ext,
      label: entry.title,
      meta: entry.meta,
    };

    // 왼쪽 카드 펼침/접힘 상태 동기화
    if (idx === 0) {
      setCardCollapsed(origPanel, origToggleBtn, false);
      resultsStack.querySelectorAll(".gif-card").forEach((c) => {
        const b = c.querySelector(".collapse-toggle");
        if (b) setCardCollapsed(c, b, true);
      });
      updateComparisonPanel(null, false);
      updateSummaryBanner(origState.meta, "원본 단계로 복귀", "image/gif");
    } else {
      setCardCollapsed(origPanel, origToggleBtn, true);
      historyEntries.forEach((h, hIdx) => {
        if (!h.cardEl) return;
        const b = h.cardEl.querySelector(".collapse-toggle");
        if (b) setCardCollapsed(h.cardEl, b, hIdx !== idx);
      });
      updateComparisonPanel(entry, true);
      updateSummaryBanner(entry.meta, `${entry.title} 단계 복귀`, entry.mime);
    }

    renderEditHistory();
    updateEditSourceText();

    // 열려 있는 편집 도구가 있으면 복귀된 단계 기준으로 옵션 즉시 갱신
    if (currentToolId) {
      openToolScreen(currentToolId);
    }
  }

  /* =========================================================
     6. GIF 파일 업로드 및 초기화
  ========================================================= */
  function showNonGifAlert(fileName) {
    const ext = extensionLower(fileName);
    const extLabel = ext ? `.${ext.toUpperCase()}` : "알 수 없는 형식";
    nonGifDetail.textContent = `"${fileName}" (${extLabel}) 파일이 선택되었습니다. 반짝이는 금빛 전구 아래에서는 오직 .gif 파일만 편집할 수 있어요. 다시 골라주세요!`;
    nonGifAlert.hidden = false;
    nonGifAlert.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function hideNonGifAlert() {
    nonGifAlert.hidden = true;
  }

  function detectFolderLabel(file, options = {}) {
    if (options.fromGenerator) {
      return "스마트 GIF 생성기에서 만든 파일 (다운로드/원본 폴더)";
    }
    if (file.webkitRelativePath && file.webkitRelativePath.includes("/")) {
      const parts = file.webkitRelativePath.split("/");
      parts.pop();
      return parts.join("\\");
    }
    return `원본 파일의 폴더 (${file.name} 위치)`;
  }

  async function loadGifIntoEditor(file, options = {}) {
    if (processing) {
      showEditorNotice("현재 편집 작업이 진행 중입니다. 잠시 후 다시 시도해 주세요.");
      return;
    }

    showEditorNotice(options.multiWarning ? "한 번에 한 개의 파일만 선택할 수 있어 첫 번째 파일만 불러왔습니다." : "");
    const ext = extensionLower(file.name);
    let bytes;
    try {
      bytes = new Uint8Array(await file.arrayBuffer());
    } catch {
      showEditorNotice("파일을 읽는 중 오류가 발생했습니다. 다시 선택해 주세요.");
      return;
    }

    if (ext !== "gif" || !isGifHeader(bytes)) {
      showNonGifAlert(file.name);
      return;
    }

    const meta = parseGifBinary(bytes);
    if (!meta || meta.width <= 0 || meta.height <= 0) {
      showNonGifAlert(file.name);
      return;
    }

    hideNonGifAlert();
    clearAllocatedUrls();
    resultsStack.replaceChildren();
    postDownloadBar.hidden = true;
    comparePanel.hidden = true;
    toggleCompareBtn.hidden = true;
    chosenDirHandle = null;
    lastDownloadedTarget = null;
    compareTarget = null;

    let fileHandle = null;
    if (options.handlePromise) {
      try {
        const h = await options.handlePromise;
        if (h && h.kind === "file") fileHandle = h;
      } catch { /* ignore */ }
    }

    const blob = new Blob([bytes], { type: "image/gif" });
    const blobUrl = trackUrl(blob);
    const baseName = stripExtension(file.name);

    origState = {
      file,
      name: file.name,
      baseName,
      bytes,
      blobUrl,
      meta,
      fileHandle,
      folderLabel: detectFolderLabel(file, options),
    };

    workingGif = {
      bytes,
      meta,
      label: "원본 GIF",
      _framesPromise: null,
    };

    latestSaveTarget = {
      bytes,
      mime: "image/gif",
      ext: ".gif",
      label: "원본 GIF",
      meta,
    };

    historyEntries = [
      {
        step: 0,
        title: "원본 GIF",
        bytes,
        mime: "image/gif",
        ext: ".gif",
        meta,
        blobUrl,
        cardEl: null,
        _framesPromise: null,
      },
    ];
    historyCursor = 0;

    editorUploadArea.hidden = true;
    if (editorEngineStatus) editorEngineStatus.hidden = true;
    editorWorkspace.hidden = false;
    activeFilenameEl.textContent = `${file.name} (${meta.width} × ${meta.height}px)`;
    resetEditsBtn.hidden = true;

    // 업로드 직후 한 줄 요약 표시
    updateSummaryBanner(meta, "원본 업로드 완료", "image/gif");

    setCardCollapsed(origPanel, origToggleBtn, false);
    origGifPreview.src = blobUrl;
    renderGifMetaList(origGifInfo, file.name, bytes.byteLength, meta);

    // 백그라운드에서 개별 프레임 프리뷰 비동기 준비 (실시간 프레임 모니터용)
    warmUpLiveFrames(workingGif);

    renderEditHistory();
    returnToToolSelector();
    updateEditSourceText();
    syncSnow();
  }

  function renderGifMetaList(dlEl, fileName, byteLength, meta, extraRows = []) {
    const rows = [
      ["파일 이름", fileName],
      ["크기", `${meta.width} × ${meta.height} px`],
      ["프레임 수", `${meta.frames.toLocaleString("ko-KR")} 프레임`],
      ["재생 시간", `${meta.duration.toFixed(2)}초 (초당 ${cleanNumber(meta.fps)}프레임)`],
      ["용량", studio.formatBytes(byteLength)],
      ...extraRows,
    ];
    studio.infoRows(dlEl, rows);
  }

  function resetToUploadScreen() {
    if (processing) return;
    clearAllocatedUrls();
    resultsStack.replaceChildren();
    origState = null;
    workingGif = null;
    latestSaveTarget = null;
    lastDownloadedTarget = null;
    compareTarget = null;
    historyEntries = [];
    historyCursor = 0;
    chosenDirHandle = null;
    currentToolId = null;
    origGifPreview.removeAttribute("src");
    postDownloadBar.hidden = true;
    comparePanel.hidden = true;
    toggleCompareBtn.hidden = true;
    editorWorkspace.hidden = true;
    editorUploadArea.hidden = false;
    if (editorEngineStatus) editorEngineStatus.hidden = false;
    hideNonGifAlert();
    showEditorNotice("");
    syncSnow();
  }

  function resetEditsToOriginal() {
    if (!origState || processing) return;
    resultsStack.replaceChildren();
    postDownloadBar.hidden = true;
    historyEntries = [historyEntries[0]];
    historyCursor = 0;
    jumpToHistoryStep(0);
    returnToToolSelector();
    showEditorNotice("모든 편집 기록을 비우고 원본 GIF 상태로 되돌렸습니다.");
  }

  function updateEditSourceText() {
    if (!origState) return;
    const isEdited = historyCursor > 0;
    editSourceIndicator.textContent = isEdited
      ? `현재 #${historyCursor} "${workingGif.label}" 결과(${workingGif.meta.width}×${workingGif.meta.height}px, ${workingGif.meta.frames}장)에 이어서 편집합니다.`
      : "원하는 기능을 선택하면 해당 기능 전용 편집 화면으로 전환됩니다.";
    finishSaveDesc.textContent = latestSaveTarget && historyCursor > 0
      ? `현재 선택된 결과(${latestSaveTarget.label}, ${studio.formatBytes(latestSaveTarget.bytes.byteLength)})를 원하는 이름과 위치로 저장합니다.`
      : `기본 파일명은 ${origState.baseName}_ed.gif 로 자동 지정됩니다.`;
    resetEditsBtn.hidden = historyEntries.length <= 1;
  }

  function handleIncomingEditorFiles(fileList, handlePromise = null) {
    const files = fileList ? Array.from(fileList) : [];
    if (!files.length) return;
    switchMode("editor");
    loadGifIntoEditor(files[0], {
      multiWarning: files.length > 1,
      handlePromise,
    });
  }

  editorSelectBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    editorFileInput.click();
  });
  editorDropzone.addEventListener("click", (event) => {
    if (event.target.closest("button")) return;
    editorFileInput.click();
  });
  editorRetryBtn.addEventListener("click", () => editorFileInput.click());
  editorFileInput.addEventListener("change", () => {
    handleIncomingEditorFiles(editorFileInput.files, null);
    editorFileInput.value = "";
  });

  editorDropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    editorDropzone.classList.add("is-over");
  });
  editorDropzone.addEventListener("dragleave", () => editorDropzone.classList.remove("is-over"));
  editorDropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    editorDropzone.classList.remove("is-over");
    let handlePromise = null;
    try {
      const item = event.dataTransfer?.items?.[0];
      if (item && typeof item.getAsFileSystemHandle === "function") {
        handlePromise = item.getAsFileSystemHandle();
      }
    } catch { /* ignore */ }
    handleIncomingEditorFiles(event.dataTransfer?.files, handlePromise);
  });

  window.__takeEditorFiles = handleIncomingEditorFiles;
  if (window.__pendingEditorFile && window.__pendingEditorFile.files) {
    const pending = window.__pendingEditorFile;
    window.__pendingEditorFile = null;
    handleIncomingEditorFiles(pending.files, pending.handlePromise);
  }

  studio.openInEditor = (file, opts = {}) => {
    switchMode("editor");
    loadGifIntoEditor(file, opts);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  changeFileBtn.addEventListener("click", resetToUploadScreen);
  resetEditsBtn.addEventListener("click", resetEditsToOriginal);

  /* =========================================================
     7. 왼쪽 결과 카드 생성 (한 줄 요약 + 다운로드 후 클립보드 복사 포함)
  ========================================================= */
  function setCardCollapsed(cardEl, toggleBtn, collapsed) {
    cardEl.classList.toggle("is-collapsed", collapsed);
    toggleBtn.setAttribute("aria-expanded", String(!collapsed));
  }

  origToggleBtn.addEventListener("click", () => {
    const willCollapse = !origPanel.classList.contains("is-collapsed");
    setCardCollapsed(origPanel, origToggleBtn, willCollapse);
  });

  function triggerQuickDownload(url, downloadName) {
    const a = document.createElement("a");
    a.href = url;
    a.download = downloadName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function appendResultPanel(output) {
    const {
      panelTitle,
      pillText,
      downloadName,
      bytes,
      mime,
      ext,
      meta,
      extraInfo = [],
    } = output;

    // 만약 이전 단계로 되돌아간 상태에서 새 편집을 실행했다면 이후 단계 카드 제거
    if (historyCursor < historyEntries.length - 1) {
      const removed = historyEntries.splice(historyCursor + 1);
      removed.forEach((r) => r.cardEl?.remove());
    }

    // 원본 패널 및 이전 결과 카드 자동 접기
    setCardCollapsed(origPanel, origToggleBtn, true);
    resultsStack.querySelectorAll(".gif-card").forEach((prevCard) => {
      const btn = prevCard.querySelector(".collapse-toggle");
      if (btn) setCardCollapsed(prevCard, btn, true);
    });

    const blob = new Blob([bytes], { type: mime });
    const url = trackUrl(blob);

    const card = document.createElement("article");
    card.className = "gif-card is-result-card";

    const header = document.createElement("header");
    header.className = "gif-card-header";

    const toggleBtn = document.createElement("button");
    toggleBtn.className = "collapse-toggle";
    toggleBtn.type = "button";
    toggleBtn.setAttribute("aria-expanded", "true");
    toggleBtn.title = "접기/펼치기";
    toggleBtn.innerHTML = `
      <svg class="chevron-icon" viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
        <path d="M5 7.5L10 12.5L15 7.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;

    const titleEl = document.createElement("h3");
    titleEl.className = "gif-card-title";
    titleEl.textContent = panelTitle;

    const pillEl = document.createElement("span");
    pillEl.className = "card-pill result-pill";
    pillEl.textContent = pillText || "Edited";

    header.append(toggleBtn, titleEl, pillEl);

    const body = document.createElement("div");
    body.className = "gif-card-body";

    // 카드 내부 한 줄 요약 표시
    const cardSummary = document.createElement("p");
    cardSummary.className = "card-oneline-summary";
    cardSummary.textContent = `✨ ${formatOneLineGifSummary(meta, mime)}`;

    const stage = document.createElement("div");
    stage.className = "gif-stage";

    if (mime === "video/mp4") {
      const video = document.createElement("video");
      video.src = url;
      video.controls = true;
      video.loop = true;
      video.autoplay = true;
      video.muted = true;
      video.playsInline = true;
      stage.appendChild(video);
    } else {
      const img = document.createElement("img");
      img.src = url;
      img.alt = `${panelTitle} 결과 미리보기`;
      stage.appendChild(img);
    }

    const dl = document.createElement("dl");
    dl.className = "file-info compact-info";
    if (meta) {
      renderGifMetaList(dl, downloadName, bytes.byteLength, meta, extraInfo);
    } else {
      studio.infoRows(dl, [
        ["파일 이름", downloadName],
        ["용량", studio.formatBytes(bytes.byteLength)],
        ...extraInfo,
      ]);
    }

    const actions = document.createElement("div");
    actions.className = "result-card-actions";

    const dlBtn = document.createElement("button");
    dlBtn.type = "button";
    dlBtn.className = "tree-btn";
    dlBtn.textContent = `⬇ 다운로드 (${downloadName})`;

    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "ghost-holiday-btn";
    copyBtn.textContent = "📋 클립보드에 복사";
    copyBtn.addEventListener("click", () => copyToClipboard(bytes, mime, copyBtn));

    const cmpBtn = document.createElement("button");
    cmpBtn.type = "button";
    cmpBtn.className = "ghost-holiday-btn";
    cmpBtn.textContent = "🔍 원본과 비교";

    const saveAsBtn = document.createElement("button");
    saveAsBtn.type = "button";
    saveAsBtn.className = "ghost-holiday-btn";
    saveAsBtn.textContent = "📁 이름·위치 저장";

    // 다운로드 클릭 후 나타나는 카드 전용 클립보드 복사 안내 박스
    const postDlBox = document.createElement("div");
    postDlBox.className = "card-post-download";
    postDlBox.hidden = true;
    const postDlText = document.createElement("span");
    postDlText.textContent = "✅ 다운로드 완료! 바로 복사할까요?";
    const postDlCopyBtn = document.createElement("button");
    postDlCopyBtn.type = "button";
    postDlCopyBtn.className = "tree-btn copy-clip-btn";
    postDlCopyBtn.textContent = "📋 클립보드에 복사";
    postDlCopyBtn.addEventListener("click", () => copyToClipboard(bytes, mime, postDlCopyBtn));
    postDlBox.append(postDlText, postDlCopyBtn);

    const historyEntry = {
      step: historyEntries.length,
      title: `${panelTitle}${pillText ? ` (${pillText})` : ""}`,
      bytes,
      mime,
      ext,
      meta,
      blobUrl: url,
      cardEl: card,
      _framesPromise: null,
    };

    dlBtn.addEventListener("click", () => {
      triggerQuickDownload(url, downloadName);
      postDlBox.hidden = false;
      notifyDownloadComplete(historyEntry, downloadName);
    });

    cmpBtn.addEventListener("click", () => {
      updateComparisonPanel(historyEntry, true);
      comparePanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });

    saveAsBtn.addEventListener("click", () => {
      latestSaveTarget = { bytes, mime, ext, label: panelTitle, meta };
      openSaveModal();
    });

    actions.append(dlBtn, copyBtn, cmpBtn, saveAsBtn);
    body.append(cardSummary, stage, dl, actions, postDlBox);
    card.append(header, body);

    toggleBtn.addEventListener("click", () => {
      const willCollapse = !card.classList.contains("is-collapsed");
      setCardCollapsed(card, toggleBtn, willCollapse);
    });

    resultsStack.appendChild(card);

    historyEntries.push(historyEntry);
    historyCursor = historyEntries.length - 1;
    renderEditHistory();
    updateComparisonPanel(historyEntry, true);
    updateSummaryBanner(meta, `${panelTitle} 완료`, mime);

    card.scrollIntoView({ behavior: "smooth", block: "nearest" });
    return historyEntry;
  }

  /* =========================================================
     8. 가로 전체 프레임 펼치기 & 드래그 시작~끝 구간 선택 위젯
        + 실시간 처리 모니터용 비동기 프레임 스트리밍 캐시
  ========================================================= */
  function warmUpLiveFrames(gifState) {
    if (!gifState || gifState._liveFrames) return;
    gifState._liveFrames = [];
    if (typeof window.ImageDecoder !== "function") return;

    (async () => {
      try {
        const supported = await window.ImageDecoder.isTypeSupported("image/gif");
        if (!supported) return;
        const decoder = new window.ImageDecoder({
          data: gifState.bytes.slice(),
          type: "image/gif",
        });
        await decoder.tracks.ready;
        const count = decoder.tracks.selectedTrack?.frameCount || gifState.meta.frames;
        const delays = gifState.meta.frameDelays || [];
        const thumbH = 96;
        const thumbW = Math.max(44, Math.round((gifState.meta.width / gifState.meta.height) * thumbH));
        const canvas = document.createElement("canvas");
        canvas.width = thumbW;
        canvas.height = thumbH;
        const ctx = canvas.getContext("2d");
        let accSec = 0;

        for (let i = 0; i < count; i += 1) {
          const { image } = await decoder.decode({ frameIndex: i });
          ctx.clearRect(0, 0, thumbW, thumbH);
          ctx.drawImage(image, 0, 0, thumbW, thumbH);
          const durUs = image.duration || 0;
          image.close?.();
          const durSec = durUs >= 20000 ? durUs / 1_000_000 : (delays[i] || 0.1);
          const startSec = accSec;
          accSec += durSec;
          const blob = await new Promise((res) => canvas.toBlob(res, "image/png"));
          gifState._liveFrames.push({
            index: i,
            url: trackUrl(blob),
            startSec,
            endSec: accSec,
            durSec,
          });
          if (i % 20 === 19) await new Promise((r) => setTimeout(r, 0));
        }
        decoder.close?.();
      } catch { /* fallback handled gracefully */ }
    })();
  }

  async function decodeAllFramesForStrip(gifState) {
    if (gifState._framesPromise) return gifState._framesPromise;
    if (gifState._liveFrames && gifState._liveFrames.length === gifState.meta.frames) {
      gifState._framesPromise = Promise.resolve(gifState._liveFrames);
      return gifState._framesPromise;
    }

    gifState._framesPromise = (async () => {
      const bytes = gifState.bytes;
      const meta = gifState.meta;
      const delays = meta.frameDelays || [];
      const thumbH = 64;
      const thumbW = Math.max(36, Math.round((meta.width / meta.height) * thumbH));

      // 1) 브라우저 네이티브 ImageDecoder 지원 시 초고속 전체 프레임 디코딩
      if (typeof window.ImageDecoder === "function") {
        try {
          const supported = await window.ImageDecoder.isTypeSupported("image/gif");
          if (supported) {
            const decoder = new window.ImageDecoder({
              data: bytes.slice(),
              type: "image/gif",
            });
            await decoder.tracks.ready;
            const track = decoder.tracks.selectedTrack;
            const count = track?.frameCount || meta.frames;
            const items = [];
            let accSec = 0;

            const canvas = document.createElement("canvas");
            canvas.width = thumbW;
            canvas.height = thumbH;
            const ctx = canvas.getContext("2d");

            for (let i = 0; i < count; i += 1) {
              const { image } = await decoder.decode({ frameIndex: i });
              ctx.clearRect(0, 0, thumbW, thumbH);
              ctx.drawImage(image, 0, 0, thumbW, thumbH);
              const durUs = image.duration || 0;
              image.close?.();
              const durSec = durUs >= 20000 ? durUs / 1_000_000 : (delays[i] || 0.1);
              const startSec = accSec;
              accSec += durSec;

              const blob = await new Promise((res) => canvas.toBlob(res, "image/png"));
              items.push({
                index: i,
                url: trackUrl(blob),
                startSec,
                endSec: accSec,
                durSec,
              });
              if (i % 24 === 23) {
                await new Promise((r) => setTimeout(r, 0));
              }
            }
            decoder.close?.();
            if (items.length) return items;
          }
        } catch (err) {
          console.warn("ImageDecoder fallback to FFmpeg:", err);
        }
      }

      // 2) 범용 FFmpeg 폴백 디코딩
      const ready = await studio.getEngineReady();
      if (!ready) throw new Error("엔진 준비 대기 중");

      return studio.enqueue(async () => {
        const ff = studio.ffmpeg;
        const inName = "strip_src.gif";
        try {
          await ff.writeFile(inName, bytes.slice());
          try { await ff.createDir("strip_frames"); } catch { /* exists */ }
          await ff.exec([
            "-hide_banner",
            "-i", inName,
            "-vsync", "0",
            "-vf", `scale=${thumbW}:${thumbH}:flags=bilinear`,
            "-q:v", "5",
            "strip_frames/sf_%04d.jpg",
          ], 120000);

          const items = [];
          let accSec = 0;
          for (let i = 0; i < meta.frames; i += 1) {
            const fname = `strip_frames/sf_${String(i + 1).padStart(4, "0")}.jpg`;
            let fbytes;
            try {
              fbytes = await ff.readFile(fname);
              await ff.deleteFile(fname);
            } catch {
              break;
            }
            const durSec = delays[i] || (meta.duration / meta.frames);
            const startSec = accSec;
            accSec += durSec;
            items.push({
              index: i,
              url: trackUrl(new Blob([fbytes], { type: "image/jpeg" })),
              startSec,
              endSec: accSec,
              durSec,
            });
          }
          return items;
        } finally {
          try { await ff.deleteFile(inName); } catch { /* ignore */ }
        }
      });
    })();

    return gifState._framesPromise;
  }

  function mountFrameStripSelector(parentEl, gifState, options = {}) {
    const totalFrames = gifState.meta.frames;
    let startIdx = options.initialStartIdx ?? 0;
    let endIdx = options.initialEndIdx ?? (totalFrames - 1);
    startIdx = Math.max(0, Math.min(startIdx, totalFrames - 1));
    endIdx = Math.max(startIdx, Math.min(endIdx, totalFrames - 1));

    let framesData = [];
    let frameEls = [];
    let dragMode = null; // 'sweep' | 'start' | 'end'
    let sweepAnchor = 0;

    const widget = document.createElement("div");
    widget.className = "filmstrip-widget";
    widget.innerHTML = `
      <div class="filmstrip-top-bar">
        <span class="filmstrip-title">🎞️ 전체 프레임 가로 펼침 (드래그하여 시작~끝 구간 지정)</span>
        <div class="filmstrip-quick-btns">
          <button type="button" class="filmstrip-mini-btn" data-q="all">전체 구간 (1~${totalFrames}장)</button>
          <button type="button" class="filmstrip-mini-btn" data-q="first">앞 절반</button>
          <button type="button" class="filmstrip-mini-btn" data-q="second">뒤 절반</button>
        </div>
      </div>
      <div class="filmstrip-scroll" role="listbox" aria-label="GIF 전체 프레임 목록">
        <div class="filmstrip-loading">🦌 전체 ${totalFrames}개 프레임을 가로로 펼치는 중입니다...</div>
      </div>
      <div class="filmstrip-hint">
        <span class="filmstrip-range-label">선택 구간 계산 중...</span>
        <span>💡 프레임을 마우스로 쭉 드래그하거나 양끝 [시작/끝] 핸들을 끌어 조절하세요</span>
      </div>
    `;
    parentEl.appendChild(widget);

    const scrollBox = widget.querySelector(".filmstrip-scroll");
    const rangeLabel = widget.querySelector(".filmstrip-range-label");

    function getRangeInfo() {
      const totalDur = gifState.meta.duration;
      const startSec = framesData[startIdx]
        ? framesData[startIdx].startSec
        : (startIdx / totalFrames) * totalDur;
      const endSec = framesData[endIdx]
        ? framesData[endIdx].endSec
        : ((endIdx + 1) / totalFrames) * totalDur;
      return {
        startIdx,
        endIdx,
        count: endIdx - startIdx + 1,
        totalFrames,
        startSec,
        endSec,
        durationSec: Math.max(0.02, endSec - startSec),
      };
    }

    function refreshVisualSelection(emit = true) {
      frameEls.forEach((el, idx) => {
        const inRange = idx >= startIdx && idx <= endIdx;
        el.classList.toggle("in-range", inRange);
        el.classList.toggle("is-range-start", idx === startIdx);
        el.classList.toggle("is-range-end", idx === endIdx);
        el.querySelectorAll(".filmstrip-handle-badge").forEach((b) => b.remove());

        if (idx === startIdx) {
          const sb = document.createElement("span");
          sb.className = "filmstrip-handle-badge start-handle";
          sb.dataset.handle = "start";
          sb.textContent = "◀ 시작";
          el.appendChild(sb);
        }
        if (idx === endIdx) {
          const eb = document.createElement("span");
          eb.className = "filmstrip-handle-badge end-handle";
          eb.dataset.handle = "end";
          eb.textContent = "끝 ▶";
          el.appendChild(eb);
        }
      });

      const info = getRangeInfo();
      rangeLabel.textContent = `드래그 선택: #${info.startIdx + 1}번 ~ #${info.endIdx + 1}번 프레임 (총 ${info.count}장 · ${info.durationSec.toFixed(2)}초)`;
      if (emit) options.onChange?.(info);
    }

    function frameIndexAtClientX(clientX) {
      if (!frameEls.length) return 0;
      const rect = scrollBox.getBoundingClientRect();
      // 컨테이너 좌우 가장자리 근처 드래그 시 자동 스크롤
      if (clientX < rect.left + 44) {
        scrollBox.scrollLeft -= 18;
      } else if (clientX > rect.right - 44) {
        scrollBox.scrollLeft += 18;
      }

      let closestIdx = 0;
      let minDist = Infinity;
      for (let i = 0; i < frameEls.length; i += 1) {
        const r = frameEls[i].getBoundingClientRect();
        const center = (r.left + r.right) / 2;
        const dist = Math.abs(clientX - center);
        if (dist < minDist) {
          minDist = dist;
          closestIdx = i;
        }
      }
      return closestIdx;
    }

    scrollBox.addEventListener("pointerdown", (event) => {
      if (!frameEls.length) return;
      const handleEl = event.target.closest(".filmstrip-handle-badge");
      const frameEl = event.target.closest(".filmstrip-frame");
      if (!handleEl && !frameEl) return;

      event.preventDefault();
      scrollBox.setPointerCapture?.(event.pointerId);

      if (handleEl?.dataset.handle === "start") {
        dragMode = "start";
      } else if (handleEl?.dataset.handle === "end") {
        dragMode = "end";
      } else {
        dragMode = "sweep";
        const idx = frameEl ? Number(frameEl.dataset.index) : frameIndexAtClientX(event.clientX);
        sweepAnchor = idx;
        startIdx = idx;
        endIdx = idx;
        refreshVisualSelection(true);
      }
    });

    scrollBox.addEventListener("pointermove", (event) => {
      if (!dragMode || !frameEls.length) return;
      const idx = frameIndexAtClientX(event.clientX);
      if (dragMode === "start") {
        startIdx = Math.min(idx, endIdx);
      } else if (dragMode === "end") {
        endIdx = Math.max(idx, startIdx);
      } else if (dragMode === "sweep") {
        startIdx = Math.min(sweepAnchor, idx);
        endIdx = Math.max(sweepAnchor, idx);
      }
      refreshVisualSelection(true);
    });

    const endPointerDrag = (event) => {
      if (!dragMode) return;
      dragMode = null;
      try { scrollBox.releasePointerCapture?.(event.pointerId); } catch { /* ignore */ }
    };
    scrollBox.addEventListener("pointerup", endPointerDrag);
    scrollBox.addEventListener("pointercancel", endPointerDrag);

    widget.querySelectorAll(".filmstrip-mini-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const q = btn.dataset.q;
        if (q === "all") {
          startIdx = 0;
          endIdx = totalFrames - 1;
        } else if (q === "first") {
          startIdx = 0;
          endIdx = Math.max(0, Math.floor((totalFrames - 1) / 2));
        } else if (q === "second") {
          startIdx = Math.floor(totalFrames / 2);
          endIdx = totalFrames - 1;
        }
        refreshVisualSelection(true);
      });
    });

    decodeAllFramesForStrip(gifState)
      .then((items) => {
        framesData = items;
        scrollBox.replaceChildren();
        frameEls = items.map((item, idx) => {
          const cell = document.createElement("div");
          cell.className = "filmstrip-frame";
          cell.dataset.index = String(idx);
          cell.setAttribute("role", "option");
          cell.innerHTML = `
            <img src="${item.url}" alt="${idx + 1}번 프레임" draggable="false">
            <span class="filmstrip-idx">#${idx + 1}</span>
            <span class="filmstrip-time">${item.startSec.toFixed(2)}s</span>
          `;
          scrollBox.appendChild(cell);
          return cell;
        });
        refreshVisualSelection(true);
      })
      .catch(() => {
        scrollBox.innerHTML = `<div class="filmstrip-loading">프레임 미리보기를 불러오지 못했습니다. 아래 수치 입력으로 구간을 조절할 수 있습니다.</div>`;
        refreshVisualSelection(true);
      });

    return {
      getRange: getRangeInfo,
      setRange(newStart, newEnd, emit = false) {
        startIdx = Math.max(0, Math.min(newStart, totalFrames - 1));
        endIdx = Math.max(startIdx, Math.min(newEnd, totalFrames - 1));
        refreshVisualSelection(emit);
      },
    };
  }

  /* =========================================================
     9. 실시간 프레임별 내부 처리 모니터 + 루돌프 진행 바 & FFmpeg 엔진
  ========================================================= */
  function setEditorProgress(pct, message) {
    const clamped = Math.max(0, Math.min(100, Math.round(pct)));
    editorProgressBar.style.width = `${clamped}%`;
    editorRudolph.style.left = `${clamped}%`;
    editorProgressTrack.setAttribute("aria-valuenow", String(clamped));
    editorProgressPct.textContent = `${clamped}%`;
    if (message) editorProgressText.textContent = message;
  }

  function setPipelineStage(stageKey) {
    const order = ["decode", "filter", "palette", "encode"];
    const activeIdx = order.indexOf(stageKey);
    editorPipelineSteps.querySelectorAll("li").forEach((li, idx) => {
      li.classList.toggle("is-done", idx < activeIdx);
      li.classList.toggle("is-active", idx === activeIdx);
    });
  }

  function showToolError(msg) {
    toolInlineError.hidden = !msg;
    toolInlineError.textContent = msg || "";
  }

  async function runFfmpegJob(jobConfig, workerFn) {
    if (processing || !workingGif) return;

    const cfg = typeof jobConfig === "string"
      ? { statusMessage: jobConfig }
      : (jobConfig || {});

    const totalFrames = Math.max(1, cfg.totalFrames || workingGif.meta.frames || 1);
    const filterDesc = cfg.filterDesc || "픽셀 필터 및 프레임 변환 연산";
    const outputKind = cfg.outputKind || "gif"; // 'gif' | 'mp4' | 'jpg'
    const mapFrame = cfg.mapFrameIndex || ((k) => Math.min(workingGif.meta.frames - 1, k));

    // 실시간 개별 프레임 준비 보장
    warmUpLiveFrames(workingGif);
    const fallbackPreviewUrl = origState?.blobUrl || "";

    showToolError("");
    toolQuickFinish.hidden = true;
    processing = true;
    toolProceedBtn.disabled = true;
    toolReturnBtn.disabled = true;
    editorProgressWrap.hidden = false;

    let displayedFrame = 1;
    let ffmpegReportedFrame = 0;
    let activeStageKey = "decode";

    function renderLiveFrameStep(frameNum, stageLabelOverride) {
      const fNum = Math.max(1, Math.min(totalFrames, Math.round(frameNum)));
      displayedFrame = fNum;
      const srcIdx = Math.max(0, Math.min((workingGif.meta.frames || 1) - 1, mapFrame(fNum - 1)));
      const liveList = workingGif._liveFrames || [];
      if (liveList[srcIdx]) {
        editorLiveFrameImg.src = liveList[srcIdx].url;
      } else if (fallbackPreviewUrl && !editorLiveFrameImg.getAttribute("src")) {
        editorLiveFrameImg.src = fallbackPreviewUrl;
      }
      editorLiveFrameBadge.textContent = `#${srcIdx + 1}`;
      editorFrameCounter.textContent = `${fNum}/${totalFrames} 프레임 처리 중`;

      if (stageLabelOverride) {
        editorInternalStage.textContent = stageLabelOverride;
      }
    }

    // 파이프라인 3단계 라벨을 출력 포맷에 맞게 조정
    const paletteStepLi = editorPipelineSteps.querySelector('[data-stage="palette"]');
    if (paletteStepLi) {
      paletteStepLi.textContent = outputKind === "mp4"
        ? "3. YUV420P·H.264 압축"
        : outputKind === "jpg"
          ? "3. 배경 합성·JPEG 인코딩"
          : "3. 팔레트·디더링";
    }

    setPipelineStage("decode");
    renderLiveFrameStep(1, `내부 작업: 원본 GIF 스트림 디코딩 및 ${totalFrames}개 프레임 분리 중`);
    editorEngineTelemetry.textContent = "[FFmpeg WASM] 입력 바이트 버퍼 적재 및 스트림 분석 시작...";
    setEditorProgress(4, cfg.statusMessage || `1/${totalFrames} 프레임 처리 중`);

    const ready = await studio.getEngineReady();
    if (!ready) {
      processing = false;
      toolProceedBtn.disabled = false;
      toolReturnBtn.disabled = false;
      showToolError("변환 엔진이 아직 준비되지 않았습니다. 잠시 후 다시 시도해 주세요.");
      return;
    }

    // 1) 실시간 프레임 티커: 팔레트 분석 구간에서도 실제 GIF 프레임을 한 장씩 순차 표시
    const tickerInterval = setInterval(() => {
      if (!processing) return;
      if (ffmpegReportedFrame > 0) {
        if (displayedFrame < ffmpegReportedFrame) {
          renderLiveFrameStep(displayedFrame + 1);
        }
      } else if (displayedFrame < totalFrames) {
        const nextF = displayedFrame + 1;
        if (nextF >= Math.ceil(totalFrames * 0.25) && activeStageKey === "decode") {
          activeStageKey = "filter";
          setPipelineStage("filter");
        }
        const stageMsg = activeStageKey === "decode"
          ? `내부 작업: GIF LZW 블록 해제 및 프레임 분리 중 (${nextF}/${totalFrames})`
          : `내부 작업: ${filterDesc} 적용 중 (${nextF}/${totalFrames})`;
        renderLiveFrameStep(nextF, stageMsg);
        const estPct = Math.min(72, Math.round((nextF / totalFrames) * 68) + 5);
        setEditorProgress(estPct, `${nextF}/${totalFrames} 프레임 처리 중 · ${filterDesc}`);
      }
    }, 48);

    // 2) FFmpeg 실시간 로그 파서: 실제 엔진 내부 동작 및 frame= 카운트 직결
    studio.setLogHook((rawLine) => {
      const line = (rawLine || "").trim();
      if (!line) return;
      editorEngineTelemetry.textContent = `[FFmpeg] ${line}`;

      if (/Input #0,\s*gif/i.test(line)) {
        activeStageKey = "decode";
        setPipelineStage("decode");
        editorInternalStage.textContent = "내부 작업: 입력 GIF 논리 화면 디스크립터 및 컬러 테이블 분석 중";
      } else if (/Stream mapping|Parsed_(scale|crop|pad|transpose|hflip|vflip|reverse|setpts|select)/i.test(line)) {
        activeStageKey = "filter";
        setPipelineStage("filter");
        editorInternalStage.textContent = `내부 작업: 필터 그래프 구성 완료 → ${filterDesc}`;
      } else if (/palettegen/i.test(line)) {
        activeStageKey = "palette";
        setPipelineStage("palette");
        editorInternalStage.textContent = "내부 작업: 전체 프레임 색상 분포를 스캔해 최적 색상 팔레트 생성 중";
      } else if (/libx264|mpeg4/i.test(line)) {
        activeStageKey = "palette";
        setPipelineStage("palette");
        editorInternalStage.textContent = "내부 작업: YUV420P 색공간 매핑 및 H.264 비디오 프레임 인코딩 중";
      }

      const frameMatch = line.match(/frame=\s*(\d+)/);
      if (frameMatch) {
        const fCount = Math.min(totalFrames, Math.max(1, Number(frameMatch[1])));
        ffmpegReportedFrame = fCount;
        activeStageKey = fCount >= totalFrames ? "encode" : "palette";
        setPipelineStage(activeStageKey);

        const timeMatch = line.match(/time=\s*([\d:.]+)/);
        const timeStr = timeMatch ? ` · 타임스탬프 ${timeMatch[1]}` : "";
        const stageText = outputKind === "mp4"
          ? `내부 작업: H.264 프레임 인코딩 중 (${fCount}/${totalFrames}${timeStr})`
          : outputKind === "jpg"
            ? `내부 작업: 타깃 프레임 추출 및 알파 채널 배경 합성 중`
            : `내부 작업: 최적 팔레트 매핑 및 바이어 디더링 합성 중 (${fCount}/${totalFrames}${timeStr})`;

        renderLiveFrameStep(fCount, stageText);
        const pct = Math.min(96, 55 + Math.round((fCount / totalFrames) * 41));
        setEditorProgress(pct, `${fCount}/${totalFrames} 프레임 처리 중`);
      }
    });

    studio.setProgressHook((local) => {
      if (ffmpegReportedFrame === 0) {
        const mappedFrame = Math.max(displayedFrame, Math.min(totalFrames, Math.ceil(local * totalFrames)));
        renderLiveFrameStep(mappedFrame);
        setEditorProgress(Math.max(10, Math.round(10 + local * 82)), `${mappedFrame}/${totalFrames} 프레임 처리 중`);
      }
    });

    try {
      const output = await studio.enqueue(async () => {
        studio.clearLogs();
        return workerFn(studio.ffmpeg);
      });

      clearInterval(tickerInterval);

      // 초고속 처리된 경우에도 마지막 프레임까지 낱장 진행이 눈에 보이도록 부드럽게 마무리
      while (displayedFrame < totalFrames) {
        const stepJump = Math.max(1, Math.ceil((totalFrames - displayedFrame) / 6));
        renderLiveFrameStep(
          Math.min(totalFrames, displayedFrame + stepJump),
          `내부 작업: ${filterDesc} 및 출력 스트림 패키징 마무리 중`
        );
        await new Promise((r) => setTimeout(r, 22));
      }

      setPipelineStage("encode");
      editorPipelineSteps.querySelectorAll("li").forEach((li) => {
        li.classList.remove("is-active");
        li.classList.add("is-done");
      });
      editorFrameCounter.textContent = `${totalFrames}/${totalFrames} 프레임 처리 완료`;
      editorInternalStage.textContent = `내부 작업 완료: ${output.panelTitle} 파일 스트림 생성 완료 (${studio.formatBytes(output.bytes.byteLength)})`;
      editorEngineTelemetry.textContent = `[FFmpeg WASM] 완료 · 출력 크기 ${studio.formatBytes(output.bytes.byteLength)}`;
      setEditorProgress(100, `🎄 ${totalFrames}/${totalFrames} 프레임 처리 완료!`);

      const createdEntry = appendResultPanel(output);

      if (output.mime === "image/gif" && output.meta) {
        workingGif = {
          bytes: output.bytes,
          meta: output.meta,
          label: output.panelTitle,
          _framesPromise: createdEntry._framesPromise,
          _liveFrames: null,
        };
        warmUpLiveFrames(workingGif);
      }
      latestSaveTarget = {
        bytes: output.bytes,
        mime: output.mime,
        ext: output.ext,
        label: output.panelTitle,
        meta: output.meta,
      };

      updateEditSourceText();
      toolQuickFinish.hidden = false;
    } catch (err) {
      clearInterval(tickerInterval);
      console.error(err);
      showToolError(err?.message || "처리 중 문제가 발생했습니다. 옵션을 조정해 다시 시도해 주세요.");
      setEditorProgress(0, "처리에 실패했습니다.");
    } finally {
      clearInterval(tickerInterval);
      studio.setProgressHook(null);
      studio.setLogHook(null);
      processing = false;
      toolProceedBtn.disabled = false;
      toolReturnBtn.disabled = false;
    }
  }

  async function encodeGifWithFilter(ff, inputBytes, vfChain, options = {}) {
    const inFile = "ed_in.gif";
    const outFile = "ed_out.gif";
    const maxColors = options.maxColors || 256;
    const statsMode = options.statsMode || "diff";
    const bayerScale = options.bayerScale ?? 5;
    const diffMode = options.diffMode || "rectangle";
    const extraInputArgs = options.inputArgs || [];
    const extraOutputArgs = options.outputArgs || [];

    try {
      await ff.writeFile(inFile, inputBytes.slice());
      const filterComplex = options.rawFilterComplex
        ? `${options.rawFilterComplex},split[s0][s1];[s0]palettegen=max_colors=${maxColors}:reserve_transparent=1:stats_mode=${statsMode}[p];[s1][p]paletteuse=dither=bayer:bayer_scale=${bayerScale}:diff_mode=${diffMode}`
        : `[0:v]${vfChain ? `${vfChain},` : ""}split[s0][s1];[s0]palettegen=max_colors=${maxColors}:reserve_transparent=1:stats_mode=${statsMode}[p];[s1][p]paletteuse=dither=bayer:bayer_scale=${bayerScale}:diff_mode=${diffMode}`;

      const code = await ff.exec([
        "-hide_banner",
        ...extraInputArgs,
        "-i", inFile,
        "-filter_complex", filterComplex,
        ...extraOutputArgs,
        "-loop", "0",
        "-y",
        outFile,
      ], 180000);

      if (code !== 0) {
        throw new Error("GIF 필터 처리에 실패했습니다. 설정 값을 확인해 주세요.");
      }
      const outBytes = (await ff.readFile(outFile)).slice();
      const outMeta = parseGifBinary(outBytes);
      return { bytes: outBytes, meta: outMeta };
    } finally {
      try { await ff.deleteFile(inFile); } catch { /* ignore */ }
      try { await ff.deleteFile(outFile); } catch { /* ignore */ }
    }
  }

  /* =========================================================
     10. 9가지 편집 도구 전용 화면 빌더
  ========================================================= */
  const TOOL_META = {
    resize: {
      title: "Resize · 크기 조절",
      desc: "가로·세로 크기를 원본의 5% ~ 300% 범위에서 자유롭게 조절합니다.",
      icon: "📐",
    },
    crop: {
      title: "Crop · 비율 자르기",
      desc: "원하는 비율로 자르고, 남는 여백 채우기 또는 확대 맞춤을 선택합니다.",
      icon: "✂️",
    },
    downsizing: {
      title: "Downsizing · 용량 줄이기",
      desc: "크기 축소, 프레임 제거, 해상도 낮추기 중 체크한 방식만 정확히 적용합니다.",
      icon: "📉",
    },
    convert: {
      title: "Format Convert · 포맷 변환",
      desc: "GIF 애니메이션을 고호환성 MP4 동영상 또는 고화질 JPG 이미지로 변환합니다.",
      icon: "🔄",
    },
    rotate: {
      title: "Rotate · 회전 및 뒤집기",
      desc: "90° / 180° / 270° 회전과 상하·좌우 반전을 조합해 방향을 바꿉니다.",
      icon: "🔃",
    },
    optimize: {
      title: "Optimize · 화질 유지 용량 최적화",
      desc: "크기와 프레임 수는 그대로 유지하면서 화질 손실을 최소화해 용량을 줄입니다.",
      icon: "💎",
    },
    reverse: {
      title: "Reverse · 역재생 (프레임 구간 드래그 지원)",
      desc: "모든 프레임을 가로로 펼쳐 원하는 시작~끝 구간을 드래그해 역재생합니다.",
      icon: "⏪",
    },
    speed: {
      title: "Speed · 속도 조절 (프레임 구간 드래그 지원)",
      desc: "가로로 펼쳐진 프레임에서 구간을 드래그하고 원하는 배속으로 조절합니다.",
      icon: "⚡",
    },
    cut: {
      title: "Cut · 구간 잘라내기 (프레임 드래그 지원)",
      desc: "가로로 펼쳐진 모든 프레임에서 시작과 끝을 드래그해 정확히 잘라냅니다.",
      icon: "🎞️",
    },
  };

  function returnToToolSelector() {
    if (processing) return;
    currentToolId = null;
    currentProceedAction = null;
    toolDetailView.hidden = true;
    toolSelectorView.hidden = false;
    editorProgressWrap.hidden = true;
    toolQuickFinish.hidden = true;
    showToolError("");
    updateEditSourceText();
  }

  function openToolScreen(toolId) {
    if (!workingGif || processing) return;
    currentToolId = toolId;
    const info = TOOL_META[toolId];
    toolSelectorView.hidden = true;
    toolDetailView.hidden = false;
    editorProgressWrap.hidden = true;
    toolQuickFinish.hidden = true;
    showToolError("");

    toolDetailHeader.innerHTML = `
      <div class="tool-detail-badge" aria-hidden="true">${info.icon}</div>
      <div class="tool-detail-titles">
        <h3>${info.title}</h3>
        <p>${info.desc}</p>
      </div>
    `;

    toolDetailBody.replaceChildren();
    const builders = {
      resize: buildResizeTool,
      crop: buildCropTool,
      downsizing: buildDownsizingTool,
      convert: buildConvertTool,
      rotate: buildRotateTool,
      optimize: buildOptimizeTool,
      reverse: buildReverseTool,
      speed: buildSpeedTool,
      cut: buildCutTool,
    };
    builders[toolId]?.();
  }

  toolGrid.addEventListener("click", (event) => {
    const btn = event.target.closest(".tool-tile");
    if (!btn) return;
    openToolScreen(btn.dataset.tool);
  });

  toolReturnBtn.addEventListener("click", returnToToolSelector);
  toolProceedBtn.addEventListener("click", () => currentProceedAction?.());
  toolSaveBtn.addEventListener("click", () => openSaveModal());

  /* ---------------------------------------------------------
     Tool 1: Resize
  --------------------------------------------------------- */
  function buildResizeTool() {
    const baseW = workingGif.meta.width;
    const baseH = workingGif.meta.height;
    const minW = Math.max(1, Math.round(baseW * 0.05));
    const maxW = Math.max(2, Math.round(baseW * 3.0));
    const minH = Math.max(1, Math.round(baseH * 0.05));
    const maxH = Math.max(2, Math.round(baseH * 3.0));

    let locked = true;

    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <div class="control">
        <label for="rz-width">
          <span>가로 크기 (Width)</span>
          <strong id="rz-width-readout">${baseW}px (100%)</strong>
        </label>
        <input id="rz-width" type="range" min="${minW}" max="${maxW}" step="1" value="${baseW}">
      </div>

      <div class="resize-lock-row">
        <button id="rz-lock-btn" class="lock-toggle-btn" type="button" aria-pressed="true" title="클릭하여 비율 고정 잠금/해제">
          <span id="rz-lock-svg"></span>
          <span id="rz-lock-text">비율 유지 잠금됨</span>
        </button>
      </div>

      <div class="control">
        <label for="rz-height">
          <span>세로 크기 (Height)</span>
          <strong id="rz-height-readout">${baseH}px (100%)</strong>
        </label>
        <input id="rz-height" type="range" min="${minH}" max="${maxH}" step="1" value="${baseH}">
      </div>

      <div id="rz-summary" class="summary-callout">
        기준 크기 ${baseW} × ${baseH}px → 변경 크기 ${baseW} × ${baseH}px (범위: 5% ~ 300%)
      </div>
    `;
    toolDetailBody.appendChild(wrap);

    const wSlider = $("rz-width");
    const hSlider = $("rz-height");
    const wReadout = $("rz-width-readout");
    const hReadout = $("rz-height-readout");
    const lockBtn = $("rz-lock-btn");
    const lockSvg = $("rz-lock-svg");
    const lockText = $("rz-lock-text");
    const summary = $("rz-summary");

    function renderLockIcon() {
      if (locked) {
        lockBtn.classList.remove("is-unlocked");
        lockBtn.setAttribute("aria-pressed", "true");
        lockText.textContent = "가로·세로 비율 잠금됨 (클릭 시 해제)";
        lockSvg.innerHTML = `
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <rect x="5" y="11" width="14" height="10" rx="2.5" fill="currentColor"/>
            <path d="M8 11V7a4 4 0 0 1 8 0v4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
          </svg>
        `;
      } else {
        lockBtn.classList.add("is-unlocked");
        lockBtn.setAttribute("aria-pressed", "false");
        lockText.textContent = "비율 잠금 해제됨 (각각 독립 조절)";
        lockSvg.innerHTML = `
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <rect x="5" y="11" width="14" height="10" rx="2.5" fill="currentColor"/>
            <path d="M8 11V7a4 4 0 0 1 7.6-1.8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
          </svg>
        `;
      }
    }

    function updateReadouts() {
      const w = Number(wSlider.value);
      const h = Number(hSlider.value);
      const wPct = Math.round((w / baseW) * 100);
      const hPct = Math.round((h / baseH) * 100);
      wReadout.textContent = `${w}px (${wPct}%)`;
      hReadout.textContent = `${h}px (${hPct}%)`;
      summary.textContent = `기준 크기 ${baseW} × ${baseH}px → 변경 크기 ${w} × ${h}px (가로 ${wPct}% · 세로 ${hPct}%)`;
    }

    wSlider.addEventListener("input", () => {
      if (locked) {
        const ratio = Number(wSlider.value) / baseW;
        hSlider.value = String(Math.min(maxH, Math.max(minH, Math.round(baseH * ratio))));
      }
      updateReadouts();
    });

    hSlider.addEventListener("input", () => {
      if (locked) {
        const ratio = Number(hSlider.value) / baseH;
        wSlider.value = String(Math.min(maxW, Math.max(minW, Math.round(baseW * ratio))));
      }
      updateReadouts();
    });

    lockBtn.addEventListener("click", () => {
      locked = !locked;
      if (locked) {
        const ratio = Number(wSlider.value) / baseW;
        hSlider.value = String(Math.min(maxH, Math.max(minH, Math.round(baseH * ratio))));
      }
      renderLockIcon();
      updateReadouts();
    });

    renderLockIcon();
    updateReadouts();

    currentProceedAction = () => {
      const targetW = Math.max(2, Number(wSlider.value));
      const targetH = Math.max(2, Number(hSlider.value));
      const srcBytes = workingGif.bytes;
      const downloadName = `Resized_${origState.name}`;

      runFfmpegJob({
        totalFrames: workingGif.meta.frames,
        filterDesc: `Lanczos 보간법으로 ${targetW}×${targetH}px 픽셀 리샘플링`,
      }, async (ff) => {
        const { bytes, meta } = await encodeGifWithFilter(
          ff,
          srcBytes,
          `scale=${targetW}:${targetH}:flags=lanczos`
        );
        return {
          panelTitle: "Resized GIF",
          pillText: `${targetW}×${targetH}`,
          downloadName,
          bytes,
          mime: "image/gif",
          ext: ".gif",
          meta,
          extraInfo: [["적용 작업", `크기 조절 (${targetW} × ${targetH} px)`]],
        };
      });
    };
  }

  /* ---------------------------------------------------------
     Tool 2: Crop
  --------------------------------------------------------- */
  function buildCropTool() {
    const srcW = workingGif.meta.width;
    const srcH = workingGif.meta.height;

    const ratios = [
      { label: "1:1 정사각형", w: 1, h: 1 },
      { label: "4:3 표준", w: 4, h: 3 },
      { label: "16:9 와이드", w: 16, h: 9 },
      { label: "9:16 세로형", w: 9, h: 16 },
      { label: "3:4 포스터", w: 3, h: 4 },
      { label: "21:9 시네마", w: 21, h: 9 },
    ];

    let selectedRatio = ratios[0];
    let fitMode = "cover";
    let padColor = "#ffffff";
    let zoomFactor = 100;

    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <div class="control">
        <label>목표 가로:세로 비율 선택</label>
        <div id="crop-ratio-chips" class="chip-row" style="margin-top:8px;"></div>
        <div class="clip-grid" style="margin-top:10px;">
          <div>
            <label for="crop-ar-w" style="font-size:12.5px;">가로 비율</label>
            <input id="crop-ar-w" class="text-field" type="number" min="1" max="100" value="1">
          </div>
          <div>
            <label for="crop-ar-h" style="font-size:12.5px;">세로 비율</label>
            <input id="crop-ar-h" class="text-field" type="number" min="1" max="100" value="1">
          </div>
        </div>
      </div>

      <div class="control">
        <label>맞춤 방식 선택</label>
        <div class="choice-cards" style="margin-top:8px;">
          <label id="crop-card-cover" class="choice-card is-selected">
            <input type="radio" name="crop-fit-mode" value="cover" checked>
            <span class="choice-card-text">
              <strong>🔍 이미지를 확대해서 여백 없이 맞춤</strong>
              <span>선택한 비율에 꽉 차도록 이미지를 확대·크롭하여 빈 여백 없이 채웁니다.</span>
            </span>
          </label>
          <label id="crop-card-pad" class="choice-card">
            <input type="radio" name="crop-fit-mode" value="pad">
            <span class="choice-card-text">
              <strong>🎨 남는 여백을 단색으로 채움</strong>
              <span>원본 화면이 잘리지 않게 유지하고, 비율 외 남는 여백을 선택한 단색으로 채웁니다.</span>
            </span>
          </label>
        </div>
      </div>

      <div id="crop-zoom-box" class="control">
        <label for="crop-zoom">추가 확대 배율 <strong id="crop-zoom-label">100%</strong></label>
        <input id="crop-zoom" type="range" min="100" max="200" step="5" value="100">
      </div>

      <div id="crop-color-box" class="control" hidden>
        <label for="crop-pad-color">여백 채우기 단색 선택 <strong id="crop-color-hex">#FFFFFF</strong></label>
        <div class="swatch-row">
          <input id="crop-pad-color" type="color" value="#ffffff" style="margin-top:0;">
          <button type="button" class="color-swatch is-selected" data-color="#ffffff" style="background:#ffffff;" title="화이트"></button>
          <button type="button" class="color-swatch" data-color="#000000" style="background:#000000;" title="블랙"></button>
          <button type="button" class="color-swatch" data-color="#fff8e7" style="background:#fff8e7;" title="크림"></button>
          <button type="button" class="color-swatch" data-color="#c81e2b" style="background:#c81e2b;" title="크리스마스 레드"></button>
          <button type="button" class="color-swatch" data-color="#166534" style="background:#166534;" title="트리 그린"></button>
          <button type="button" class="color-swatch" data-color="#dbeafe" style="background:#dbeafe;" title="윈터 블루"></button>
        </div>
      </div>

      <div class="live-mini-stage">
        <canvas id="crop-preview-canvas" width="260" height="180"></canvas>
        <span id="crop-summary" class="field-hint">출력 크기 계산 중...</span>
      </div>
    `;
    toolDetailBody.appendChild(wrap);

    const chipBox = $("crop-ratio-chips");
    const arWInput = $("crop-ar-w");
    const arHInput = $("crop-ar-h");
    const cardCover = $("crop-card-cover");
    const cardPad = $("crop-card-pad");
    const zoomBox = $("crop-zoom-box");
    const zoomSlider = $("crop-zoom");
    const zoomLabel = $("crop-zoom-label");
    const colorBox = $("crop-color-box");
    const colorInput = $("crop-pad-color");
    const colorHex = $("crop-color-hex");
    const previewCanvas = $("crop-preview-canvas");
    const cropSummary = $("crop-summary");

    const sampleImg = new Image();
    sampleImg.onload = () => renderCropPreview();
    sampleImg.src = trackUrl(new Blob([workingGif.bytes], { type: "image/gif" }));

    ratios.forEach((r, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `option-chip${idx === 0 ? " is-selected" : ""}`;
      btn.textContent = r.label;
      btn.addEventListener("click", () => {
        selectedRatio = r;
        arWInput.value = String(r.w);
        arHInput.value = String(r.h);
        chipBox.querySelectorAll(".option-chip").forEach((c) => c.classList.remove("is-selected"));
        btn.classList.add("is-selected");
        renderCropPreview();
      });
      chipBox.appendChild(btn);
    });

    [arWInput, arHInput].forEach((inp) => {
      inp.addEventListener("input", () => {
        const w = Math.max(1, Number(arWInput.value) || 1);
        const h = Math.max(1, Number(arHInput.value) || 1);
        selectedRatio = { label: `${w}:${h}`, w, h };
        chipBox.querySelectorAll(".option-chip").forEach((c) => c.classList.remove("is-selected"));
        renderCropPreview();
      });
    });

    wrap.querySelectorAll('input[name="crop-fit-mode"]').forEach((radio) => {
      radio.addEventListener("change", () => {
        fitMode = radio.value;
        cardCover.classList.toggle("is-selected", fitMode === "cover");
        cardPad.classList.toggle("is-selected", fitMode === "pad");
        zoomBox.hidden = fitMode !== "cover";
        colorBox.hidden = fitMode !== "pad";
        renderCropPreview();
      });
    });

    zoomSlider.addEventListener("input", () => {
      zoomFactor = Number(zoomSlider.value) || 100;
      zoomLabel.textContent = `${zoomFactor}%`;
      renderCropPreview();
    });

    colorInput.addEventListener("input", () => {
      padColor = colorInput.value;
      colorHex.textContent = padColor.toUpperCase();
      colorBox.querySelectorAll(".color-swatch").forEach((s) => s.classList.remove("is-selected"));
      renderCropPreview();
    });

    colorBox.querySelectorAll(".color-swatch").forEach((sw) => {
      sw.addEventListener("click", () => {
        padColor = sw.dataset.color;
        colorInput.value = padColor;
        colorHex.textContent = padColor.toUpperCase();
        colorBox.querySelectorAll(".color-swatch").forEach((s) => s.classList.remove("is-selected"));
        sw.classList.add("is-selected");
        renderCropPreview();
      });
    });

    function computeCropPlan() {
      const targetR = Math.max(0.05, (Number(arWInput.value) || 1) / (Number(arHInput.value) || 1));
      const srcR = srcW / srcH;

      if (fitMode === "cover") {
        let baseCropW;
        let baseCropH;
        if (srcR > targetR) {
          baseCropH = srcH;
          baseCropW = Math.max(2, Math.round(srcH * targetR));
        } else {
          baseCropW = srcW;
          baseCropH = Math.max(2, Math.round(srcW / targetR));
        }
        const z = zoomFactor / 100;
        const subW = Math.max(2, Math.round(baseCropW / z));
        const subH = Math.max(2, Math.round(baseCropH / z));
        const x = Math.max(0, Math.floor((srcW - subW) / 2));
        const y = Math.max(0, Math.floor((srcH - subH) / 2));
        const vf = z > 1.001
          ? `crop=${subW}:${subH}:${x}:${y},scale=${baseCropW}:${baseCropH}:flags=lanczos`
          : `crop=${baseCropW}:${baseCropH}:${x}:${y}`;
        return { outW: baseCropW, outH: baseCropH, vf, subW, subH, x, y };
      }

      let outW;
      let outH;
      if (srcR > targetR) {
        outW = srcW;
        outH = Math.max(srcH, Math.round(srcW / targetR));
      } else {
        outH = srcH;
        outW = Math.max(srcW, Math.round(srcH * targetR));
      }
      const hexClean = padColor.replace("#", "0x");
      const vf = `pad=${outW}:${outH}:(ow-iw)/2:(oh-ih)/2:color=${hexClean}`;
      return { outW, outH, vf };
    }

    function renderCropPreview() {
      const plan = computeCropPlan();
      const scale = Math.min(200 / plan.outW, 170 / plan.outH);
      const cw = Math.max(24, Math.round(plan.outW * scale));
      const ch = Math.max(24, Math.round(plan.outH * scale));
      previewCanvas.width = cw;
      previewCanvas.height = ch;
      const ctx = previewCanvas.getContext("2d");
      ctx.clearRect(0, 0, cw, ch);

      if (sampleImg.complete && sampleImg.naturalWidth > 0) {
        if (fitMode === "cover") {
          ctx.drawImage(sampleImg, plan.x, plan.y, plan.subW, plan.subH, 0, 0, cw, ch);
        } else {
          ctx.fillStyle = padColor;
          ctx.fillRect(0, 0, cw, ch);
          const dw = Math.round(srcW * scale);
          const dh = Math.round(srcH * scale);
          ctx.drawImage(sampleImg, Math.round((cw - dw) / 2), Math.round((ch - dh) / 2), dw, dh);
        }
      }

      cropSummary.textContent = fitMode === "cover"
        ? `미리보기: ${selectedRatio.w}:${selectedRatio.h} 비율 확대 맞춤 → ${plan.outW} × ${plan.outH}px`
        : `미리보기: ${selectedRatio.w}:${selectedRatio.h} 비율 단색(${padColor.toUpperCase()}) 여백 채움 → ${plan.outW} × ${plan.outH}px`;
    }

    renderCropPreview();

    currentProceedAction = () => {
      const plan = computeCropPlan();
      const srcBytes = workingGif.bytes;
      const downloadName = `Cropped_${origState.name}`;
      const modeDesc = fitMode === "cover" ? "확대하여 여백 없이 맞춤" : `여백 단색(${padColor.toUpperCase()}) 채움`;

      runFfmpegJob({
        totalFrames: workingGif.meta.frames,
        filterDesc: `${selectedRatio.w}:${selectedRatio.h} 비율 ${modeDesc} 연산 (${plan.outW}×${plan.outH}px)`,
      }, async (ff) => {
        const { bytes, meta } = await encodeGifWithFilter(ff, srcBytes, plan.vf, {
          statsMode: fitMode === "pad" ? "single" : "diff",
        });
        return {
          panelTitle: "Cropped GIF",
          pillText: `${selectedRatio.w}:${selectedRatio.h}`,
          downloadName,
          bytes,
          mime: "image/gif",
          ext: ".gif",
          meta,
          extraInfo: [["적용 작업", `Crop (${selectedRatio.w}:${selectedRatio.h} · ${modeDesc})`]],
        };
      });
    };
  }

  /* ---------------------------------------------------------
     Tool 3: Downsizing
  --------------------------------------------------------- */
  function buildDownsizingTool() {
    const srcW = workingGif.meta.width;
    const srcH = workingGif.meta.height;
    const srcFrames = workingGif.meta.frames;
    const srcFps = workingGif.meta.fps;

    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <p class="field-hint" style="margin:0;">원하는 경량화 방식만 체크하세요. 체크하지 않은 항목은 원본 그대로 유지됩니다.</p>

      <div id="ds-box-scale" class="downsize-method-box is-checked">
        <label class="check" style="margin:0;">
          <input id="ds-chk-scale" type="checkbox" checked>
          <span>1. 크기 축소 (가로·세로 화면 크기 줄이기)</span>
        </label>
        <div id="ds-sub-scale" class="downsize-sub">
          <label for="ds-scale-range" style="display:flex;justify-content:space-between;font-size:13px;font-weight:700;">
            <span>축소 비율</span>
            <strong id="ds-scale-label">70% (${Math.round(srcW * 0.7)} × ${Math.round(srcH * 0.7)}px)</strong>
          </label>
          <input id="ds-scale-range" type="range" min="25" max="90" step="5" value="70">
        </div>
      </div>

      <div id="ds-box-frame" class="downsize-method-box">
        <label class="check" style="margin:0;">
          <input id="ds-chk-frame" type="checkbox">
          <span>2. 프레임 제거 (중간 프레임을 솎아내어 장수 줄이기)</span>
        </label>
        <div id="ds-sub-frame" class="downsize-sub" hidden>
          <label for="ds-frame-step" style="font-size:13px;font-weight:700;">프레임 간소화 단계</label>
          <select id="ds-frame-step" class="text-field">
            <option value="2">2장당 1장 유지 (프레임 약 50% 제거 · 자연스러움)</option>
            <option value="3">3장당 1장 유지 (프레임 약 67% 제거 · 높은 압축)</option>
            <option value="4">4장당 1장 유지 (프레임 약 75% 제거 · 최대 절감)</option>
          </select>
        </div>
      </div>

      <div id="ds-box-res" class="downsize-method-box">
        <label class="check" style="margin:0;">
          <input id="ds-chk-res" type="checkbox">
          <span>3. 해상도 낮추기 (픽셀 정밀도·색상 팔레트 밀도 낮추기)</span>
        </label>
        <div id="ds-sub-res" class="downsize-sub" hidden>
          <label for="ds-res-level" style="font-size:13px;font-weight:700;">해상도·색상 압축 강도</label>
          <select id="ds-res-level" class="text-field">
            <option value="light">약하게 (128색 · 픽셀 디테일 80%)</option>
            <option value="medium" selected>보통 (64색 · 픽셀 디테일 65%)</option>
            <option value="strong">강하게 (32색 · 픽셀 디테일 50%)</option>
          </select>
        </div>
      </div>

      <div id="ds-summary" class="summary-callout"></div>
    `;
    toolDetailBody.appendChild(wrap);

    const chkScale = $("ds-chk-scale");
    const chkFrame = $("ds-chk-frame");
    const chkRes = $("ds-chk-res");
    const boxScale = $("ds-box-scale");
    const boxFrame = $("ds-box-frame");
    const boxRes = $("ds-box-res");
    const subScale = $("ds-sub-scale");
    const subFrame = $("ds-sub-frame");
    const subRes = $("ds-sub-res");
    const scaleRange = $("ds-scale-range");
    const scaleLabel = $("ds-scale-label");
    const frameStep = $("ds-frame-step");
    const resLevel = $("ds-res-level");
    const summary = $("ds-summary");

    function syncDownsizeUi() {
      boxScale.classList.toggle("is-checked", chkScale.checked);
      subScale.hidden = !chkScale.checked;
      boxFrame.classList.toggle("is-checked", chkFrame.checked);
      subFrame.hidden = !chkFrame.checked;
      boxRes.classList.toggle("is-checked", chkRes.checked);
      subRes.hidden = !chkRes.checked;

      const pct = Number(scaleRange.value);
      const w = Math.max(2, Math.round((srcW * pct) / 100));
      const h = Math.max(2, Math.round((srcH * pct) / 100));
      scaleLabel.textContent = `${pct}% (${w} × ${h}px)`;

      const applied = [];
      if (chkScale.checked) applied.push(`크기 ${pct}% 축소`);
      if (chkFrame.checked) applied.push(`프레임 1/${frameStep.value} 유지 (예상 약 ${Math.max(1, Math.ceil(srcFrames / Number(frameStep.value)))}장)`);
      if (chkRes.checked) applied.push(`해상도 낮추기 (${resLevel.options[resLevel.selectedIndex].text.split(" ")[0]})`);
      summary.textContent = applied.length
        ? `적용 예정 항목: ${applied.join(" + ")}`
        : "⚠️ 최소 한 가지 이상의 방식을 체크해 주세요.";
    }

    [chkScale, chkFrame, chkRes, scaleRange, frameStep, resLevel].forEach((el) => {
      el.addEventListener("input", syncDownsizeUi);
      el.addEventListener("change", syncDownsizeUi);
    });
    syncDownsizeUi();

    currentProceedAction = () => {
      if (!chkScale.checked && !chkFrame.checked && !chkRes.checked) {
        showToolError("크기 축소, 프레임 제거, 해상도 낮추기 중 최소 하나를 체크해 주세요.");
        return;
      }

      const filters = [];
      const appliedLabels = [];
      let outW = srcW;
      let outH = srcH;

      if (chkFrame.checked) {
        const div = Number(frameStep.value) || 2;
        const targetFps = Math.max(1, +(srcFps / div).toFixed(2));
        filters.push(`fps=${targetFps}`);
        appliedLabels.push(`프레임 1/${div}`);
      }
      if (chkScale.checked) {
        const pct = Number(scaleRange.value) / 100;
        outW = Math.max(2, Math.round(srcW * pct));
        outH = Math.max(2, Math.round(srcH * pct));
        filters.push(`scale=${outW}:${outH}:flags=lanczos`);
        appliedLabels.push(`크기 ${scaleRange.value}%`);
      }

      let maxColors = 256;
      let statsMode = "diff";
      let bayerScale = 5;

      if (chkRes.checked) {
        const lvl = resLevel.value;
        const detailRatio = lvl === "light" ? 0.8 : lvl === "medium" ? 0.65 : 0.5;
        maxColors = lvl === "light" ? 128 : lvl === "medium" ? 64 : 32;
        statsMode = "single";
        bayerScale = 3;
        const lowW = Math.max(2, Math.round(outW * detailRatio));
        const lowH = Math.max(2, Math.round(outH * detailRatio));
        filters.push(`scale=${lowW}:${lowH}:flags=bilinear,scale=${outW}:${outH}:flags=neighbor`);
        appliedLabels.push(`해상도 낮추기(${maxColors}색)`);
      }

      const srcBytes = workingGif.bytes;
      const beforeSize = srcBytes.byteLength;
      const downloadName = `Downsized_${origState.name}`;

      const frameDiv = chkFrame.checked ? (Number(frameStep.value) || 2) : 1;
      const estOutFrames = Math.max(1, Math.ceil(srcFrames / frameDiv));

      runFfmpegJob({
        totalFrames: estOutFrames,
        filterDesc: `경량화 필터(${appliedLabels.join(" + ")}) 연산`,
        mapFrameIndex: (k) => k * frameDiv,
      }, async (ff) => {
        const { bytes, meta } = await encodeGifWithFilter(ff, srcBytes, filters.join(","), {
          maxColors,
          statsMode,
          bayerScale,
        });
        const diffPct = Math.round(((bytes.byteLength - beforeSize) / beforeSize) * 100);
        const diffLabel = diffPct <= 0 ? `${diffPct}% 절감` : `+${diffPct}%`;
        return {
          panelTitle: "Downsized GIF",
          pillText: diffLabel,
          downloadName,
          bytes,
          mime: "image/gif",
          ext: ".gif",
          meta,
          extraInfo: [
            ["적용 방식", appliedLabels.join(", ")],
            ["용량 비교", `${studio.formatBytes(beforeSize)} → ${studio.formatBytes(bytes.byteLength)} (${diffLabel})`],
          ],
        };
      });
    };
  }

  /* ---------------------------------------------------------
     Tool 4: Format Convert
  --------------------------------------------------------- */
  function buildConvertTool() {
    const totalFrames = workingGif.meta.frames;
    let targetFmt = "mp4";

    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <div class="control">
        <label>변환할 파일 형식 선택</label>
        <div class="choice-cards" style="margin-top:8px;">
          <label id="cv-card-mp4" class="choice-card is-selected">
            <input type="radio" name="cv-fmt" value="mp4" checked>
            <span class="choice-card-text">
              <strong>🎬 MP4 동영상으로 변환 (.mp4)</strong>
              <span>모든 기기와 SNS에서 부드럽게 재생되는 H.264 MP4 영상으로 변환합니다.</span>
            </span>
          </label>
          <label id="cv-card-jpg" class="choice-card">
            <input type="radio" name="cv-fmt" value="jpg">
            <span class="choice-card-text">
              <strong>🖼️ JPG 이미지로 변환 (.jpg)</strong>
              <span>원하는 장면을 고화질 정지 이미지(.jpg)로 추출하여 저장합니다.</span>
            </span>
          </label>
        </div>
      </div>

      <div id="cv-mp4-opts" class="control">
        <label for="cv-mp4-loop">MP4 반복 재생 횟수</label>
        <select id="cv-mp4-loop" class="text-field">
          <option value="1" selected>1회 재생 (원본 길이 그대로)</option>
          <option value="2">2회 연속 반복 (짧은 움짤에 추천)</option>
          <option value="3">3회 연속 반복</option>
        </select>
      </div>

      <div id="cv-jpg-opts" class="control" hidden>
        <label for="cv-jpg-frame">추출할 프레임 번호 <strong id="cv-jpg-frame-label">1 / ${totalFrames} 프레임</strong></label>
        <input id="cv-jpg-frame" type="range" min="1" max="${Math.max(1, totalFrames)}" step="1" value="1">
        <div class="clip-grid" style="margin-top:10px;">
          <div>
            <label for="cv-jpg-bg" style="font-size:13px;">투명 배경 채움색</label>
            <input id="cv-jpg-bg" type="color" value="#ffffff">
          </div>
          <div>
            <label for="cv-jpg-q" style="font-size:13px;">JPG 화질 <strong id="cv-jpg-q-label">92%</strong></label>
            <input id="cv-jpg-q" type="range" min="60" max="100" step="2" value="92">
          </div>
        </div>
      </div>
    `;
    toolDetailBody.appendChild(wrap);

    const cardMp4 = $("cv-card-mp4");
    const cardJpg = $("cv-card-jpg");
    const mp4Opts = $("cv-mp4-opts");
    const jpgOpts = $("cv-jpg-opts");
    const loopSelect = $("cv-mp4-loop");
    const frameSlider = $("cv-jpg-frame");
    const frameLabel = $("cv-jpg-frame-label");
    const bgInput = $("cv-jpg-bg");
    const qSlider = $("cv-jpg-q");
    const qLabel = $("cv-jpg-q-label");

    wrap.querySelectorAll('input[name="cv-fmt"]').forEach((r) => {
      r.addEventListener("change", () => {
        targetFmt = r.value;
        cardMp4.classList.toggle("is-selected", targetFmt === "mp4");
        cardJpg.classList.toggle("is-selected", targetFmt === "jpg");
        mp4Opts.hidden = targetFmt !== "mp4";
        jpgOpts.hidden = targetFmt !== "jpg";
      });
    });

    frameSlider.addEventListener("input", () => {
      frameLabel.textContent = `${frameSlider.value} / ${totalFrames} 프레임`;
    });
    qSlider.addEventListener("input", () => {
      qLabel.textContent = `${qSlider.value}%`;
    });

    currentProceedAction = () => {
      const srcBytes = workingGif.bytes;
      const srcMeta = workingGif.meta;

      if (targetFmt === "mp4") {
        const loops = Math.max(1, Number(loopSelect.value) || 1);
        const downloadName = `Converted_${origState.baseName}.mp4`;
        const evenW = Math.max(2, srcMeta.width + (srcMeta.width % 2));
        const evenH = Math.max(2, srcMeta.height + (srcMeta.height % 2));

        runFfmpegJob({
          totalFrames: srcMeta.frames * loops,
          outputKind: "mp4",
          filterDesc: `GIF 프레임 → ${evenW}×${evenH} YUV420P 색공간 변환 및 H.264 압축`,
          mapFrameIndex: (k) => k % srcMeta.frames,
        }, async (ff) => {
          const inFile = "cv_in.gif";
          const outFile = "cv_out.mp4";
          try {
            await ff.writeFile(inFile, srcBytes.slice());
            const inputArgs = loops > 1 ? ["-stream_loop", String(loops - 1)] : [];
            const vf = `pad=${evenW}:${evenH}:0:0:color=white,format=yuv420p`;
            let code = await ff.exec([
              "-hide_banner",
              ...inputArgs,
              "-i", inFile,
              "-vf", vf,
              "-c:v", "libx264",
              "-preset", "ultrafast",
              "-crf", "23",
              "-movflags", "+faststart",
              "-y",
              outFile,
            ], 180000);

            if (code !== 0) {
              code = await ff.exec([
                "-hide_banner",
                ...inputArgs,
                "-i", inFile,
                "-vf", vf,
                "-c:v", "mpeg4",
                "-q:v", "4",
                "-y",
                outFile,
              ], 180000);
            }
            if (code !== 0) throw new Error("MP4 변환에 실패했습니다.");
            const mp4Bytes = (await ff.readFile(outFile)).slice();
            return {
              panelTitle: "Converted MP4",
              pillText: "MP4 Video",
              downloadName,
              bytes: mp4Bytes,
              mime: "video/mp4",
              ext: ".mp4",
              meta: null,
              extraInfo: [
                ["출력 포맷", "MP4 (H.264 동영상)"],
                ["해상도", `${evenW} × ${evenH} px`],
                ["반복 횟수", `${loops}회 재생`],
              ],
            };
          } finally {
            try { await ff.deleteFile(inFile); } catch { /* ignore */ }
            try { await ff.deleteFile(outFile); } catch { /* ignore */ }
          }
        });
      } else {
        const targetIdx = Math.max(0, Number(frameSlider.value) - 1);
        const bgHex = bgInput.value || "#ffffff";
        const qualityPct = Number(qSlider.value) || 92;
        const downloadName = `Converted_${origState.baseName}.jpg`;

        runFfmpegJob({
          totalFrames: 1,
          outputKind: "jpg",
          filterDesc: `#${targetIdx + 1}번 프레임 추출 → 배경색(${bgHex.toUpperCase()}) 합성 및 JPG 인코딩`,
          mapFrameIndex: () => targetIdx,
        }, async (ff) => {
          const inFile = "cv_in.gif";
          const outPng = "cv_frame.png";
          try {
            await ff.writeFile(inFile, srcBytes.slice());
            const code = await ff.exec([
              "-hide_banner",
              "-i", inFile,
              "-vf", `select='eq(n\\,${targetIdx})'`,
              "-frames:v", "1",
              "-vsync", "0",
              "-y",
              outPng,
            ], 120000);

            if (code !== 0) throw new Error("프레임 추출에 실패했습니다.");
            const pngBytes = await ff.readFile(outPng);
            const bmp = await createImageBitmap(new Blob([pngBytes], { type: "image/png" }));
            const canvas = document.createElement("canvas");
            canvas.width = bmp.width;
            canvas.height = bmp.height;
            const ctx = canvas.getContext("2d");
            ctx.fillStyle = bgHex;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(bmp, 0, 0);
            bmp.close?.();

            const jpgBlob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", qualityPct / 100));
            const jpgBytes = new Uint8Array(await jpgBlob.arrayBuffer());

            return {
              panelTitle: "Converted JPG",
              pillText: "JPG Image",
              downloadName,
              bytes: jpgBytes,
              mime: "image/jpeg",
              ext: ".jpg",
              meta: null,
              extraInfo: [
                ["출력 포맷", `JPG 이미지 (화질 ${qualityPct}%)`],
                ["해상도", `${canvas.width} × ${canvas.height} px`],
                ["선택 프레임", `${targetIdx + 1}번째 프레임`],
              ],
            };
          } finally {
            try { await ff.deleteFile(inFile); } catch { /* ignore */ }
            try { await ff.deleteFile(outPng); } catch { /* ignore */ }
          }
        });
      }
    };
  }

  /* ---------------------------------------------------------
     Tool 5: Rotate
  --------------------------------------------------------- */
  function buildRotateTool() {
    let deg = 90;
    let flipH = false;
    let flipV = false;

    const previewBlobUrl = trackUrl(new Blob([workingGif.bytes], { type: "image/gif" }));

    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <div class="control">
        <label>회전 각도 선택</label>
        <div id="rot-deg-chips" class="chip-row" style="margin-top:8px;">
          <button type="button" class="option-chip" data-deg="0">0° (회전 없음)</button>
          <button type="button" class="option-chip is-selected" data-deg="90">↻ 90° 회전</button>
          <button type="button" class="option-chip" data-deg="180">↻ 180° 회전</button>
          <button type="button" class="option-chip" data-deg="270">↻ 270° 회전</button>
        </div>
      </div>

      <div class="control">
        <label>뒤집기 (반전) 선택 — 중복 선택 가능</label>
        <div class="chip-row" style="margin-top:8px;">
          <button id="rot-flip-h" type="button" class="option-chip">↔ 좌우 뒤집기</button>
          <button id="rot-flip-v" type="button" class="option-chip">↕ 상하 뒤집기</button>
        </div>
      </div>

      <div class="live-mini-stage" style="min-height:210px;justify-content:center;">
        <img id="rot-live-img" src="${previewBlobUrl}" alt="회전 미리보기" style="transition:transform 0.25s ease;max-height:150px;">
        <span id="rot-summary" class="field-hint">시계방향 90° 회전</span>
      </div>
    `;
    toolDetailBody.appendChild(wrap);

    const degChips = $("rot-deg-chips");
    const flipHBtn = $("rot-flip-h");
    const flipVBtn = $("rot-flip-v");
    const liveImg = $("rot-live-img");
    const summary = $("rot-summary");

    function updateRotatePreview() {
      const sx = flipH ? -1 : 1;
      const sy = flipV ? -1 : 1;
      liveImg.style.transform = `rotate(${deg}deg) scale(${sx}, ${sy})`;
      const parts = [];
      if (deg > 0) parts.push(`${deg}° 회전`);
      if (flipH) parts.push("좌우 뒤집기");
      if (flipV) parts.push("상하 뒤집기");
      summary.textContent = parts.length ? `적용 효과: ${parts.join(" + ")}` : "변형 없음 (회전 또는 뒤집기를 선택해 주세요)";
    }

    degChips.querySelectorAll(".option-chip").forEach((btn) => {
      btn.addEventListener("click", () => {
        deg = Number(btn.dataset.deg);
        degChips.querySelectorAll(".option-chip").forEach((c) => c.classList.remove("is-selected"));
        btn.classList.add("is-selected");
        updateRotatePreview();
      });
    });

    flipHBtn.addEventListener("click", () => {
      flipH = !flipH;
      flipHBtn.classList.toggle("is-selected", flipH);
      updateRotatePreview();
    });

    flipVBtn.addEventListener("click", () => {
      flipV = !flipV;
      flipVBtn.classList.toggle("is-selected", flipV);
      updateRotatePreview();
    });
    updateRotatePreview();

    currentProceedAction = () => {
      if (deg === 0 && !flipH && !flipV) {
        showToolError("회전 각도(90°/180°/270°) 또는 상하·좌우 뒤집기 중 하나 이상을 선택해 주세요.");
        return;
      }

      const filters = [];
      const descParts = [];
      if (deg === 90) {
        filters.push("transpose=1");
        descParts.push("90° 회전");
      } else if (deg === 180) {
        filters.push("hflip,vflip");
        descParts.push("180° 회전");
      } else if (deg === 270) {
        filters.push("transpose=2");
        descParts.push("270° 회전");
      }
      if (flipH) {
        filters.push("hflip");
        descParts.push("좌우 반전");
      }
      if (flipV) {
        filters.push("vflip");
        descParts.push("상하 반전");
      }

      const srcBytes = workingGif.bytes;
      const downloadName = `Rotated_${origState.name}`;

      runFfmpegJob({
        totalFrames: workingGif.meta.frames,
        filterDesc: `프레임 픽셀 행렬 변환 (${descParts.join(" + ")})`,
      }, async (ff) => {
        const { bytes, meta } = await encodeGifWithFilter(ff, srcBytes, filters.join(","));
        return {
          panelTitle: "Rotated GIF",
          pillText: descParts.join("·"),
          downloadName,
          bytes,
          mime: "image/gif",
          ext: ".gif",
          meta,
          extraInfo: [["적용 작업", descParts.join(" + ")]],
        };
      });
    };
  }

  /* ---------------------------------------------------------
     Tool 6: Optimize
  --------------------------------------------------------- */
  function buildOptimizeTool() {
    let preset = "balanced";

    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <div class="control">
        <label>최적화 모드 선택 (해상도·프레임 수 100% 유지)</label>
        <div class="choice-cards" style="margin-top:8px;grid-template-columns:1fr;">
          <label class="choice-card" data-preset="high">
            <input type="radio" name="opt-preset" value="high">
            <span class="choice-card-text">
              <strong>✨ 고화질 우선 최적화 (224색 · 차분 투명 압축)</strong>
              <span>색상 계조를 최대한 보존하면서 움직이지 않는 배경 영역만 중복 제거합니다.</span>
            </span>
          </label>
          <label class="choice-card is-selected" data-preset="balanced">
            <input type="radio" name="opt-preset" value="balanced" checked>
            <span class="choice-card-text">
              <strong>💎 스마트 균형 최적화 (권장 · 160색 적응형 팔레트)</strong>
              <span>육안 화질 손실은 최소화하면서 불필요한 색상과 중복 픽셀을 정밀 압축합니다.</span>
            </span>
          </label>
          <label class="choice-card" data-preset="max">
            <input type="radio" name="opt-preset" value="max">
            <span class="choice-card-text">
              <strong>🚀 고효율 용량 최적화 (96색 · 고밀도 디더링 압축)</strong>
              <span>원본 크기와 프레임은 그대로 유지한 채 팔레트 효율을 극대화해 용량을 대폭 줄입니다.</span>
            </span>
          </label>
        </div>
      </div>

      <div class="summary-callout">
        현재 파일 용량: ${studio.formatBytes(workingGif.bytes.byteLength)} (${workingGif.meta.width} × ${workingGif.meta.height}px · ${workingGif.meta.frames}프레임 그대로 유지)
      </div>
    `;
    toolDetailBody.appendChild(wrap);

    wrap.querySelectorAll(".choice-card").forEach((card) => {
      card.addEventListener("click", () => {
        preset = card.dataset.preset;
        wrap.querySelectorAll(".choice-card").forEach((c) => c.classList.remove("is-selected"));
        card.classList.add("is-selected");
      });
    });

    currentProceedAction = () => {
      const srcBytes = workingGif.bytes;
      const beforeSize = srcBytes.byteLength;
      const downloadName = `Optimized_${origState.name}`;
      const cfg = preset === "high"
        ? { maxColors: 224, statsMode: "diff", bayerScale: 5, label: "고화질 우선 최적화" }
        : preset === "balanced"
          ? { maxColors: 160, statsMode: "single", bayerScale: 5, label: "스마트 균형 최적화" }
          : { maxColors: 96, statsMode: "single", bayerScale: 4, label: "고효율 용량 최적화" };

      runFfmpegJob({
        totalFrames: workingGif.meta.frames,
        filterDesc: `프레임 간 변경 영역(diff) 계산 및 ${cfg.maxColors}색 적응형 팔레트 최적화`,
      }, async (ff) => {
        let best = await encodeGifWithFilter(ff, srcBytes, "", cfg);
        if (best.bytes.byteLength >= beforeSize && cfg.maxColors > 64) {
          const tighter = await encodeGifWithFilter(ff, srcBytes, "", {
            maxColors: 64,
            statsMode: "single",
            bayerScale: 5,
            diffMode: "rectangle",
          });
          if (tighter.bytes.byteLength < best.bytes.byteLength) best = tighter;
        }
        if (best.bytes.byteLength > beforeSize) {
          best = { bytes: srcBytes.slice(), meta: workingGif.meta };
        }

        const savedBytes = Math.max(0, beforeSize - best.bytes.byteLength);
        const savedPct = beforeSize > 0 ? ((savedBytes / beforeSize) * 100).toFixed(1) : "0.0";
        return {
          panelTitle: "Optimized GIF",
          pillText: savedBytes > 0 ? `-${savedPct}%` : "최적 상태",
          downloadName,
          bytes: best.bytes,
          mime: "image/gif",
          ext: ".gif",
          meta: best.meta,
          extraInfo: [
            ["최적화 방식", cfg.label],
            ["절감 결과", savedBytes > 0
              ? `${studio.formatBytes(beforeSize)} → ${studio.formatBytes(best.bytes.byteLength)} (${savedPct}% 절감)`
              : `${studio.formatBytes(beforeSize)} (이미 최적 압축 상태)`],
          ],
        };
      });
    };
  }

  /* ---------------------------------------------------------
     Tool 7: Reverse (가로 전체 프레임 펼침 + 드래그 시작~끝 구간 선택)
  --------------------------------------------------------- */
  function buildReverseTool() {
    const totalFrames = workingGif.meta.frames;
    let mode = "reverse";
    let scopeMode = "extract"; // 'extract' | 'inplace'
    let rangeInfo = { startIdx: 0, endIdx: totalFrames - 1, count: totalFrames };

    const stripHost = document.createElement("div");
    toolDetailBody.appendChild(stripHost);

    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <div class="control">
        <label>역재생 방식 선택</label>
        <div class="choice-cards" style="margin-top:8px;">
          <label id="rev-card-normal" class="choice-card is-selected">
            <input type="radio" name="rev-mode" value="reverse" checked>
            <span class="choice-card-text">
              <strong>⏪ 역재생 (끝 → 처음)</strong>
              <span>선택한 구간의 프레임을 뒤에서 앞으로 거꾸로 재생합니다.</span>
            </span>
          </label>
          <label id="rev-card-boomerang" class="choice-card">
            <input type="radio" name="rev-mode" value="boomerang">
            <span class="choice-card-text">
              <strong>🪃 부메랑 루프 (정재생 + 역재생)</strong>
              <span>선택 구간을 정방향 재생한 뒤 역방향으로 자연스럽게 되감습니다.</span>
            </span>
          </label>
        </div>
      </div>

      <div id="rev-subscope-box" class="control" hidden>
        <label>일부 구간 드래그 시 처리 방식</label>
        <div class="chip-row" style="margin-top:6px;">
          <button type="button" class="option-chip is-selected" data-scope="extract">드래그한 구간만 잘라서 역재생</button>
          <button type="button" class="option-chip" data-scope="inplace">앞·뒤 구간은 유지하고 선택 구간만 역재생</button>
        </div>
      </div>

      <div id="rev-summary" class="summary-callout"></div>
    `;
    toolDetailBody.appendChild(wrap);

    const cardNormal = $("rev-card-normal");
    const cardBoom = $("rev-card-boomerang");
    const subScopeBox = $("rev-subscope-box");
    const summary = $("rev-summary");

    function updateRevSummary() {
      const isPartial = rangeInfo.startIdx > 0 || rangeInfo.endIdx < totalFrames - 1;
      subScopeBox.hidden = !isPartial;
      summary.textContent = `⏪ 역재생 순서: #${rangeInfo.endIdx + 1}번 → #${rangeInfo.startIdx + 1}번 프레임 (${rangeInfo.count}장 · ${mode === "boomerang" ? "부메랑 왕복" : "역방향 재생"})`;
    }

    mountFrameStripSelector(stripHost, workingGif, {
      initialStartIdx: 0,
      initialEndIdx: totalFrames - 1,
      onChange: (info) => {
        rangeInfo = info;
        updateRevSummary();
      },
    });

    wrap.querySelectorAll('input[name="rev-mode"]').forEach((r) => {
      r.addEventListener("change", () => {
        mode = r.value;
        cardNormal.classList.toggle("is-selected", mode === "reverse");
        cardBoom.classList.toggle("is-selected", mode === "boomerang");
        updateRevSummary();
      });
    });

    subScopeBox.querySelectorAll(".option-chip").forEach((btn) => {
      btn.addEventListener("click", () => {
        scopeMode = btn.dataset.scope;
        subScopeBox.querySelectorAll(".option-chip").forEach((c) => c.classList.remove("is-selected"));
        btn.classList.add("is-selected");
      });
    });

    updateRevSummary();

    currentProceedAction = () => {
      const { startIdx, endIdx } = rangeInfo;
      const isPartial = startIdx > 0 || endIdx < totalFrames - 1;
      const srcBytes = workingGif.bytes;
      const downloadName = `Reversed_${origState.name}`;

      let filterOpts = {};
      let vf = "";
      if (!isPartial || scopeMode === "extract") {
        const segPrefix = isPartial ? `select='between(n\\,${startIdx}\\,${endIdx})',setpts=PTS-STARTPTS,` : "";
        vf = mode === "boomerang"
          ? `${segPrefix}split[f0][f1];[f1]reverse[r1];[f0][r1]concat=n=2:v=1:a=0`
          : `${segPrefix}reverse`;
      } else {
        // 앞·뒤 유지 + 선택 구간만 역재생/부메랑 결합
        const parts = [];
        const concatInputs = [];
        let segCount = 0;
        if (startIdx > 0) {
          parts.push(`[vpre]select='lt(n\\,${startIdx})',setpts=PTS-STARTPTS[p0]`);
          concatInputs.push("[p0]");
          segCount += 1;
        }
        if (mode === "boomerang") {
          parts.push(`[vmid]select='between(n\\,${startIdx}\\,${endIdx})',setpts=PTS-STARTPTS,split[m0][m1];[m1]reverse[mr];[m0][mr]concat=n=2:v=1:a=0[p1]`);
        } else {
          parts.push(`[vmid]select='between(n\\,${startIdx}\\,${endIdx})',setpts=PTS-STARTPTS,reverse[p1]`);
        }
        concatInputs.push("[p1]");
        segCount += 1;
        if (endIdx < totalFrames - 1) {
          parts.push(`[vpost]select='gt(n\\,${endIdx})',setpts=PTS-STARTPTS[p2]`);
          concatInputs.push("[p2]");
          segCount += 1;
        }
        const splitLabels = [];
        if (startIdx > 0) splitLabels.push("[vpre]");
        splitLabels.push("[vmid]");
        if (endIdx < totalFrames - 1) splitLabels.push("[vpost]");
        const raw = `[0:v]split=${splitLabels.length}${splitLabels.join("")};${parts.join(";")};${concatInputs.join("")}concat=n=${segCount}:v=1:a=0`;
        filterOpts = { rawFilterComplex: raw };
      }

      const rangeText = `#${startIdx + 1}~#${endIdx + 1}번 프레임`;
      const segLen = endIdx - startIdx + 1;
      const revOutFrames = (!isPartial || scopeMode === "extract")
        ? (mode === "boomerang" ? segLen * 2 : segLen)
        : (mode === "boomerang" ? totalFrames + segLen : totalFrames);

      runFfmpegJob({
        totalFrames: revOutFrames,
        filterDesc: `${rangeText} 구간 프레임 역순 재배열 (${mode === "boomerang" ? "부메랑 루프" : "역재생"})`,
        mapFrameIndex: (k) => {
          if (!isPartial || scopeMode === "extract") {
            if (mode === "boomerang" && k < segLen) return startIdx + k;
            const revK = mode === "boomerang" ? k - segLen : k;
            return Math.max(startIdx, endIdx - revK);
          }
          if (k < startIdx) return k;
          const midSpan = mode === "boomerang" ? segLen * 2 : segLen;
          if (k < startIdx + midSpan) {
            const localK = k - startIdx;
            if (mode === "boomerang" && localK < segLen) return startIdx + localK;
            const revLocal = mode === "boomerang" ? localK - segLen : localK;
            return Math.max(startIdx, endIdx - revLocal);
          }
          return Math.min(totalFrames - 1, endIdx + 1 + (k - (startIdx + midSpan)));
        },
      }, async (ff) => {
        const { bytes, meta } = await encodeGifWithFilter(ff, srcBytes, vf, filterOpts);
        return {
          panelTitle: "Reversed GIF",
          pillText: `${rangeText}`,
          downloadName,
          bytes,
          mime: "image/gif",
          ext: ".gif",
          meta,
          extraInfo: [
            ["적용 구간", rangeText],
            ["역재생 모드", mode === "boomerang" ? "부메랑 (정+역)" : "역재생 (끝→처음)"],
          ],
        };
      });
    };
  }

  /* ---------------------------------------------------------
     Tool 8: Speed (가로 전체 프레임 펼침 + 드래그 시작~끝 구간 선택)
  --------------------------------------------------------- */
  function buildSpeedTool() {
    const totalFrames = workingGif.meta.frames;
    const origFps = workingGif.meta.fps;
    const presets = [0.25, 0.5, 0.75, 1.25, 1.5, 2.0, 3.0, 4.0];
    let scopeMode = "extract"; // 'extract' | 'inplace'
    let rangeInfo = {
      startIdx: 0,
      endIdx: totalFrames - 1,
      count: totalFrames,
      durationSec: workingGif.meta.duration,
    };

    const stripHost = document.createElement("div");
    toolDetailBody.appendChild(stripHost);

    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <div class="control">
        <label for="spd-range">
          <span>재생 속도 배율</span>
          <strong id="spd-readout">1.50x 배속</strong>
        </label>
        <input id="spd-range" type="range" min="0.25" max="4.0" step="0.05" value="1.5">
      </div>

      <div class="control">
        <label>빠른 배속 선택</label>
        <div id="spd-chips" class="chip-row" style="margin-top:8px;"></div>
      </div>

      <div id="spd-subscope-box" class="control" hidden>
        <label>일부 구간 드래그 시 처리 방식</label>
        <div class="chip-row" style="margin-top:6px;">
          <button type="button" class="option-chip is-selected" data-scope="extract">드래그한 구간만 잘라서 배속 적용</button>
          <button type="button" class="option-chip" data-scope="inplace">앞·뒤 구간(1x)은 유지하고 선택 구간만 배속</button>
        </div>
      </div>

      <div id="spd-summary" class="summary-callout"></div>
    `;
    toolDetailBody.appendChild(wrap);

    const slider = $("spd-range");
    const readout = $("spd-readout");
    const chipRow = $("spd-chips");
    const subScopeBox = $("spd-subscope-box");
    const summary = $("spd-summary");

    function updateSpeedUi() {
      const spd = Number(slider.value);
      readout.textContent = `${spd.toFixed(2)}x 배속`;
      const isPartial = rangeInfo.startIdx > 0 || rangeInfo.endIdx < totalFrames - 1;
      subScopeBox.hidden = !isPartial;

      const segDur = rangeInfo.durationSec || workingGif.meta.duration;
      const newSegDur = segDur / spd;
      summary.textContent = `선택 구간(#${rangeInfo.startIdx + 1}~#${rangeInfo.endIdx + 1}, ${rangeInfo.count}장): ${segDur.toFixed(2)}초 → ${newSegDur.toFixed(2)}초 (${spd.toFixed(2)}x)`;
      chipRow.querySelectorAll(".option-chip").forEach((c) => {
        c.classList.toggle("is-selected", Math.abs(Number(c.dataset.spd) - spd) < 0.01);
      });
    }

    mountFrameStripSelector(stripHost, workingGif, {
      initialStartIdx: 0,
      initialEndIdx: totalFrames - 1,
      onChange: (info) => {
        rangeInfo = info;
        updateSpeedUi();
      },
    });

    presets.forEach((p) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "option-chip";
      chip.dataset.spd = String(p);
      chip.textContent = `${p}x`;
      chip.addEventListener("click", () => {
        slider.value = String(p);
        updateSpeedUi();
      });
      chipRow.appendChild(chip);
    });

    subScopeBox.querySelectorAll(".option-chip").forEach((btn) => {
      btn.addEventListener("click", () => {
        scopeMode = btn.dataset.scope;
        subScopeBox.querySelectorAll(".option-chip").forEach((c) => c.classList.remove("is-selected"));
        btn.classList.add("is-selected");
      });
    });

    slider.addEventListener("input", updateSpeedUi);
    updateSpeedUi();

    currentProceedAction = () => {
      const spd = Number(slider.value);
      const { startIdx, endIdx } = rangeInfo;
      const isPartial = startIdx > 0 || endIdx < totalFrames - 1;
      const srcBytes = workingGif.bytes;
      const downloadName = `Speed_${origState.name}`;
      const targetFps = Math.min(50, Math.max(2, +(origFps * spd).toFixed(2)));

      let vf = "";
      let filterOpts = {};
      if (!isPartial || scopeMode === "extract") {
        const segPrefix = isPartial ? `select='between(n\\,${startIdx}\\,${endIdx})',setpts=PTS-STARTPTS,` : "";
        vf = `${segPrefix}setpts=PTS/${spd.toFixed(4)},fps=${targetFps}`;
      } else {
        const splitLabels = [];
        const parts = [];
        const concatInputs = [];
        if (startIdx > 0) {
          splitLabels.push("[vpre]");
          parts.push(`[vpre]select='lt(n\\,${startIdx})',setpts=PTS-STARTPTS[p0]`);
          concatInputs.push("[p0]");
        }
        splitLabels.push("[vmid]");
        parts.push(`[vmid]select='between(n\\,${startIdx}\\,${endIdx})',setpts=(PTS-STARTPTS)/${spd.toFixed(4)}[p1]`);
        concatInputs.push("[p1]");
        if (endIdx < totalFrames - 1) {
          splitLabels.push("[vpost]");
          parts.push(`[vpost]select='gt(n\\,${endIdx})',setpts=PTS-STARTPTS[p2]`);
          concatInputs.push("[p2]");
        }
        const outFps = Math.min(50, Math.max(origFps, targetFps));
        const raw = `[0:v]split=${splitLabels.length}${splitLabels.join("")};${parts.join(";")};${concatInputs.join("")}concat=n=${concatInputs.length}:v=1:a=0,fps=${outFps}`;
        filterOpts = { rawFilterComplex: raw };
      }

      const rangeText = `#${startIdx + 1}~#${endIdx + 1}번 프레임`;
      const segCount = endIdx - startIdx + 1;
      const spdOutFrames = (!isPartial || scopeMode === "extract") ? segCount : totalFrames;

      runFfmpegJob({
        totalFrames: spdOutFrames,
        filterDesc: `${rangeText} 구간 PTS 타임스탬프 ${spd.toFixed(2)}배속 재계산 (${targetFps}FPS)`,
        mapFrameIndex: (k) => ((!isPartial || scopeMode === "extract") ? startIdx + k : k),
      }, async (ff) => {
        const { bytes, meta } = await encodeGifWithFilter(ff, srcBytes, vf, filterOpts);
        return {
          panelTitle: "Speed GIF",
          pillText: `${spd.toFixed(2)}x`,
          downloadName,
          bytes,
          mime: "image/gif",
          ext: ".gif",
          meta,
          extraInfo: [
            ["적용 구간", rangeText],
            ["적용 배속", `${spd.toFixed(2)}배속`],
          ],
        };
      });
    };
  }

  /* ---------------------------------------------------------
     Tool 9: Cut (가로 전체 프레임 펼침 + 드래그 시작~끝 구간 선택)
  --------------------------------------------------------- */
  function buildCutTool() {
    const totalFrames = workingGif.meta.frames;
    const defaultEndIdx = Math.max(0, Math.ceil(totalFrames * 0.7) - 1);

    const stripHost = document.createElement("div");
    toolDetailBody.appendChild(stripHost);

    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <div class="clip-grid">
        <div class="control">
          <label for="cut-start-frame">시작 프레임 번호 <strong id="cut-start-label">#1번</strong></label>
          <input id="cut-start-frame" class="text-field" type="number" min="1" max="${totalFrames}" step="1" value="1">
        </div>
        <div class="control">
          <label for="cut-end-frame">끝 프레임 번호 <strong id="cut-end-label">#${defaultEndIdx + 1}번</strong></label>
          <input id="cut-end-frame" class="text-field" type="number" min="1" max="${totalFrames}" step="1" value="${defaultEndIdx + 1}">
        </div>
      </div>

      <div id="cut-summary" class="summary-callout"></div>
    `;
    toolDetailBody.appendChild(wrap);

    const sInput = $("cut-start-frame");
    const eInput = $("cut-end-frame");
    const sLabel = $("cut-start-label");
    const eLabel = $("cut-end-label");
    const summary = $("cut-summary");

    let currentRange = {
      startIdx: 0,
      endIdx: defaultEndIdx,
      count: defaultEndIdx + 1,
      startSec: 0,
      endSec: workingGif.meta.duration * 0.7,
      durationSec: workingGif.meta.duration * 0.7,
    };

    const stripApi = mountFrameStripSelector(stripHost, workingGif, {
      initialStartIdx: 0,
      initialEndIdx: defaultEndIdx,
      onChange: (info) => {
        currentRange = info;
        sInput.value = String(info.startIdx + 1);
        eInput.value = String(info.endIdx + 1);
        sLabel.textContent = `#${info.startIdx + 1}번 (${info.startSec.toFixed(2)}초)`;
        eLabel.textContent = `#${info.endIdx + 1}번 (${info.endSec.toFixed(2)}초)`;
        summary.textContent = `✂️ 잘라낼 구간: #${info.startIdx + 1}번 ~ #${info.endIdx + 1}번 프레임 (총 ${info.count}장 · ${info.durationSec.toFixed(2)}초)`;
      },
    });

    function syncFromNumberInputs() {
      let s = Math.round(Number(sInput.value) || 1) - 1;
      let e = Math.round(Number(eInput.value) || totalFrames) - 1;
      s = Math.max(0, Math.min(s, totalFrames - 1));
      e = Math.max(s, Math.min(e, totalFrames - 1));
      stripApi.setRange(s, e, true);
    }

    sInput.addEventListener("change", syncFromNumberInputs);
    eInput.addEventListener("change", syncFromNumberInputs);

    currentProceedAction = () => {
      const { startIdx, endIdx, durationSec, count } = currentRange;
      const srcBytes = workingGif.bytes;
      const downloadName = `Cut_${origState.name}`;
      const vf = `select='between(n\\,${startIdx}\\,${endIdx})',setpts=PTS-STARTPTS`;

      runFfmpegJob({
        totalFrames: count,
        filterDesc: `#${startIdx + 1}~#${endIdx + 1}번 프레임 추출 및 시작 타임스탬프(PTS) 영점 보정`,
        mapFrameIndex: (k) => startIdx + k,
      }, async (ff) => {
        const { bytes, meta } = await encodeGifWithFilter(ff, srcBytes, vf);
        return {
          panelTitle: "Cut GIF",
          pillText: `${count}장 (${durationSec.toFixed(2)}초)`,
          downloadName,
          bytes,
          mime: "image/gif",
          ext: ".gif",
          meta,
          extraInfo: [["잘라낸 구간", `#${startIdx + 1}번 ~ #${endIdx + 1}번 프레임 (총 ${count}장 · ${durationSec.toFixed(2)}초)`]],
        };
      });
    };
  }

  /* =========================================================
     11. 마무리 저장 모달 (저장 완료 시 클립보드 복사 안내 연동)
  ========================================================= */
  function openSaveModal() {
    if (!origState || !latestSaveTarget) return;
    const ext = latestSaveTarget.ext || ".gif";
    saveFilenameInput.value = `${origState.baseName}_ed`;
    saveExtBadge.textContent = ext;
    saveModalStatus.hidden = true;
    saveModalStatus.textContent = "";

    if (chosenDirHandle) {
      saveFolderDisplay.textContent = `선택한 폴더: ${chosenDirHandle.name}`;
      saveFolderSub.textContent = "지정하신 폴더 안에 직접 파일을 저장합니다.";
    } else {
      saveFolderDisplay.textContent = origState.folderLabel;
      saveFolderSub.textContent = "원본 파일의 폴더를 기본 위치로 안내하며, 저장 시 원하는 폴더를 직접 고를 수도 있습니다.";
    }

    saveModalBackdrop.hidden = false;
    setTimeout(() => {
      saveFilenameInput.focus();
      saveFilenameInput.select();
    }, 30);
  }

  function closeSaveModal() {
    saveModalBackdrop.hidden = true;
  }

  openSaveModalBtn.addEventListener("click", openSaveModal);
  saveModalClose.addEventListener("click", closeSaveModal);
  saveModalCancel.addEventListener("click", closeSaveModal);
  saveModalBackdrop.addEventListener("click", (event) => {
    if (event.target === saveModalBackdrop) closeSaveModal();
  });

  saveChooseFolderBtn.addEventListener("click", async () => {
    if (typeof window.showDirectoryPicker === "function") {
      try {
        const pickerOpts = { mode: "readwrite" };
        if (origState?.fileHandle) pickerOpts.startIn = origState.fileHandle;
        const dir = await window.showDirectoryPicker(pickerOpts);
        chosenDirHandle = dir;
        saveFolderDisplay.textContent = `선택한 폴더: ${dir.name}`;
        saveFolderSub.textContent = "저장 완료를 누르면 이 폴더에 즉시 저장됩니다.";
        saveModalStatus.hidden = false;
        saveModalStatus.textContent = `📁 "${dir.name}" 폴더가 저장 위치로 선택되었습니다.`;
      } catch (err) {
        if (err?.name !== "AbortError") {
          saveModalStatus.hidden = false;
          saveModalStatus.textContent = "폴더 선택 창을 열 수 없어 저장 완료 시 파일 탐색기로 위치를 고릅니다.";
        }
      }
    } else {
      saveModalStatus.hidden = false;
      saveModalStatus.textContent = "현재 브라우저에서는 '저장 완료' 클릭 시 탐색기 다운로드로 저장됩니다.";
    }
  });

  function buildFinalFileName() {
    const ext = latestSaveTarget?.ext || ".gif";
    let raw = (saveFilenameInput.value || "").trim();
    if (!raw) raw = `${origState.baseName}_ed`;
    if (raw.toLowerCase().endsWith(ext.toLowerCase())) return raw;
    return `${raw}${ext}`;
  }

  saveModalConfirm.addEventListener("click", async () => {
    if (!origState || !latestSaveTarget) return;
    const finalName = buildFinalFileName();
    const blob = new Blob([latestSaveTarget.bytes], { type: latestSaveTarget.mime });

    if (chosenDirHandle) {
      try {
        const fileHandle = await chosenDirHandle.getFileHandle(finalName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        closeSaveModal();
        notifyDownloadComplete(latestSaveTarget, finalName);
        showEditorNotice(`🎄 "${chosenDirHandle.name}/${finalName}" 위치에 저장이 완료되었습니다!`);
        return;
      } catch (err) {
        console.warn("Direct directory write failed, falling back:", err);
      }
    }

    if (typeof window.showSaveFilePicker === "function") {
      try {
        const acceptMap = latestSaveTarget.ext === ".mp4"
          ? { "video/mp4": [".mp4"] }
          : latestSaveTarget.ext === ".jpg"
            ? { "image/jpeg": [".jpg", ".jpeg"] }
            : { "image/gif": [".gif"] };

        const saveOpts = {
          suggestedName: finalName,
          types: [{ description: "편집된 미디어 파일", accept: acceptMap }],
        };
        if (origState.fileHandle) saveOpts.startIn = origState.fileHandle;

        const handle = await window.showSaveFilePicker(saveOpts);
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        closeSaveModal();
        notifyDownloadComplete(latestSaveTarget, finalName);
        showEditorNotice(`🎄 "${handle.name}" 파일이 선택한 폴더에 성공적으로 저장되었습니다!`);
        return;
      } catch (err) {
        if (err?.name === "AbortError") return;
      }
    }

    const tempUrl = URL.createObjectURL(blob);
    triggerQuickDownload(tempUrl, finalName);
    setTimeout(() => URL.revokeObjectURL(tempUrl), 15000);
    closeSaveModal();
    notifyDownloadComplete(latestSaveTarget, finalName);
    showEditorNotice(`🎄 "${finalName}" 파일 다운로드를 시작했습니다!`);
  });
})();
