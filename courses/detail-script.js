$(document).ready(function () {

  $('#menu').click(function () {
    $(this).toggleClass('fa-times');
    $('.navbar').toggleClass('nav-toggle');
  });

  $(window).on('scroll load', function () {
    $('#menu').removeClass('fa-times');
    $('.navbar').removeClass('nav-toggle');

    if (window.scrollY > 60) {
      document.querySelector('#scroll-top').classList.add('active');
    } else {
      document.querySelector('#scroll-top').classList.remove('active');
    }
  });

  // smooth scrolling - only for links that exist on this page
  $('a[href*="#"]').on('click', function (e) {
    const href = $(this).attr('href');
    const targetElement = $(href);

    if (targetElement.length) {
      e.preventDefault();
      $('html, body').animate({
        scrollTop: targetElement.offset().top,
      }, 500, 'linear');
    }
  });

  loadCourseDetail();
});

function getCourseIdFromUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  return parseInt(urlParams.get('id')) || 1;
}

function loadCourseDetail() {
  const courseId = getCourseIdFromUrl();

  fetch('/courses/courses.json')
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(courses => {
      const course = courses.find(c => c.id === courseId);
      if (course) {
        displayCourseDetail(course);
      } else {
        document.body.innerHTML = '<div style="text-align: center; padding: 5rem; font-size: 1.5rem;">Course not found. <a href="/courses">Back to courses</a></div>';
      }
    })
    .catch(error => {
      console.error('Error loading course:', error);
      document.body.innerHTML = '<div style="text-align: center; padding: 5rem; font-size: 1.5rem;">Error loading course. <a href="/courses">Back to courses</a></div>';
    });
}

function displayCourseDetail(course) {
  const stars = '★'.repeat(Math.floor(course.rating)) + '☆'.repeat(5 - Math.floor(course.rating));

  document.title = `${course.name} | Design Byte`;

  // Safely set element content with existence checks
  const setElementContent = (id, content) => {
    const el = document.getElementById(id);
    if (el) el.textContent = content;
  };

  const setElementAttr = (id, attr, value) => {
    const el = document.getElementById(id);
    if (el) el[attr] = value;
  };

  setElementContent('courseTitle', course.name);
  setElementContent('courseShortDesc', course.shortDesc);
  setElementAttr('courseImage', 'src', course.image);
  setElementContent('courseInstructor', course.instructor);
  setElementContent('courseRating', `${stars} ${course.rating}/5`);
  setElementContent('courseReviews', `${course.reviews} reviews`);
  setElementContent('courseDuration', course.duration);
  setElementContent('priceBadge', course.price);
  setElementContent('coursePrice', course.price);
  setElementContent('courseDescription', course.description);

  // Learn section
  let learnHtml = '';
  course.highlights.forEach(highlight => {
    learnHtml += `<li>${highlight}</li>`;
  });
  const learnEl = document.getElementById('learnList');
  if (learnEl) learnEl.innerHTML = learnHtml;

  // Curriculum section
  let curriculumHtml = '';
  course.syllabus.forEach((section, index) => {
    let topicsHtml = '';
    section.topics.forEach(topic => {
      topicsHtml += `<li>${topic}</li>`;
    });
    curriculumHtml += `
      <div class="curriculum-item">
        <div class="curriculum-header" onclick="toggleCurriculum(this)">
          <span class="curriculum-title">${section.section}</span>
          <i class="fas fa-chevron-down"></i>
        </div>
        <ul class="curriculum-topics" style="display: ${index === 0 ? 'block' : 'none'};">
          ${topicsHtml}
        </ul>
      </div>
    `;
  });
  const curriculumEl = document.getElementById('curriculumList');
  if (curriculumEl) curriculumEl.innerHTML = curriculumHtml;

  // Requirements section
  let requirementsHtml = '';
  course.requirements.forEach(requirement => {
    requirementsHtml += `<li>${requirement}</li>`;
  });
  const requirementsEl = document.getElementById('requirementsList');
  if (requirementsEl) requirementsEl.innerHTML = requirementsHtml;

  // Buy button handlers
  const buyBtn = document.getElementById('buyBtn');
  if (buyBtn) buyBtn.onclick = () => handleBuyNow(course);

  const buyBtnLarge = document.getElementById('buyBtnLarge');
  if (buyBtnLarge) buyBtnLarge.onclick = () => handleBuyNow(course);
}

