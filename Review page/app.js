import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyC5L1rgnVS4Ii7hoJFGgr4J3mWSP1ByAOU",
  authDomain: "janela-reviews.firebaseapp.com",
  projectId: "janela-reviews",
  storageBucket: "janela-reviews.firebasestorage.app",
  messagingSenderId: "252514685388",
  appId: "1:252514685388:web:ae58d7830fe847f09c0d69"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const starterReviews = [
  {
    name: "Sarah M.",
    rating: 5,
    text: "Honestly didn’t realize how much of a difference it would make until it was done. The windows and siding look brand new. Super easy process from start to finish.",
    avatar: "https://i.pravatar.cc/120?img=32"
  },
  {
    name: "James R.",
    rating: 5,
    text: "Showed up on time, explained everything clearly, and took care of the whole house without any hassle. You can tell they actually care about doing it right.",
    avatar: "https://i.pravatar.cc/120?img=12"
  },
  {
    name: "Amanda T.",
    rating: 5,
    text: "House looked dull before, now it actually stands out again. Really solid work and very professional the whole way through.",
    avatar: "https://i.pravatar.cc/120?img=47"
  },
  {
    name: "Michael D.",
    rating: 5,
    text: "The whole place looked brighter the second they finished. Clean, professional, and very easy to work with.",
    avatar: "https://i.pravatar.cc/120?img=15"
  },
  {
    name: "Lauren P.",
    rating: 5,
    text: "We booked for one service and ended up doing more because of how thorough everything looked. The results were absolutely worth it.",
    avatar: "https://i.pravatar.cc/120?img=5"
  },
  {
    name: "Chris B.",
    rating: 5,
    text: "They walked me around everything after they finished and pointed out the differences. You could actually see where it was cleaned versus before. Definitely worth it.",
    avatar: "https://i.pravatar.cc/120?img=68"
  }
];

let publicReviews = [...starterReviews];
let currentSlide = 0;
let sliderTimer = null;

const sliderAvatar = document.getElementById("sliderAvatar");
const sliderStars = document.getElementById("sliderStars");
const sliderText = document.getElementById("sliderText");
const sliderName = document.getElementById("sliderName");
const sliderDots = document.getElementById("sliderDots");
const sliderCount = document.getElementById("sliderCount");
const allReviews = document.getElementById("allReviews");

const reviewForm = document.getElementById("reviewForm");
const surveyForm = document.getElementById("surveyForm");
const reviewMessage = document.getElementById("reviewMessage");
const surveyMessage = document.getElementById("surveyMessage");
const reviewPrompt = document.getElementById("reviewPrompt");

const reviewFormCard = document.getElementById("reviewFormCard");
const surveyFormCard = document.getElementById("surveyFormCard");

const showReviewBtn = document.getElementById("showReviewBtn");
const showSurveyBtn = document.getElementById("showSurveyBtn");
const reviewPromptBtn = document.getElementById("reviewPromptBtn");

