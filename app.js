(() => {
  const pages = window.PETROCARIBE_PAGES;
  const translations = window.PETROCARIBE_TRANSLATIONS;
  const searchInput = document.getElementById("search-input");
  const pageInput = document.getElementById("page-input");
  const pageText = document.getElementById("page-text");
  const pageLabel = document.getElementById("current-page-label");
  const pageTotal = document.getElementById("page-total");
  const resultsCount = document.getElementById("results-count");
  const resultsList = document.getElementById("results-list");
  const previousButton = document.getElementById("previous-page");
  const nextButton = document.getElementById("next-page");
  const readerError = document.getElementById("reader-error");
  const languageSelect = document.getElementById("language-select");
  let pdfViewer = document.getElementById("pdf-viewer");
  const transcriptPageLabel = document.getElementById("transcript-page-label");
  const originalPdfLink = document.getElementById("original-pdf-link");

  let currentLanguage = "fr";
  let currentIndex = 0;
  let displayedPdfPage = 1;
  let pdfViewerTimer;

  function translate(key) {
    return translations[currentLanguage][key];
  }

  function pageCount(count) {
    const key = count === 1 ? "pagesCountOne" : "pagesCountMany";
    return translate(key).replace("{count}", String(count));
  }

  function applyLanguage(language) {
    if (!Object.hasOwn(translations, language)) return;
    currentLanguage = language;
    document.documentElement.lang = language;
    document.title = translate("title");
    document.querySelector('meta[name="description"]').content = translate("description");
    languageSelect.value = language;

    document.querySelectorAll("[data-i18n]").forEach((element) => {
      element.textContent = translate(element.dataset.i18n);
    });

    document.querySelectorAll("[data-i18n-attr]").forEach((element) => {
      element.dataset.i18nAttr.split(",").forEach((entry) => {
        const [attribute, key] = entry.split(":");
        element.setAttribute(attribute, translate(key));
      });
    });

    if (Array.isArray(pages) && pages.length > 0) runSearch();
  }

  languageSelect.addEventListener("change", () => applyLanguage(languageSelect.value));

  if (!Array.isArray(pages) || pages.length === 0) {
    applyLanguage(currentLanguage);
    readerError.hidden = false;
    pageText.replaceChildren();
    return;
  }

  const pageIndex = new Map(pages.map((page, index) => [Number(page.num), index]));
  pageTotal.textContent = String(pages.length);
  pageInput.max = String(pages.length);

  function appendHighlightedText(container, text, query) {
    if (!query) {
      container.append(document.createTextNode(text));
      return;
    }

    const lowerText = text.toLocaleLowerCase();
    const lowerQuery = query.toLocaleLowerCase();
    let start = 0;
    let match = lowerText.indexOf(lowerQuery, start);

    while (match !== -1) {
      container.append(document.createTextNode(text.slice(start, match)));
      const mark = document.createElement("mark");
      mark.textContent = text.slice(match, match + query.length);
      container.append(mark);
      start = match + query.length;
      match = lowerText.indexOf(lowerQuery, start);
    }

    container.append(document.createTextNode(text.slice(start)));
  }

  function showPdfPage(pageNumber) {
    window.clearTimeout(pdfViewerTimer);
    pdfViewerTimer = window.setTimeout(() => {
      const replacement = document.createElement("embed");
      replacement.id = "pdf-viewer";
      replacement.className = "pdf-viewer";
      replacement.type = "application/pdf";
      replacement.title = translate("pdfViewerTitle");
      replacement.setAttribute("aria-label", translate("pdfViewerTitle"));
      replacement.src = `PETROCARIBE-Audit-January-2019.pdf#page=${pageNumber}&zoom=page-width&toolbar=0&navpanes=0`;
      pdfViewer.replaceWith(replacement);
      pdfViewer = replacement;
    }, 150);
  }

  function renderPage(index) {
    currentIndex = Math.max(0, Math.min(index, pages.length - 1));
    const page = pages[currentIndex];
    const query = searchInput.value.trim();
    pageInput.value = String(page.num);
    pageLabel.textContent = `${translate("pagePrefix")} ${page.num}`;
    transcriptPageLabel.textContent = `${translate("pagePrefix")} ${page.num}`;
    if (displayedPdfPage !== Number(page.num)) {
      displayedPdfPage = Number(page.num);
      showPdfPage(page.num);
      originalPdfLink.href = `PETROCARIBE-Audit-January-2019.pdf#page=${page.num}`;
    }
    previousButton.disabled = currentIndex === 0;
    nextButton.disabled = currentIndex === pages.length - 1;
    pageText.replaceChildren();
    appendHighlightedText(pageText, page.text || "", query);

    document.querySelectorAll(".result-item").forEach((item) => {
      item.setAttribute("aria-current", String(Number(item.dataset.page) === Number(page.num)));
    });
  }

  function makeSnippet(text, query) {
    const index = text.toLocaleLowerCase().indexOf(query.toLocaleLowerCase());
    const start = Math.max(0, index - 70);
    const end = Math.min(text.length, index + query.length + 100);
    return `${start > 0 ? "…" : ""}${text.slice(start, end).replace(/\s+/g, " ").trim()}${end < text.length ? "…" : ""}`;
  }

  function runSearch() {
    const query = searchInput.value.trim();
    resultsList.replaceChildren();

    if (!query) {
      resultsCount.textContent = pageCount(pages.length);
      const prompt = document.createElement("p");
      prompt.className = "results-empty";
      prompt.textContent = translate("searchPrompt");
      resultsList.append(prompt);
      renderPage(currentIndex);
      return;
    }

    const matches = pages.filter((page) => (page.text || "").toLocaleLowerCase().includes(query.toLocaleLowerCase()));
    resultsCount.textContent = pageCount(matches.length);

    if (matches.length === 0) {
      const empty = document.createElement("p");
      empty.className = "results-empty";
      empty.textContent = translate("noMatches");
      resultsList.append(empty);
      renderPage(currentIndex);
      return;
    }

    matches.forEach((page) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "result-item";
      button.dataset.page = String(page.num);

      const label = document.createElement("span");
      label.className = "result-page";
      label.textContent = `${translate("pagePrefix")} ${page.num}`;

      const snippet = document.createElement("span");
      snippet.className = "result-snippet";
      appendHighlightedText(snippet, makeSnippet(page.text || "", query), query);

      button.append(label, snippet);
      button.addEventListener("click", () => {
        const index = pageIndex.get(Number(page.num));
        if (index !== undefined) renderPage(index);
      });
      resultsList.append(button);
    });

    const currentPageMatches = matches.some((page) => Number(page.num) === Number(pages[currentIndex].num));
    if (!currentPageMatches) {
      const firstIndex = pageIndex.get(Number(matches[0].num));
      renderPage(firstIndex === undefined ? 0 : firstIndex);
    } else {
      renderPage(currentIndex);
    }
  }

  searchInput.addEventListener("input", runSearch);
  pageInput.addEventListener("change", () => {
    const requestedPage = Number.parseInt(pageInput.value, 10);
    const index = pageIndex.get(requestedPage);
    if (index === undefined) {
      pageInput.value = String(pages[currentIndex].num);
      return;
    }
    renderPage(index);
  });
  pageInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") pageInput.dispatchEvent(new Event("change"));
  });
  previousButton.addEventListener("click", () => renderPage(currentIndex - 1));
  nextButton.addEventListener("click", () => renderPage(currentIndex + 1));
  document.querySelectorAll("[data-page-link]").forEach((link) => {
    link.addEventListener("click", () => {
      const index = pageIndex.get(Number(link.dataset.pageLink));
      if (index !== undefined) renderPage(index);
    });
  });

  applyLanguage(currentLanguage);
})();