function toggleCurriculum(element) {
  const list = element.nextElementSibling;
  const icon = element.querySelector('i');
  
  if (list.style.display === 'none') {
    list.style.display = 'block';
    icon.classList.add('rotate');
  } else {
    list.style.display = 'none';
    icon.classList.remove('rotate');
  }
}

// Store current course and payment context
let currentCourseForPayment = null;
let currentPaymentGateway = null;

function handleBuyNow(course) {
  currentCourseForPayment = course;
  openPaymentModal();
}

function openPaymentModal() {
  const overlay = document.getElementById('paymentModalOverlay');
  if (overlay) {
    overlay.classList.add('active');
    resetPaymentModal();
  }
}

function closePaymentModal() {
  const overlay = document.getElementById('paymentModalOverlay');
  if (overlay) {
    overlay.classList.remove('active');
  }
  resetPaymentModal();
}

function resetPaymentModal() {
  showGatewaySelection();
  document.getElementById('customerForm').reset();
  clearFormErrors();
}

// Show gateway selection view
function showGatewaySelection() {
  document.getElementById('gatewaySelectionView').style.display = 'block';
  document.getElementById('customerDetailsView').style.display = 'none';
}

// Show customer details form
function showCustomerDetailsForm() {
  document.getElementById('gatewaySelectionView').style.display = 'none';
  document.getElementById('customerDetailsView').style.display = 'block';
}

// Back to gateway selection
function backToGatewaySelection() {
  showGatewaySelection();
  document.getElementById('customerForm').reset();
  clearFormErrors();
}

// Clear form error messages
function clearFormErrors() {
  document.getElementById('nameError').textContent = '';
  document.getElementById('emailError').textContent = '';
  document.getElementById('phoneError').textContent = '';
}

// Validate customer form
function validateCustomerForm() {
  clearFormErrors();
  const name = document.getElementById('customerName').value.trim();
  const email = document.getElementById('customerEmail').value.trim();
  const phone = document.getElementById('customerPhone').value.trim();
  let isValid = true;

  if (!name || name.length < 3) {
    document.getElementById('nameError').textContent = 'Please enter a valid name (minimum 3 characters)';
    isValid = false;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    document.getElementById('emailError').textContent = 'Please enter a valid email address';
    isValid = false;
  }

  const phoneRegex = /^[6-9]\d{9}$/;
  if (!phone || !phoneRegex.test(phone)) {
    document.getElementById('phoneError').textContent = 'Please enter a valid 10-digit phone number';
    isValid = false;
  }

  return isValid;
}

// Get customer details from form
function getCustomerDetailsFromForm() {
  return {
    name: document.getElementById('customerName').value.trim(),
    email: document.getElementById('customerEmail').value.trim(),
    phone: document.getElementById('customerPhone').value.trim()
  };
}

// Form submission
document.addEventListener('DOMContentLoaded', function() {
  const form = document.getElementById('customerForm');
  if (form) {
    form.addEventListener('submit', async function(e) {
      e.preventDefault();
      if (validateCustomerForm()) {
        const customerDetails = getCustomerDetailsFromForm();
        proceedToPaymentGateway(customerDetails);
      }
    });
  }
});

// Close modal when clicking outside
document.addEventListener('click', function(event) {
  const overlay = document.getElementById('paymentModalOverlay');
  if (event.target === overlay) {
    closePaymentModal();
  }
});

// Close modal on Escape key
document.addEventListener('keydown', function(event) {
  if (event.key === 'Escape') {
    closePaymentModal();
  }
});

// Select payment gateway and show customer form
function selectPaymentGateway(gateway) {
  if (!currentCourseForPayment) {
    showPaymentStatus('error', 'Course Not Found', 'Course information was not found. Please try again.');
    return;
  }

  currentPaymentGateway = gateway;
  showCustomerDetailsForm();
}

// Proceed to payment gateway with customer details
async function proceedToPaymentGateway(customerDetails) {
  if (!currentCourseForPayment || !currentPaymentGateway) {
    showPaymentStatus('error', 'Payment Error', 'Payment initialization failed. Please try again.');
    return;
  }

  const modal = document.querySelector('.payment-modal');
  if (modal) modal.classList.add('loading');

  try {
    // Get course price
    const priceText = currentCourseForPayment.price;
    const amount = parseFloat(priceText.replace('₹', '').trim());

    // Store for later verification (especially for redirects)
    localStorage.setItem('current_amount', amount);
    localStorage.setItem('current_customer_email', customerDetails.email);

    // Call backend API to create order
    const response = await fetch('http://localhost:5000/api/payment/create-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amount,
        gateway: currentPaymentGateway,
        customer: customerDetails,
        description: `Payment for ${currentCourseForPayment.name}`
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to create order');
    }

    // Close modal before opening payment gateway
    closePaymentModal();
    if (modal) modal.classList.remove('loading');

    // Handle different gateways
    handleGatewayPayment(currentPaymentGateway, data.order, amount, customerDetails);

  } catch (error) {
    console.error('Payment error:', error);
    if (modal) modal.classList.remove('loading');
    showPaymentStatus('error', 'Payment Initialization Failed', error.message);
  }
}

