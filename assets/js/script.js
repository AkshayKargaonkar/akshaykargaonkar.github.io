'use strict';

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

    const clickedPageName = this.innerHTML.toLowerCase();

    for (let i = 0; i < pages.length; i++) {
      if (clickedPageName === pages[i].dataset.page) {
        pages[i].classList.add("active");
        navigationLinks[i].classList.add("active");
        window.scrollTo(0, 0);
      } else {
        pages[i].classList.remove("active");
        navigationLinks[i].classList.remove("active");
      }
    }

    // lazy-load any PDF/Map iframe inside the page being shown,
    // so it isn't fetched until the visitor actually opens that tab
    const shownPage = document.querySelector(`[data-page="${clickedPageName}"]`);
    if (shownPage) {
      const lazyIframe = shownPage.querySelector("iframe[data-src]");
      if (lazyIframe) {
        lazyIframe.src = lazyIframe.dataset.src;
        lazyIframe.removeAttribute("data-src");
      }
    }

    // only run the Designs-tab frame animations while that tab is visible,
    // instead of letting them loop forever in the background
    designsAnimationActive = (clickedPageName === "designs");

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


// Designs-tab frame-sequence animations.
// These only run while the Designs tab is open (designsAnimationActive flag,
// set in the nav-link click handler above) instead of looping forever in the
// background on every page load.
//
// NOTE: these WebP-frame sequences are a heavy way to animate (each one is
// 9-60 separate image requests, repeated indefinitely). The recommended fix
// is to convert each sequence into a short looping .webm/.mp4 video and swap
// the <img> for a <video autoplay muted loop playsinline poster="...">.
// Keeping the frame-loop approach here for now since the asset conversion
// has to happen outside this script (see ffmpeg notes provided separately).
function startFrameAnimation({ elementId, folder, totalFrames, fps, gatedByDesignsTab }) {
  const imgEl = document.getElementById(elementId);
  if (!imgEl) return;

  const frameRate = 1000 / fps;
  let frameNumber = 1;

  setInterval(() => {
    // skip frame updates while the Designs tab isn't visible, so the browser
    // isn't repeatedly fetching/decoding images nobody is looking at
    if (gatedByDesignsTab && !designsAnimationActive) return;

    const frameIndex = String(frameNumber).padStart(4, '0');
    imgEl.src = `./${folder}/${frameIndex}.webp`;
    frameNumber = (frameNumber % totalFrames) + 1;
  }, frameRate);
}

window.addEventListener("DOMContentLoaded", function () {
  // intro animation on the About tab — always visible, not gated
  startFrameAnimation({ elementId: "intro", folder: "intro", totalFrames: 9, fps: 3, gatedByDesignsTab: false });

  // Designs-tab animations — gated so they pause while that tab is hidden
  startFrameAnimation({ elementId: "rolling-bidet", folder: "rollingbidet", totalFrames: 60, fps: 24, gatedByDesignsTab: true });
  startFrameAnimation({ elementId: "rolling-faucethead", folder: "rollingfaucethead", totalFrames: 60, fps: 24, gatedByDesignsTab: true });
  startFrameAnimation({ elementId: "rolling-lixil", folder: "rollinglixil", totalFrames: 60, fps: 24, gatedByDesignsTab: true });
  startFrameAnimation({ elementId: "rolling-ozone", folder: "rollingozone", totalFrames: 60, fps: 24, gatedByDesignsTab: true });
});
