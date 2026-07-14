'use strict';

// ------------------------------------------------------------------
// Language toggle (EN / JA)
// ------------------------------------------------------------------
// How it works:
//   - Every translatable element carries data-en and data-ja attributes.
//   - applyLanguage() swaps textContent to the right version.
//   - The choice is saved to localStorage and restored on every page load.
//   - The toggle button itself shows the *opposite* language label so it
//     acts as a "switch to" indicator rather than a "current" indicator.

function applyLanguage(lang) {
  document.querySelectorAll('[data-en]').forEach(el => {
    const text = (lang === 'ja' && el.dataset.ja) ? el.dataset.ja : el.dataset.en;

    // A <p> containing only <br> tags is still a text element — swap it with
    // textContent (which removes the <br>s, which is fine since the translation
    // is plain text without line breaks).
    // Elements with meaningful child elements like <figure> or <p> are skipped
    // here because their own child <p> tags carry the data-en/data-ja attributes.
    const onlyBrChildren = Array.from(el.children).every(c => c.tagName === 'BR');

    if (el.children.length === 0 || onlyBrChildren) {
      el.textContent = text;
    }
  });

  // swap input/textarea placeholders
  document.querySelectorAll('[data-placeholder-en]').forEach(el => {
    el.placeholder = (lang === 'ja' && el.dataset.placeholderJa)
      ? el.dataset.placeholderJa
      : el.dataset.placeholderEn;
  });

  // swap CV iframe src between CV.pdf and CVJP.pdf
  const cvIframe = document.querySelector('iframe[data-src-ja]');
  if (cvIframe) {
    // use data-src-en (never removed) not data-src (removed after first lazy-load)
    const newSrc = (lang === 'ja') ? cvIframe.dataset.srcJa : cvIframe.dataset.srcEn;
    if (cvIframe.src && !cvIframe.src.endsWith('about:blank')) {
      cvIframe.src = newSrc;
    }
    // update so the lazy-load handler picks the right file on first open
    cvIframe.dataset.activeSrc = newSrc;
  }

  // update the <html lang="..."> attribute so the CSS :lang() selector
  // can show/hide the correct toggle label
  document.documentElement.lang = lang;

  localStorage.setItem('lang', lang);
}

window.addEventListener('DOMContentLoaded', function () {
  const langBtn = document.getElementById('lang-toggle');
  if (!langBtn) return;

  // restore the last chosen language, defaulting to English
  applyLanguage(localStorage.getItem('lang') || 'en');

  langBtn.addEventListener('click', function () {
    const current = document.documentElement.lang || 'en';
    applyLanguage(current === 'en' ? 'ja' : 'en');
  });
});

// ------------------------------------------------------------------

// controls whether the frame-sequence animations on the Designs tab
// are allowed to keep looping (paused while that tab isn't visible)
let designsAnimationActive = false;

// element toggle function
const elementToggleFunc = function (elem) { elem.classList.toggle("active"); }



// sidebar variables
const sidebar = document.querySelector("[data-sidebar]");
const sidebarBtn = document.querySelector("[data-sidebar-btn]");

// sidebar toggle functionality for mobile
sidebarBtn.addEventListener("click", function () { elementToggleFunc(sidebar); });



// testimonials variables
const testimonialsItem = document.querySelectorAll("[data-testimonials-item]");
const modalContainer = document.querySelector("[data-modal-container]");
const modalCloseBtn = document.querySelector("[data-modal-close-btn]");
const overlay = document.querySelector("[data-overlay]");

// modal variable
const modalImg = document.querySelector("[data-modal-img]");
const modalTitle = document.querySelector("[data-modal-title]");
const modalText = document.querySelector("[data-modal-text]");

// modal toggle function
const testimonialsModalFunc = function () {
  modalContainer.classList.toggle("active");
  overlay.classList.toggle("active");
}

// add click event to all modal items
for (let i = 0; i < testimonialsItem.length; i++) {

  testimonialsItem[i].addEventListener("click", function () {

    modalImg.src = this.querySelector("[data-testimonials-avatar]").src;
    modalImg.alt = this.querySelector("[data-testimonials-avatar]").alt;
    modalTitle.innerHTML = this.querySelector("[data-testimonials-title]").innerHTML;
    modalText.innerHTML = this.querySelector("[data-testimonials-text]").innerHTML;

    testimonialsModalFunc();

  });

}

// add click event to modal close button
modalCloseBtn.addEventListener("click", testimonialsModalFunc);
overlay.addEventListener("click", testimonialsModalFunc);



// custom select variables
const select = document.querySelector("[data-select]");
const selectItems = document.querySelectorAll("[data-select-item]");
const selectValue = document.querySelector("[data-selecct-value]");
const filterBtn = document.querySelectorAll("[data-filter-btn]");

select.addEventListener("click", function () { elementToggleFunc(this); });

// add event in all select items
for (let i = 0; i < selectItems.length; i++) {
  selectItems[i].addEventListener("click", function () {

    let selectedValue = this.innerText.toLowerCase();
    selectValue.innerText = this.innerText;
    elementToggleFunc(select);
    filterFunc(selectedValue);

  });
}

// filter variables
const filterItems = document.querySelectorAll("[data-filter-item]");

const filterFunc = function (selectedValue) {

  for (let i = 0; i < filterItems.length; i++) {

    if (selectedValue === "all") {
      filterItems[i].classList.add("active");
    } else if (selectedValue === filterItems[i].dataset.category) {
      filterItems[i].classList.add("active");
    } else {
      filterItems[i].classList.remove("active");
    }

  }

}

