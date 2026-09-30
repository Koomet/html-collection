/* =========================================================
   GITHUB CONFIGURATION
========================================================= */
const username = "USERNAME_GITHUB_KAMU";
const repo = "NAMA_REPOSITORY_KAMU";

const CONFIG = {
    apiBase: "https://api.github.com",
    htmlDirectory: "html_folder",
    metadataPath: "assets/data.json",
    defaultThumbnail: "assets/thumbnails/default.png",
    defaultTitle: "Untitled Page",
    defaultSubtext: "Halaman ini belum memiliki metadata di data.json.",
    apiVersion: "2022-11-28"
};

const elements = {
    cardsContainer: document.getElementById("cards-container"),
    loadingStatus: document.getElementById("loading-status"),
    pageCount: document.getElementById("page-count"),
    emptyState: document.getElementById("empty-state"),
    errorState: document.getElementById("error-state"),
    errorMessage: document.getElementById("error-message"),
    retryButton: document.getElementById("retry-button"),
    currentYear: document.getElementById("current-year")
};

document.addEventListener("DOMContentLoaded", () => {
    elements.currentYear.textContent = new Date().getFullYear();
    animateHero();
    loadPages();
    elements.retryButton.addEventListener("click", loadPages);
});

async function loadPages() {
    setLoading(true);
    hideState(elements.emptyState);
    hideState(elements.errorState);
    elements.cardsContainer.innerHTML = "";

    try {
        const [pagesResult, metadataResult] = await Promise.allSettled([
            fetchHtmlPages(),
            fetchMetadata()
        ]);

        const metadata = metadataResult.status === "fulfilled"
            ? metadataResult.value
            : {};
        const metadataPages = Object.keys(metadata)
            .filter(fileName => fileName.toLowerCase().endsWith(".html"))
            .map(name => ({ name }))
            .sort((a, b) =>
                a.name.localeCompare(b.name, undefined, {
                    numeric: true,
                    sensitivity: "base"
                })
            );
        const pages = pagesResult.status === "fulfilled" &&
            pagesResult.value.length > 0
            ? pagesResult.value
            : metadataPages;

        if (pages.length === 0 && pagesResult.status === "rejected") {
            throw pagesResult.reason;
        }

        if (pages.length === 0) {
            showState(elements.emptyState);
            elements.pageCount.textContent = "0";
            return;
        }

        elements.pageCount.textContent = pages.length;

        pages.forEach((page, index) => {
            const cardData = buildCardData(page, metadata);
            const card = createCard(cardData, index);
            elements.cardsContainer.appendChild(card);
        });

        animateCards();
    } catch (error) {
        console.error("Failed to load pages:", error);
        showError(getFriendlyError(error));
    } finally {
        setLoading(false);
    }
}

async function fetchHtmlPages() {
    const repository = resolveRepository();
    const endpoint =
        `${CONFIG.apiBase}/repos/` +
        `${encodeURIComponent(repository.owner)}/` +
        `${encodeURIComponent(repository.name)}/contents/` +
        `${CONFIG.htmlDirectory}`;

    const response = await fetch(endpoint, {
        headers: {
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": CONFIG.apiVersion
        },
        cache: "no-store"
    });

    if (!response.ok) {
        let details = "";
        try {
            const errorData = await response.json();
            details = errorData.message || "";
        } catch {}
        throw new Error(`GitHub API error (${response.status}) ${details}`);
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
        throw new Error("html_folder bukan directory atau tidak dapat dibaca.");
    }

    return data
        .filter(item =>
            item.type === "file" &&
            item.name.toLowerCase().endsWith(".html")
        )
        .sort((a, b) =>
            a.name.localeCompare(b.name, undefined, {
                numeric: true,
                sensitivity: "base"
            })
        );
}

function resolveRepository() {
    const placeholders = username === "USERNAME_GITHUB_KAMU" ||
        repo === "NAMA_REPOSITORY_KAMU";

    if (!placeholders) {
        return { owner: username, name: repo };
    }

    const host = window.location.hostname.toLowerCase();
    const githubDomain = ".github.io";

    if (!host.endsWith(githubDomain)) {
        throw new Error("Set username dan repo GitHub di assets/js/script.js.");
    }

    const owner = host.slice(0, -githubDomain.length);
    const pathSegments = window.location.pathname.split("/").filter(Boolean);
    const name = pathSegments[0] || `${owner}.github.io`;

    return { owner, name };
}

async function fetchMetadata() {
    const response = await fetch(CONFIG.metadataPath, {
        cache: "no-store"
    });

    if (!response.ok) {
        throw new Error(`data.json gagal dimuat (${response.status})`);
    }

    const data = await response.json();

    if (
        typeof data !== "object" ||
        data === null ||
        Array.isArray(data)
    ) {
        throw new Error("Format data.json tidak valid.");
    }

    return data;
}

