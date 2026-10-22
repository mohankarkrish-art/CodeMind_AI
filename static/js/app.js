"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const $ = (selector) => document.querySelector(selector);

  const codeInput = $("#code-input");
  const problemInput = $("#problem-input");
  const languageSelect = $("#language");
  const analyzeButton = $("#analyze-button");
  const analyzeButtonText = $("#analyze-button-text");
  const resultsArea = $("#results-area");
  const lineNumbers = $("#line-numbers");
  const editorNotice = $("#editor-notice");
  const documentList = $("#document-list");
  const fileInput = $("#file-input");
  const dropZone = $("#drop-zone");
  const uploadStatus = $("#upload-status");
  const toast = $("#toast");

  let isAnalyzing = false;
  let toastTimer;

  const sampleCode = `def calculate_average(numbers):
    total = 0
    for number in numbers:
        total += number
    return total / len(numbers)

values = [10, 20, 30, 40, 50]
print(calculate_average(values))`;

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]);
  }

  function showToast(message, isError = false) {
    toast.textContent = message;
    toast.classList.toggle("error", isError);
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 3500);
  }

  function showNotice(message, type = "success") {
    editorNotice.textContent = message;
    editorNotice.className = `notice visible ${type}`;
  }

  function hideNotice() {
    editorNotice.textContent = "";
    editorNotice.className = "notice";
  }

  function setConnection(online, detail = "") {
    $("#system-status").textContent = online ? "System online" : "API unavailable";
    $("#connection-label").textContent = online
      ? "Django API connected"
      : "Check your Django server";
    $("#engine-value").textContent = online ? "Online" : "Offline";
    $("#engine-foot").textContent = detail || (
      online ? "Ready to process requests" : "Start the Django server"
    );
  }

  async function requestJSON(url, options = {}) {
    let response;

    try {
      response = await fetch(url, options);
    } catch {
      throw new Error(
        "Cannot connect to Django. Make sure the development server is running."
      );
    }

    const raw = await response.text();
    let data = {};

    if (raw) {
      try {
        data = JSON.parse(raw);
      } catch {
        if (!response.ok) {
          throw new Error(`Server returned HTTP ${response.status}.`);
        }
        throw new Error("The server returned an unexpected response. Check Django logs.");
      }
    }

    if (!response.ok) {
      throw new Error(data.error || data.message || `Request failed (${response.status}).`);
    }

    return data;
  }

  function updateLineNumbers() {
    const count = Math.max(1, codeInput.value.split("\n").length);
    lineNumbers.textContent = Array.from(
      { length: count }, (_, index) => index + 1
    ).join("\n");

    $("#char-count").textContent =
      `${codeInput.value.length.toLocaleString()} characters`;

    $("#editor-state").textContent =
      codeInput.value.trim() ? "Code ready to analyze" : "Ready to edit";
  }

  codeInput.addEventListener("input", updateLineNumbers);

  codeInput.addEventListener("scroll", () => {
    lineNumbers.scrollTop = codeInput.scrollTop;
  });

  // Indent selected lines or insert spaces when Tab is pressed.
  codeInput.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    event.preventDefault();

    const start = codeInput.selectionStart;
    const end = codeInput.selectionEnd;
    const value = codeInput.value;

    if (start === end) {
      codeInput.setRangeText("    ", start, end, "end");
      updateLineNumbers();
      return;
    }

    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const selectedText = value.slice(lineStart, end);
    const indentedText = selectedText.replace(/^/gm, "    ");

    codeInput.setRangeText(indentedText, lineStart, end, "select");
    codeInput.selectionStart = start + 4;
    codeInput.selectionEnd = end + 4 * selectedText.split("\n").length;
    updateLineNumbers();
  });

  $("#sample-code").addEventListener("click", () => {
    codeInput.value = sampleCode;
    languageSelect.value = "Python";
    problemInput.value =
      "Review this function for edge cases, possible runtime errors, and code quality improvements.";
    updateLineNumbers();
    hideNotice();
    codeInput.focus();
    showToast("Sample code loaded. You're ready to analyze.");
  });

  $("#clear-code").addEventListener("click", () => {
    if (isAnalyzing) return;
    codeInput.value = "";
    problemInput.value = "";
    updateLineNumbers();
    hideNotice();
    codeInput.focus();
  });

  function formatValue(value) {
    if (value === null || value === undefined) return "";
    if (typeof value === "string") return value;
    return JSON.stringify(value, null, 2);
  }

  function firstValue(data, keys, fallback = "") {
    for (const key of keys) {
      if (data && data[key] !== undefined && data[key] !== null) {
        return data[key];
      }
    }
    return fallback;
  }

  function asList(value) {
    if (Array.isArray(value)) return value;
    if (typeof value === "string" && value.trim()) return [value];
    return [];
  }

  
