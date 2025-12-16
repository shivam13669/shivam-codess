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

  // smooth scrolling
  $('a[href*="#"]').on('click', function (e) {
    e.preventDefault();
    $('html, body').animate({
      scrollTop: $($(this).attr('href')).offset().top,
    }, 500, 'linear')
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

  document.title = `${course.name} | Portfolio Shivam`;
  document.getElementById('courseTitle').textContent = course.name;
  document.getElementById('courseShortDesc').textContent = course.shortDesc;
  document.getElementById('courseImage').src = course.image;
  document.getElementById('courseInstructor').textContent = course.instructor;
  document.getElementById('courseRating').textContent = `${stars} ${course.rating}/5`;
  document.getElementById('courseReviews').textContent = `${course.reviews} reviews`;
  document.getElementById('courseDuration').textContent = course.duration;
  document.getElementById('priceBadge').textContent = course.price;
  document.getElementById('courseDescription').textContent = course.description;

  // Learn section
  let learnHtml = '';
  course.highlights.forEach(highlight => {
    learnHtml += `<li>${highlight}</li>`;
  });
  document.getElementById('learnList').innerHTML = learnHtml;

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
  document.getElementById('curriculumList').innerHTML = curriculumHtml;

  // Requirements section
  let requirementsHtml = '';
  course.requirements.forEach(requirement => {
    requirementsHtml += `<li>${requirement}</li>`;
  });
  document.getElementById('requirementsList').innerHTML = requirementsHtml;

  // Buy button handlers
  document.getElementById('buyBtn').onclick = () => handleBuyNow(course);
  document.getElementById('buyBtnLarge').onclick = () => handleBuyNow(course);
  document.querySelector('.btn-preview').onclick = () => previewCourse(course);
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

function handleBuyNow(course) {
  alert(`Thank you for your interest in "${course.name}"!\n\nPrice: ${course.price}\n\nPayment gateway integration coming soon. For now, you can contact us at shivam19e@gmail.com to enroll.`);
}

function previewCourse(course) {
  alert('Preview feature coming soon!');
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