// add event in all filter button items for large screen
let lastClickedBtn = filterBtn[0];

for (let i = 0; i < filterBtn.length; i++) {

  filterBtn[i].addEventListener("click", function () {

    let selectedValue = this.innerText.toLowerCase();
    selectValue.innerText = this.innerText;
    filterFunc(selectedValue);

    lastClickedBtn.classList.remove("active");
    this.classList.add("active");
    lastClickedBtn = this;

  });

}



// contact form variables
const form = document.querySelector("[data-form]");
const formInputs = document.querySelectorAll("[data-form-input]");
const formBtn = document.querySelector("[data-form-btn]");

// add event to all form input field
for (let i = 0; i < formInputs.length; i++) {
  formInputs[i].addEventListener("input", function () {

    // check form validation
    if (form.checkValidity()) {
      formBtn.removeAttribute("disabled");
    } else {
      formBtn.setAttribute("disabled", "");
    }

  });
}



// page navigation variables
const navigationLinks = document.querySelectorAll("[data-nav-link]");
const pages = document.querySelectorAll("[data-page]");

// add event to all nav link
for (let i = 0; i < navigationLinks.length; i++) {
  navigationLinks[i].addEventListener("click", function () {

    // use data-en to get the page name reliably regardless of current language
    const clickedPageName = (this.dataset.en || this.innerHTML).toLowerCase();

    for (let i = 0; i < pages.length; i++) {
      if (clickedPageName === pages[i].dataset.page) {
        pages[i].classList.add("active");
        window.scrollTo(0, 0);
      } else {
        pages[i].classList.remove("active");
      }
    }

    // highlight the clicked nav link and remove active from all others
    // (done separately so the highlight is always correct regardless of
    // whether the navbar order matches the article DOM order)
    // highlight the clicked link — use data-en for matching, not innerHTML,
    // because innerHTML is swapped to Japanese text in Japanese mode
    for (let i = 0; i < navigationLinks.length; i++) {
      const linkName = (navigationLinks[i].dataset.en || navigationLinks[i].innerHTML).toLowerCase();
      if (linkName === clickedPageName) {
        navigationLinks[i].classList.add("active");
      } else {
        navigationLinks[i].classList.remove("active");
      }
    }

    // lazy-load any PDF/Map iframe inside the page being shown,
    // so it isn't fetched until the visitor actually opens that tab
    const shownPage = document.querySelector(`[data-page="${clickedPageName}"]`);
    if (shownPage) {
      const lazyIframe = shownPage.querySelector("iframe[data-src]");
      if (lazyIframe) {
        // use data-active-src if the language switcher has set it, otherwise data-src
        const src = lazyIframe.dataset.activeSrc || lazyIframe.dataset.src;
        lazyIframe.src = src;
        lazyIframe.removeAttribute("data-src");
      }
    }

    // only run the Designs-tab frame animations while that tab is visible,
    // instead of letting them loop forever in the background
    designsAnimationActive = (clickedPageName === "designs");
    // pause/play all Designs-tab video elements when switching tabs
    ["rolling-bidet", "rolling-faucethead", "rolling-lixil", "rolling-ozone"].forEach((id) => {
      const vid = document.getElementById(id);
      if (vid) designsAnimationActive ? vid.play() : vid.pause();
    });

  });
}

// Update the last-updated / page-visit counter — only present on the homepage footer
const lastUpdatedEl = document.getElementById("last-updated");
const pageVisitsEl = document.getElementById("page-visits");

if (lastUpdatedEl) {
  const lastUpdatedDate = new Date(document.lastModified);
  lastUpdatedEl.textContent = lastUpdatedDate.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

if (pageVisitsEl) {
  import("https://www.gstatic.com/firebasejs/9.17.2/firebase-app.js").then(({ initializeApp }) => {
    Promise.all([
      import("https://www.gstatic.com/firebasejs/9.17.2/firebase-database.js"),
      import("https://www.gstatic.com/firebasejs/9.17.2/firebase-auth.js"),
    ]).then(([{ getDatabase, ref, onValue, runTransaction }, { getAuth, signInAnonymously, onAuthStateChanged }]) => {

      const firebaseConfig = {
        apiKey: "AIzaSyAwwHXb-pxsnioCe-OpxnL_QD7W2VugesM",
        authDomain: "page-visits-counter.firebaseapp.com",
        databaseURL: "https://page-visits-counter-default-rtdb.asia-southeast1.firebasedatabase.app",
        projectId: "page-visits-counter",
        storageBucket: "page-visits-counter.firebasestorage.app",
        messagingSenderId: "233814066051",
        appId: "1:233814066051:web:3c14bebd5901723f6cacb6",
      };

      const app = initializeApp(firebaseConfig);
      const database = getDatabase(app);
      const auth = getAuth();

      signInAnonymously(auth).catch((error) => {
        console.error("Authentication error:", error);
      });

      onAuthStateChanged(auth, (user) => {
        if (user) {
          const visitRef = ref(database, "pageVisits");

          runTransaction(visitRef, (currentVisits) => (currentVisits || 0) + 1);

          onValue(visitRef, (snapshot) => {
            pageVisitsEl.textContent = snapshot.val() || 0;
          });
        }
      });

    });
  });
}
