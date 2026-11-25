(function () {
  const engine = document.getElementById("engine");
  const editorEngine = document.getElementById("editor-engine-status");

  function addScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("필요한 파일을 불러오지 못했습니다."));
      document.body.appendChild(script);
    });
  }

  async function start() {
    try {
      await addScript("app.js");
      await addScript("editor.js");
    } catch (error) {
      const msg = error.message || "화면을 불러오지 못했습니다.";
      if (engine) engine.textContent = msg;
      if (editorEngine) editorEngine.textContent = msg;
    }
  }

  window.__addScript = addScript;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