function handleGatewayPayment(gateway, order, amount, customer) {
  switch(gateway) {
    case 'razorpay':
      handleRazorpayPayment(order, amount, customer);
      break;
    case 'phonepe':
      handlePhonePePayment(order);
      break;
    case 'cashfree':
      handleCashfreePayment(order);
      break;
  }
}

function handleRazorpayPayment(order, amount, customer) {
  // Load Razorpay script if not loaded
  if (!window.Razorpay) {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => openRazorpayCheckout(order, amount, customer);
    document.head.appendChild(script);
  } else {
    openRazorpayCheckout(order, amount, customer);
  }
}

function openRazorpayCheckout(order, amount, customer) {
  const options = {
    key: order.razorpayKey,
    amount: order.amount,
    currency: 'INR',
    order_id: order.orderId,
    customer_details: {
      name: customer.name,
      email: customer.email,
      contact: customer.phone
    },
    handler: async function(response) {
      await verifyRazorpayPayment(order.orderId, response.razorpay_payment_id, response.razorpay_signature);
    },
    prefill: {
      name: customer.name,
      email: customer.email,
      contact: customer.phone
    },
    theme: {
      color: '#2b3dda'
    },
    modal: {
      ondismiss: function() {
        console.log('Payment modal closed');
      }
    }
  };

  const rzp = new Razorpay(options);
  rzp.open();
}

async function verifyRazorpayPayment(orderId, paymentId, signature) {
  try {
    showPaymentStatus('pending', 'Processing Payment', 'Please wait while we confirm your payment...');

    const response = await fetch('http://localhost:5000/api/payment/verify-payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        gateway: 'razorpay',
        orderId: orderId,
        paymentId: paymentId,
        signature: signature
      })
    });

    const data = await response.json();

    if (data.success) {
      showPaymentSuccess('Razorpay', data);
    } else {
      showPaymentStatus('error', 'Payment Verification Failed', data.error || 'Please contact support if the issue persists.');
    }
  } catch (error) {
    console.error('Verification error:', error);
    showPaymentStatus('error', 'Payment Verification Failed', 'An error occurred during verification. Please contact support.');
  }
}

function handlePhonePePayment(order) {
  if (order.redirectUrl) {
    // Store transaction ID for later verification
    localStorage.setItem('phonepe_transaction_id', order.transactionId);
    localStorage.setItem('phonepe_amount', localStorage.getItem('current_amount'));

    // Redirect to PhonePe
    window.location.href = order.redirectUrl;
  } else {
    alert('Failed to get PhonePe payment URL');
  }
}

function handleCashfreePayment(order) {
  if (order.paymentLink) {
    // Store order ID for later verification
    localStorage.setItem('cashfree_order_id', order.orderId);

    // Redirect to Cashfree
    window.location.href = order.paymentLink;
  } else {
    alert('Failed to get Cashfree payment link');
  }
}

function showPaymentSuccess(gateway, paymentData) {
  const message = `
✅ Payment Successful!

Gateway: ${gateway}
Amount: ₹${paymentData.amount}
Status: ${paymentData.status}

You will be enrolled in the course shortly.
Check your email for further instructions.
  `;

  alert(message);

  // Redirect to courses page after 2 seconds
  setTimeout(() => {
    window.location.href = '/courses';
  }, 2000);
}

// Disable developer mode
document.onkeydown = function (e) {
  if (e.keyCode == 123) {
    return false;
  }
  if (e.ctrlKey && e.shiftKey && e.keyCode == 'I'.charCodeAt(0)) {
    return false;
  }
  if (e.ctrlKey && e.shiftKey && e.keyCode == 'C'.charCodeAt(0)) {
    return false;
  }
  if (e.ctrlKey && e.shiftKey && e.keyCode == 'J'.charCodeAt(0)) {
    return false;
  }
  if (e.ctrlKey && e.keyCode == 'U'.charCodeAt(0)) {
    return false;
  }
}
