(() => {
  const root = document.getElementById("portfolio-uploader");
  if (!root) {
    return;
  }

  const apiBase = String(root.dataset.apiBase || "").replace(/\/+$/, "");
  const prototypeToken = root.dataset.prototypeToken || "";
  const maxFileBytes = 30 * 1024 * 1024;
  const allowedExtensions = [".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png"];

  root.innerHTML = `
    <section class="pu-card" aria-labelledby="pu-title">
      <div class="pu-main">
        <p class="pu-eyebrow">Быстрый анализ</p>
        <h2 class="pu-title" id="pu-title">Загрузите отчёт по портфелю</h2>
        <p class="pu-copy">
          Файл отправится напрямую в защищённое хранилище. В прототипе результат
          вернёт тестовый анализатор.
        </p>

        <div class="pu-dropzone" data-testid="dropzone">
          <input
            class="pu-file-input"
            id="pu-file-input"
            type="file"
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
          />
          <button class="pu-button" type="button" data-testid="select-file">
            Выбрать файл
          </button>
          <p class="pu-hint">PDF, DOC, DOCX, JPG или PNG · до 30 МБ</p>
        </div>

        <div class="pu-status" aria-live="polite">
          <div class="pu-status-head">
            <p class="pu-status-title">Загрузка файла</p>
            <span class="pu-status-value">0%</span>
          </div>
          <div class="pu-progress" aria-hidden="true">
            <div class="pu-progress-bar"></div>
          </div>
          <p class="pu-message"></p>
        </div>

        <div class="pu-score" aria-live="polite">
          <p class="pu-score-number"><span data-testid="score-value">—</span>/10</p>
          <p class="pu-score-caption">
            Демо-оценка получена через callback. Полную расшифровку можно связать
            с контактом пользователя по номеру задания.
          </p>
        </div>
      </div>

      <aside class="pu-aside">
        <p class="pu-aside-title">Что происходит</p>
        <ol class="pu-timeline">
          <li class="pu-timeline-item" data-step="selected">Файл выбран</li>
          <li class="pu-timeline-item" data-step="url">Получен временный URL</li>
          <li class="pu-timeline-item" data-step="uploaded">Файл в Timeweb S3</li>
          <li class="pu-timeline-item" data-step="processing">Анализ запущен</li>
          <li class="pu-timeline-item" data-step="callback">Callback получен</li>
        </ol>
        <p class="pu-tech-note">
          Tilda показывает компонент, но не получает файл. Загрузка идёт из
          браузера напрямую в Timeweb S3.
        </p>
      </aside>
    </section>
  `;

  const input = root.querySelector("#pu-file-input");
  const button = root.querySelector('[data-testid="select-file"]');
  const dropzone = root.querySelector('[data-testid="dropzone"]');
  const status = root.querySelector(".pu-status");
  const statusTitle = root.querySelector(".pu-status-title");
  const statusValue = root.querySelector(".pu-status-value");
  const progressBar = root.querySelector(".pu-progress-bar");
  const message = root.querySelector(".pu-message");
  const score = root.querySelector(".pu-score");
  const scoreValue = root.querySelector('[data-testid="score-value"]');

  button.addEventListener("click", () => input.click());
  input.addEventListener("change", () => {
    const [file] = input.files || [];
    if (file) {
      runUpload(file);
    }
  });

  for (const eventName of ["dragenter", "dragover"]) {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.add("is-dragging");
    });
  }

  for (const eventName of ["dragleave", "drop"]) {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.remove("is-dragging");
    });
  }

  dropzone.addEventListener("drop", (event) => {
    const [file] = event.dataTransfer?.files || [];
    if (file) {
      runUpload(file);
    }
  });

  async function runUpload(file) {
    try {
      resetState();
      validateFile(file);
      button.disabled = true;
      status.classList.add("is-visible");
      setStep("selected");
      setMessage(`Выбран ${file.name}`);

      const init = await apiRequest("/api/uploads/init", {
        method: "POST",
        body: JSON.stringify({
          file_name: file.name,
          file_size: file.size,
          file_type: file.type || "application/octet-stream",
        }),
      });
      setStep("url");
      setMessage("Получен временный URL. Загружаем напрямую в Timeweb S3.");

      await uploadToS3(init.upload.url, file, (percent) => {
        statusValue.textContent = `${percent}%`;
        progressBar.style.width = `${percent}%`;
      });
      setStep("uploaded");
      statusValue.textContent = "100%";
      progressBar.style.width = "100%";
      setMessage("Файл загружен. Подтверждаем его наличие.");

      await apiRequest(`/api/uploads/${encodeURIComponent(init.job_id)}/complete`, {
        method: "POST",
        body: JSON.stringify({ file_id: init.file_id }),
      });
      setStep("processing");
      statusTitle.textContent = "Анализируем портфель";
      setMessage("Mock-анализатор готовит результат.");

      await pollResult(init.job_id);
    } catch (error) {
      showError(error.message || "Не удалось загрузить файл");
      button.disabled = false;
    }
  }

  async function pollResult(jobId) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < 60_000) {
      const job = await apiRequest(`/api/jobs/${encodeURIComponent(jobId)}`);
      if (job.status === "completed") {
        setStep("callback");
        statusTitle.textContent = "Результат готов";
        setMessage(`Callback принят. Номер задания: ${job.job_id}`);
        scoreValue.textContent = String(job.score);
        score.classList.add("is-visible");
        button.disabled = false;
        button.textContent = "Загрузить другой файл";
        return;
      }
      if (job.status === "failed") {
        throw new Error("Mock-анализатор не смог вернуть результат");
      }
      await delay(1500);
    }
    throw new Error("Истекло время ожидания результата");
  }

  function validateFile(file) {
    const extension = `.${file.name.split(".").pop().toLowerCase()}`;
    if (!allowedExtensions.includes(extension)) {
      throw new Error("Поддерживаются PDF, DOC, DOCX, JPG, JPEG и PNG");
    }
    if (file.size <= 0 || file.size > maxFileBytes) {
      throw new Error("Максимальный размер файла — 30 МБ");
    }
  }

  function apiRequest(path, options = {}) {
    return fetch(`${apiBase}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "X-Prototype-Token": prototypeToken,
        ...(options.headers || {}),
      },
    }).then(async (response) => {
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || `Backend вернул ${response.status}`);
      }
      return payload;
    });
  }

  function uploadToS3(url, file, onProgress) {
    return new Promise((resolveUpload, rejectUpload) => {
      const request = new XMLHttpRequest();
      request.open("PUT", url);
      request.setRequestHeader("Content-Type", file.type || "application/octet-stream");
      request.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      });
      request.addEventListener("load", () => {
        if (request.status >= 200 && request.status < 300) {
          resolveUpload();
        } else {
          rejectUpload(new Error(`Timeweb S3 вернул ${request.status}`));
        }
      });
      request.addEventListener("error", () => {
        rejectUpload(
          new Error("Браузер не смог загрузить файл. Проверьте CORS бакета Timeweb."),
        );
      });
      request.send(file);
    });
  }

  function resetState() {
    for (const item of root.querySelectorAll(".pu-timeline-item")) {
      item.classList.remove("is-done");
    }
    score.classList.remove("is-visible");
    status.classList.remove("is-visible");
    message.classList.remove("is-error");
    statusTitle.textContent = "Загрузка файла";
    statusValue.textContent = "0%";
    progressBar.style.width = "0";
    button.textContent = "Выбрать файл";
  }

  function setStep(step) {
    root.querySelector(`[data-step="${step}"]`)?.classList.add("is-done");
  }

  function setMessage(text) {
    message.textContent = text;
    message.classList.remove("is-error");
  }

  function showError(text) {
    status.classList.add("is-visible");
    statusTitle.textContent = "Не удалось завершить загрузку";
    message.textContent = text;
    message.classList.add("is-error");
  }

  function delay(milliseconds) {
    return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
  }
})();