function renderList(items, warning = false) {
  const list = asList(items);

  if (!list.length) {
    return "<li>No items reported.</li>";
  }

  return list.map((item) => {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      const title = item.title || item.name || item.severity || "Finding";
      const detail = item.detail || item.description || item.message || "";
      const suggestion = item.suggestion || item.recommendation || "";

      return `
        <li class="${warning ? "warning-item" : ""}">
          <strong>${escapeHTML(title)}</strong>
          ${item.severity && item.title
            ? `<span class="issue-severity">${escapeHTML(item.severity)}</span>`
            : ""}
          ${detail
            ? `<p>${escapeHTML(detail)}</p>`
            : ""}
          ${suggestion
            ? `<p><strong>Suggested fix:</strong> ${escapeHTML(suggestion)}</p>`
            : ""}
        </li>`;
    }

    return `<li class="${warning ? "warning-item" : ""}">${escapeHTML(String(item))}</li>`;
  }).join("");
}

  function renderCodeBlock(code) {
    return `
      <pre class="corrected-code" id="corrected-code">${escapeHTML(code)}</pre>
      <button type="button" class="copy-button" id="copy-corrected-code">
        Copy corrected code
      </button>`;
  }

  function renderAnalysis(data) {
    // Accommodate common response names from different analysis implementations.
    const summary = firstValue(
      data, ["summary", "overall_summary", "explanation", "message", "overview"]
    );
    const issues = asList(firstValue(
      data, ["issues", "bugs", "errors", "problems", "findings"], []
    ));
    const suggestions = asList(firstValue(
      data, ["suggestions", "recommendations", "improvements", "tips"], []
    ));
    const rawCorrectedCode = firstValue(
      data, ["corrected_code", "fixed_code", "improved_code", "optimized_code", "code_fix"]
    );
    const correctedCode = typeof rawCorrectedCode === "string"
      ? rawCorrectedCode
      : rawCorrectedCode && typeof rawCorrectedCode === "object"
        ? formatValue(rawCorrectedCode)
        : "";

    const score = firstValue(
      data, ["score", "quality_score", "code_score", "overall_score"], null
    );
    const complexity = firstValue(
      data, ["complexity", "time_complexity", "complexity_analysis"], null
    );
    const severity = String(firstValue(
      data, ["severity", "status", "risk_level"], issues.length ? "Review needed" : "Analysis complete"
    ));

    let badgeClass = "";
    if (/error|critical|high|fail|danger/i.test(severity)) {
      badgeClass = "danger";
    } else if (/warning|medium|review/i.test(severity)) {
      badgeClass = "warning";
    }

    const metrics = [
      {
        number: score !== null ? formatValue(score) : String(issues.length),
        label: score !== null ? "Code score" : "Reported issues"
      },
      {
        number: String(suggestions.length),
        label: "Improvement ideas"
      }
    ];

    const summaryText = summary
      ? formatValue(summary)
      : "Analysis completed. Review the findings and suggestions below.";

    let html = `
      <div class="report-summary">
        <div class="report-summary-top">
          <h3>Analysis overview</h3>
          <span class="report-badge ${badgeClass}">${escapeHTML(severity)}</span>
        </div>
        <p>${escapeHTML(summaryText)}</p>
      </div>
      <div class="metric-grid">
        ${metrics.map((metric) => `
          <div class="metric-card">
            <div class="metric-number">${escapeHTML(metric.number)}</div>
            <div class="metric-label">${escapeHTML(metric.label)}</div>
          </div>`).join("")}
      </div>`;

    if (issues.length || data.issues !== undefined || data.bugs !== undefined) {
      html += `
        <section class="result-section">
          <h4><span>◈</span> Issues and findings</h4>
          <ul class="result-list">${renderList(issues, true)}</ul>
        </section>`;
    }

    if (suggestions.length) {
      html += `
        <section class="result-section">
          <h4><span>✳</span> Recommendations</h4>
          <ul class="result-list">${renderList(suggestions)}</ul>
        </section>`;
    }

    if (complexity !== null) {
      html += `
        <section class="result-section">
          <h4><span>⌁</span> Complexity</h4>
          <div class="result-list">
            <li>${escapeHTML(formatValue(complexity))}</li>
          </div>
        </section>`;
    }

    if (correctedCode) {
      html += `
        <section class="result-section">
          <h4><span>⌘</span> Suggested corrected code</h4>
          ${renderCodeBlock(correctedCode)}
        </section>`;
    }

    if (!summary && !issues.length && !suggestions.length &&
        !correctedCode && score === null && complexity === null) {
      html += `
        <details class="raw-details">
          <summary>View complete response</summary>
          <pre>${escapeHTML(JSON.stringify(data, null, 2))}</pre>
        </details>`;
    }

    resultsArea.innerHTML = html;

    const copyButton = $("#copy-corrected-code");
    if (copyButton) {
      copyButton.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(correctedCode);
          showToast("Corrected code copied to clipboard.");
        } catch {
          const temporary = document.createElement("textarea");
          temporary.value = correctedCode;
          temporary.style.position = "fixed";
          temporary.style.opacity = "0";
          document.body.appendChild(temporary);
          temporary.select();
          const copied = document.execCommand("copy");
          temporary.remove();
          showToast(
            copied ? "Corrected code copied." : "Clipboard access was denied.",
            !copied
          );
        }
      });
    }
  }

  analyzeButton.addEventListener("click", async () => {
    if (isAnalyzing) return;

    const code = codeInput.value.trim();
    if (!code) {
      showNotice("Please enter code or use the Load sample button first.", "error");
      codeInput.focus();
      return;
    }

    if (code.length > 20000) {
      showNotice("Code must be 20,000 characters or fewer.", "error");
      return;
    }

    hideNotice();
    isAnalyzing = true;
    analyzeButton.disabled = true;
    analyzeButtonText.textContent = "Analyzing...";
    $("#editor-state").textContent = "Analysis in progress";

    resultsArea.innerHTML = `
      <div class="empty-state">
        <div class="empty-orb"><span>✳</span></div>
        <h3>Thinking through your code</h3>
        <p>Waiting for the analysis engine to return its findings...</p>
      </div>`;

    try {
      const data = await requestJSON("/api/analyze/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          language: languageSelect.value,
          problem: problemInput.value.trim()
        })
      });

      renderAnalysis(data);
      showNotice("Analysis completed successfully.", "success");
      $("#editor-state").textContent = "Analysis complete";
      showToast("Your code analysis is ready.");
    } catch (error) {
      resultsArea.innerHTML = `
        <div class="empty-state">
          <div class="empty-orb"><span>!</span></div>
          <h3>Analysis couldn't finish</h3>
          <p>${escapeHTML(error.message)}</p>
        </div>`;
      showNotice(error.message, "error");
      $("#editor-state").textContent = "Analysis failed";
    } finally {
      isAnalyzing = false;
      analyzeButton.disabled = false;
      analyzeButtonText.textContent = "Analyze code";
    }
  });

  function getDocumentsArray(data) {
    const documents = firstValue(data, ["documents", "items", "results"], []);
    if (Array.isArray(documents)) return documents;
    if (documents && typeof documents === "object") {
      return Object.entries(documents).map(([name, value]) => {
        return typeof value === "object" && value !== null
          ? { name, ...value }
          : { name, detail: value };
      });
    }
    return [];
  }

  function renderDocuments(documents) {
    $("#document-count").textContent = documents.length.toLocaleString();

    if (!documents.length) {
      documentList.innerHTML = `
        <div class="document-placeholder">
          No indexed documents yet. Upload a PDF or TXT file to add context.
        </div>`;
      return;
    }

    documentList.innerHTML = documents.map((doc, index) => {
      const name = typeof doc === "string"
        ? doc
        : firstValue(doc, ["name", "filename", "file_name", "title", "document"], `Document ${index + 1}`);
      const type = String(name).split(".").pop().toUpperCase();
      const detail = typeof doc === "object" && doc !== null
        ? firstValue(doc, ["status", "chunks", "chunk_count", "detail"], "Indexed")
        : "Indexed";

      return `
        <div class="document-item">
          <div class="document-type">${escapeHTML(type.slice(0, 4))}</div>
          <div class="document-info">
            <strong>${escapeHTML(name)}</strong>
            <small>${escapeHTML(detail === "Indexed" ? "Available in knowledge base" : detail)}</small>
          </div>
          <span class="document-check" title="Indexed">✓</span>
        </div>`;
    }).join("");
  }

  async function loadDocuments() {
    try {
      const data = await requestJSON("/api/documents/");
      renderDocuments(getDocumentsArray(data));
    } catch (error) {
      documentList.innerHTML = `
        <div class="document-placeholder">${escapeHTML(error.message)}</div>`;
      $("#document-count").textContent = "—";
    }
  }

  async function checkHealth() {
    try {
      await requestJSON("/api/health/");
      setConnection(true);
    } catch {
      setConnection(false);
    }
  }

  $("#browse-files").addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files && fileInput.files[0];
    if (file) await uploadFile(file);
    fileInput.value = "";
  });

  async function uploadFile(file) {
    const extension = file.name.split(".").pop().toLowerCase();

    if (!["pdf", "txt"].includes(extension)) {
      setUploadStatus("Only PDF and TXT files are supported.", "error");
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setUploadStatus("The maximum upload size is 8 MB.", "error");
      return;
    }

    const browseButton = $("#browse-files");
    browseButton.disabled = true;
    browseButton.textContent = "Uploading...";
    setUploadStatus(`Uploading ${file.name}...`, "success");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const data = await requestJSON("/api/upload/", {
        method: "POST",
        body: formData
      });

      setUploadStatus(data.message || "Document indexed successfully.", "success");
      showToast("Document uploaded and indexed.");
      await loadDocuments();
    } catch (error) {
      setUploadStatus(error.message, "error");
    } finally {
      browseButton.disabled = false;
      browseButton.textContent = "Browse files";
    }
  }

  function setUploadStatus(message, type) {
    uploadStatus.textContent = message;
    uploadStatus.className = `upload-status visible ${type}`;
  }

  ["dragenter", "dragover"].forEach((eventName) => {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.add("drag-over");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.remove("drag-over");
    });
  });

  dropZone.addEventListener("drop", async (event) => {
    const file = event.dataTransfer?.files?.[0];
    if (file) await uploadFile(file);
  });

  $("#menu-toggle").addEventListener("click", () => {
    $("#sidebar").classList.toggle("open");
  });

  document.querySelectorAll(".nav-link").forEach((link) => {
    link.addEventListener("click", () => {
      document.querySelectorAll(".nav-link").forEach((item) => {
        item.classList.remove("active");
      });
      link.classList.add("active");
      $("#sidebar").classList.remove("open");
    });
  });

  updateLineNumbers();
  checkHealth();
  loadDocuments();
});