function buildCardData(page, metadata) {
    const fileName = page.name;
    const item = metadata[fileName] || {};

    return {
        fileName,
        title: normalizeText(item.title, CONFIG.defaultTitle),
        subtext: normalizeText(item.subtext, CONFIG.defaultSubtext),
        banner: normalizeBanner(item.banner, CONFIG.defaultThumbnail),
        href: buildPageUrl(fileName)
    };
}

function createCard(data, index) {
    const article = document.createElement("article");
    article.className = "page-card";

    const thumbnail = document.createElement("div");
    thumbnail.className = "card-thumbnail";

    const image = document.createElement("img");
    image.src = data.banner;
    image.alt = `${data.title} thumbnail`;
    image.loading = index < 3 ? "eager" : "lazy";
    image.decoding = "async";

    image.addEventListener("error", () => {
        if (!image.src.endsWith(CONFIG.defaultThumbnail)) {
            image.src = CONFIG.defaultThumbnail;
        }
    }, { once: true });

    thumbnail.appendChild(image);

    const content = document.createElement("div");
    content.className = "card-content";

    const title = document.createElement("h3");
    title.className = "card-title";
    title.textContent = data.title;

    const description = document.createElement("p");
    description.className = "card-description";
    description.textContent = data.subtext;

    const footer = document.createElement("div");
    footer.className = "card-footer";

    const fileName = document.createElement("span");
    fileName.className = "file-name";
    fileName.title = data.fileName;
    fileName.textContent = data.fileName;

    const link = document.createElement("a");
    link.className = "enter-button";
    link.href = data.href;
    link.textContent = "Masuk";

    const arrow = document.createElement("span");
    arrow.className = "enter-arrow";
    arrow.textContent = "→";

    link.appendChild(arrow);
    footer.append(fileName, link);
    content.append(title, description, footer);
    article.append(thumbnail, content);

    return article;
}

function buildPageUrl(fileName) {
    return `${CONFIG.htmlDirectory}/${encodeURIComponent(fileName)}`;
}

function normalizeText(value, fallback) {
    return typeof value === "string" && value.trim()
        ? value.trim()
        : fallback;
}

function normalizeBanner(value, fallback) {
    if (typeof value !== "string" || !value.trim()) {
        return fallback;
    }

    const banner = value.trim();

    if (/^https?:\/\//i.test(banner)) {
        return banner;
    }

    return banner.replace(/^\.\/+/, "");
}

function setLoading(isLoading) {
    if (isLoading) {
        elements.loadingStatus.classList.remove("hidden");
        elements.loadingStatus.innerHTML =
            '<span class="loading-spinner"></span>Loading...';
    } else {
        elements.loadingStatus.classList.add("hidden");
    }
}

function showState(element) {
    element.classList.remove("hidden");
}

function hideState(element) {
    element.classList.add("hidden");
}

function showError(message) {
    elements.errorMessage.textContent = message;
    showState(elements.errorState);
}

function getFriendlyError(error) {
    const message = error?.message || "";

    if (message.includes("404")) {
        return "Repository atau folder html_folder tidak ditemukan. Periksa username, repo, dan struktur folder GitHub kamu.";
    }

    if (message.includes("403")) {
        return "GitHub API menolak request. Coba beberapa saat lagi atau periksa ketersediaan repository.";
    }

    if (message.includes("Failed to fetch")) {
        return "Tidak dapat terhubung ke GitHub. Periksa koneksi internet dan coba lagi.";
    }

    return "Terjadi kesalahan saat memuat halaman. Periksa console browser untuk detail.";
}

function animateHero() {
    if (
        window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
        typeof anime === "undefined"
    ) return;

    const { animate } = anime;

    animate(".hero-badge", {
        opacity: [0, 1],
        y: [-20, 0],
        duration: 700,
        ease: "out(4)"
    });

    animate(".hero h1", {
        opacity: [0, 1],
        y: [35, 0],
        duration: 900,
        delay: 100,
        ease: "out(4)"
    });

    animate(".hero-description", {
        opacity: [0, 1],
        y: [25, 0],
        duration: 800,
        delay: 220,
        ease: "out(4)"
    });

    animate(".hero-meta", {
        opacity: [0, 1],
        y: [20, 0],
        duration: 700,
        delay: 350,
        ease: "out(4)"
    });
}

function animateCards() {
    if (
        window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
        typeof anime === "undefined"
    ) return;

    const { animate } = anime;
    const cards = document.querySelectorAll(".page-card");

    cards.forEach((card, index) => {
        animate(card, {
            opacity: [0, 1],
            y: [35, 0],
            duration: 650,
            delay: 100 + index * 90,
            ease: "out(4)"
        });
    });
}
