const showsContainer = document.getElementById("shows-container");
const seatsContainer = document.getElementById("seats-container");
const seatStatus = document.getElementById("seat-status");

const userIdEl = document.getElementById("userId");
const selectedShowIdEl = document.getElementById("selectedShowId");
const selectedSeatsEl = document.getElementById("selectedSeats");

const bookBtn = document.getElementById("bookBtn");
const bookingResult = document.getElementById("bookingResult");

const payBtn = document.getElementById("payBtn");
const payMethod = document.getElementById("payMethod");
const payResult = document.getElementById("payResult");
const summaryBox = document.getElementById("summaryBox");


let currentShowId = null;
let selectedSeatIds = [];
let lastBookingId = null;

async function loadBookingSummary(bookingId){
  summaryBox.innerHTML = "Loading booking summary...";
  const res = await fetch(`/bookings/${bookingId}`);
  const data = await res.json();

  if (data.error){
    summaryBox.innerHTML = "Summary error: " + data.error;
    return;
  }

  const b = data.booking;
  const seats = data.seats.map(x => x.SEAT_LABEL).join(", ");
  const pay = data.payment;

  summaryBox.innerHTML = `
    <b>Booking ID:</b> ${b.BOOKING_ID}<br>
    <b>Movie:</b> ${b.TITLE}<br>
    <b>Show Time:</b> ${b.SHOW_TIME}<br>
    <b>Seats:</b> ${seats}<br>
    <b>Total Amount:</b> ₹${b.TOTAL_AMOUNT}<br>
    <b>Status:</b> ${b.STATUS}<br>
    <b>Payment:</b> ${pay ? (pay.PAYMENT_STATUS + " (" + pay.METHOD + ")") : "Not Paid"}
  `;
}

function renderShows(data){
  showsContainer.innerHTML = "";
  data.forEach(show => {
    const div = document.createElement("div");
    div.className = "show-card";
    div.innerHTML = `
      <h3>${show.TITLE}</h3>
      <p>Show ID: ${show.SHOW_ID}</p>
      <p>Screen: ${show.SCREEN_ID}</p>
      <p>Time: ${show.SHOW_TIME}</p>
      <p>Price: ₹${show.PRICE}</p>
      <button onclick="selectShow(${show.SHOW_ID})">Book Now</button>
    `;
    showsContainer.appendChild(div);
  });
}

async function loadShows(){
  const res = await fetch("/shows");
  const data = await res.json();
  renderShows(data);
}

window.selectShow = async (showId) => {
  currentShowId = showId;
  selectedSeatIds = [];
  lastBookingId = null;

  selectedShowIdEl.value = showId;
  selectedSeatsEl.value = "";
  bookingResult.textContent = "";
  payResult.textContent = "";

  seatStatus.textContent = "Loading seats...";
  seatsContainer.innerHTML = "";

  const res = await fetch(`/shows/${showId}/available-seats`);
  const seats = await res.json();

  if (seats.error){
    seatStatus.textContent = seats.error;
    return;
  }

  seatStatus.textContent = `Available Seats: ${seats.length} (click to select)`;

  seatsContainer.innerHTML = seats.slice(0, 36).map(s => `
    <div class="seat" data-id="${s.SEAT_ID}">
      ${s.SEAT_ROW}${s.SEAT_NO}
    </div>
  `).join("");

  document.querySelectorAll(".seat").forEach(el => {
    el.addEventListener("click", () => {
      const id = Number(el.getAttribute("data-id"));
      if (selectedSeatIds.includes(id)){
        selectedSeatIds = selectedSeatIds.filter(x => x !== id);
        el.classList.remove("selected");
      } else {
        selectedSeatIds.push(id);
        el.classList.add("selected");
      }
      selectedSeatsEl.value = selectedSeatIds.join(",");
    });
  });
};

bookBtn.addEventListener("click", async () => {
  if (!currentShowId) return alert("Select a show first!");
  if (selectedSeatIds.length === 0) return alert("Select seats first!");

  const userId = Number(userIdEl.value);
  const seatIdsCsv = selectedSeatIds.join(",");

  const res = await fetch("/bookings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, showId: currentShowId, seatIdsCsv })
  });

  const data = await res.json();
  if (data.error){
    bookingResult.textContent = "Booking failed: " + data.error;
    return;
  }

  lastBookingId = data.bookingId;
  bookingResult.textContent = "✅ Booking Created! Booking ID = " + lastBookingId;
  loadBookingSummary(lastBookingId);

});

payBtn.addEventListener("click", async () => {
  if (!lastBookingId) return alert("Create booking first!");

  const res = await fetch("/payments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bookingId: lastBookingId, method: payMethod.value })
  });

  const data = await res.json();
  if (data.error){
    payResult.textContent = "Payment failed: " + data.error;
    return;
  }

  payResult.textContent = "✅ Payment Success!";
loadBookingSummary(lastBookingId);
selectShow(currentShowId);
async function reloadSeats(showId){
  seatStatus.textContent = "Loading seats...";
  seatsContainer.innerHTML = "";

  const res = await fetch(`/shows/${showId}/available-seats`);
  const seats = await res.json();

  if (seats.error){
    seatStatus.textContent = seats.error;
    return;
  }

  seatStatus.textContent = `Available Seats: ${seats.length} (click to select)`;

  seatsContainer.innerHTML = seats.slice(0, 36).map(s => `
    <div class="seat" data-id="${s.SEAT_ID}">
      ${s.SEAT_ROW}${s.SEAT_NO}
    </div>
  `).join("");

  // reset selection
  selectedSeatIds = [];
  selectedSeatsEl.value = "";
}
await reloadSeats(currentShowId);

});

// start
loadShows();