function escapeHtml(str = "") {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showOnlyCard(type) {
  reviewFormCard.style.display = type === "review" ? "block" : "none";
  surveyFormCard.style.display = type === "survey" ? "block" : "none";

  if (type === "review") {
    reviewFormCard.scrollIntoView({ behavior: "smooth", block: "start" });
  } else {
    surveyFormCard.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function showMessage(el, text, type = "info") {
  el.textContent = text;
  el.className = `message show ${type}`;
}

function clearMessage(el) {
  el.textContent = "";
  el.className = "message";
}

function buildDots() {
  sliderDots.innerHTML = "";

  publicReviews.forEach((_, index) => {
    const dot = document.createElement("button");
    dot.className = `slider-dot ${index === currentSlide ? "active" : ""}`;
    dot.type = "button";
    dot.setAttribute("aria-label", `Show review ${index + 1}`);

    dot.addEventListener("click", () => {
      currentSlide = index;
      renderSlider();
      restartSlider();
    });

    sliderDots.appendChild(dot);
  });
}

function renderSlider() {
  if (!publicReviews.length) return;

  const review = publicReviews[currentSlide];
  sliderAvatar.src = review.avatar || "https://i.pravatar.cc/120?img=24";
  sliderStars.textContent = "★".repeat(Number(review.rating || 5));
  sliderText.textContent = `“${review.text}”`;
  sliderName.textContent = `— ${review.name}`;
  sliderCount.textContent = `${currentSlide + 1} / ${publicReviews.length}`;

  [...sliderDots.children].forEach((dot, index) => {
    dot.classList.toggle("active", index === currentSlide);
  });
}

function renderAllReviews() {
  allReviews.innerHTML = publicReviews
    .map(
      (review) => `
        <article class="review-item">
          <img
            class="review-item-avatar"
            src="${escapeHtml(review.avatar || "https://i.pravatar.cc/120?img=24")}"
            alt="${escapeHtml(review.name)} profile image"
          />
          <div class="review-item-content">
            <div class="stars">${"★".repeat(Number(review.rating || 5))}</div>
            <p>“${escapeHtml(review.text)}”</p>
            <small>— ${escapeHtml(review.name)}</small>
          </div>
        </article>
      `
    )
    .join("");
}

function restartSlider() {
  if (sliderTimer) clearInterval(sliderTimer);

  sliderTimer = setInterval(() => {
    currentSlide = (currentSlide + 1) % publicReviews.length;
    renderSlider();
  }, 4200);
}

function renderEverything() {
  if (!publicReviews.length) {
    publicReviews = [...starterReviews];
  }

  if (currentSlide >= publicReviews.length) {
    currentSlide = 0;
  }

  buildDots();
  renderSlider();
  renderAllReviews();
  restartSlider();
}

async function loadPublicReviews() {
  renderEverything();

  try {
    const q = query(collection(db, "publicReviews"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);

    const dbReviews = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }));

    publicReviews = [...starterReviews, ...dbReviews];
    renderEverything();
  } catch (error) {
    console.error("Error loading Firestore reviews:", error);
    publicReviews = [...starterReviews];
    renderEverything();
  }
}

async function submitPublicReview({ name, rating, text }) {
  await addDoc(collection(db, "publicReviews"), {
    name,
    rating,
    text,
    avatar: `https://i.pravatar.cc/120?img=${Math.floor(Math.random() * 70) + 1}`,
    createdAt: serverTimestamp()
  });
}

async function submitPrivateFeedback({ name, rating, text }) {
  await addDoc(collection(db, "privateFeedback"), {
    name,
    rating,
    text,
    createdAt: serverTimestamp()
  });
}

async function submitSurveyResponse(payload) {
  await addDoc(collection(db, "surveyResponses"), {
    ...payload,
    createdAt: serverTimestamp()
  });
}

showReviewBtn.addEventListener("click", () => showOnlyCard("review"));
showSurveyBtn.addEventListener("click", () => showOnlyCard("survey"));
reviewPromptBtn.addEventListener("click", () => showOnlyCard("review"));

reviewForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearMessage(reviewMessage);

  const name = document.getElementById("reviewName").value.trim() || "Anonymous";
  const rating = Number(document.getElementById("reviewRating").value);
  const text = document.getElementById("reviewText").value.trim();

  if (!rating || !text) {
    showMessage(reviewMessage, "Please complete the rating and review fields.", "info");
    return;
  }

  try {
    if (rating >= 4) {
      await submitPublicReview({ name, rating, text });
      showMessage(
        reviewMessage,
        "Thank you for your review. Your feedback has been submitted.",
        "success"
      );
      reviewForm.reset();
      await loadPublicReviews();
    } else {
      await submitPrivateFeedback({ name, rating, text });
      showMessage(
        reviewMessage,
        "Thank you for your feedback. We appreciate you sharing your experience and will use it to improve.",
        "info"
      );
      reviewForm.reset();
    }
  } catch (error) {
    console.error(error);
    showMessage(
      reviewMessage,
      "Something went wrong while submitting your review. Please try again.",
      "info"
    );
  }
});

surveyForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearMessage(surveyMessage);
  reviewPrompt.classList.add("hidden");

  const name = document.getElementById("surveyName").value.trim() || "Anonymous";
  const q1 = Number(document.getElementById("q1").value);
  const q2 = Number(document.getElementById("q2").value);
  const q3 = Number(document.getElementById("q3").value);
  const q4 = Number(document.getElementById("q4").value);
  const q5 = Number(document.getElementById("q5").value);

  if (![q1, q2, q3, q4, q5].every(Boolean)) {
    showMessage(
      surveyMessage,
      "Please answer all survey questions before submitting.",
      "info"
    );
    return;
  }

  const answers = [q1, q2, q3, q4, q5];
  const positiveCount = answers.filter((value) => value >= 4).length;

  try {
    await submitSurveyResponse({ name, q1, q2, q3, q4, q5, positiveCount });

    if (positiveCount >= 4) {
      showMessage(
        surveyMessage,
        "Appreciate you taking the time. Based on your feedback, you may qualify for 20% off your next service.",
        "success"
      );
      reviewPrompt.classList.remove("hidden");
    } else {
      showMessage(
        surveyMessage,
        "Thank you for your feedback. We take this seriously and use it to improve our service.",
        "info"
      );
    }

    surveyForm.reset();
  } catch (error) {
    console.error(error);
    showMessage(
      surveyMessage,
      "Something went wrong while submitting your survey. Please try again.",
      "info"
    );
  }
});

showOnlyCard("review");
loadPublicReviews();