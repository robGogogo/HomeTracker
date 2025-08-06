// Enhanced Home Tracker Application
class HomeTracker {
  constructor() {
    this.currentChart = null;
    this.listingsData = [];
    this.processedData = [];
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.setupIntersectionObserver();
    this.addTypingAnimation();
  }

  setupEventListeners() {
    // Enter button click
    document.getElementById("enterButton").addEventListener("click", () => {
      this.handleSearchClick();
    });

    // Enter key on zip code input
    document.getElementById("zipCode").addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        this.handleSearchClick();
      }
    });

    // Input focus animations
    const zipInput = document.getElementById("zipCode");
    zipInput.addEventListener("focus", this.handleInputFocus.bind(this));
    zipInput.addEventListener("blur", this.handleInputBlur.bind(this));

    // Reset zoom button
    document.getElementById("resetZoom").addEventListener("click", () => {
      if (this.currentChart) {
        this.currentChart.resetZoom();
      }
    });

    // Toast close buttons
    document.querySelectorAll(".toast-close").forEach(btn => {
      btn.addEventListener("click", (e) => {
        this.hideToast(e.target.closest(".toast"));
      });
    });

    // Smooth scroll for scroll indicator
    document.querySelector(".scroll-indicator")?.addEventListener("click", () => {
      document.querySelector(".dashboard").scrollIntoView({
        behavior: "smooth"
      });
    });
  }

  setupIntersectionObserver() {
    const observerOptions = {
      threshold: 0.1,
      rootMargin: "0px 0px -50px 0px"
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("fade-in");
        }
      });
    }, observerOptions);

    // Observe dashboard sections
    document.querySelectorAll(".chart-section, .details-section").forEach(section => {
      observer.observe(section);
    });
  }

  addTypingAnimation() {
    const typingText = document.querySelector(".typing-text");
    if (typingText) {
      const phrases = [
        "Your Dream Home",
        "Market Insights",
        "Property Analytics", 
        "Real Estate Data"
      ];
      
      let currentPhrase = 0;
      let currentChar = 0;
      let isDeleting = false;
      
      const typeWriter = () => {
        const currentText = phrases[currentPhrase];
        
        if (isDeleting) {
          typingText.textContent = currentText.substring(0, currentChar - 1);
          currentChar--;
        } else {
          typingText.textContent = currentText.substring(0, currentChar + 1);
          currentChar++;
        }
        
        let typeSpeed = isDeleting ? 50 : 100;
        
        if (!isDeleting && currentChar === currentText.length) {
          typeSpeed = 2000;
          isDeleting = true;
        } else if (isDeleting && currentChar === 0) {
          isDeleting = false;
          currentPhrase = (currentPhrase + 1) % phrases.length;
          typeSpeed = 500;
        }
        
        setTimeout(typeWriter, typeSpeed);
      };
      
      setTimeout(typeWriter, 1000);
    }
  }

  handleInputFocus(e) {
    e.target.parentElement.classList.add("focused");
  }

  handleInputBlur(e) {
    e.target.parentElement.classList.remove("focused");
  }

  async handleSearchClick() {
    const zipCode = document.getElementById("zipCode").value.trim();
    if (!zipCode) {
      this.showToast("Please enter a valid ZIP code", "error");
      return;
    }

    // Validate ZIP code format
    if (!/^\d{5}(-\d{4})?$/.test(zipCode)) {
      this.showToast("Please enter a valid ZIP code format (e.g., 12345 or 12345-6789)", "error");
      return;
    }

    this.showLoading(true);
    this.clearPropertyDetails();

    try {
      const response = await fetch("/get_listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zipCode: zipCode }),
      });

      const data = await response.json();

      if (data.success) {
        this.listingsData = data.listings;
        this.processListingsData();
        this.createChart();
        this.updateStats();
        this.scrollToDashboard();
        this.showToast(`Successfully loaded ${data.totalListings} properties for ${zipCode}`, "success");
      } else {
        this.showToast(data.error || "Failed to fetch listings", "error");
      }
    } catch (error) {
      console.error("Error fetching listings:", error);
      this.showToast("Network error. Please check your connection and try again.", "error");
    } finally {
      this.showLoading(false);
    }
  }

  processListingsData() {
    // Extract and process data from Zillow listings
    this.processedData = this.listingsData.map((listing, index) => {
      // Handle different possible data structures from Zillow
      const beds = this.extractValue(listing, ['beds', 'bedrooms']) || 0;
      const baths = this.extractValue(listing, ['baths', 'bathrooms']) || 0;
      const price = this.extractValue(listing, ['unformattedPrice', 'price']) || 0;
      const area = this.extractValue(listing, ['area', 'livingArea', 'lotAreaValue']) || 0;
      const address = this.extractValue(listing, ['address', 'addressStreet']) || 'N/A';
      const detailUrl = this.extractValue(listing, ['detailUrl', 'hdpUrl']) || '#';
      const imgSrc = this.extractImageSrc(listing);

      return {
        beds: parseFloat(beds) || 0,
        baths: parseFloat(baths) || 0,
        price: parseFloat(price) || 0,
        area: parseFloat(area) || 0,
        address: address,
        detailUrl: detailUrl,
        imgSrc: imgSrc,
        hasImage: imgSrc !== null,
        originalIndex: index
      };
    }).filter(item => item.price > 0); // Filter out items with no price

    console.log(`Processed ${this.processedData.length} valid listings`);
  }

  extractValue(obj, keys) {
    for (const key of keys) {
      if (obj && obj[key] !== undefined && obj[key] !== null) {
        return obj[key];
      }
    }
    return null;
  }

  extractImageSrc(listing) {
    // Try multiple possible image source paths
    const imagePaths = [
      'imgSrc',
      'carouselPhotos.0.url',
      'photos.0.url',
      'primaryPhoto.url',
      'image.url'
    ];

    for (const path of imagePaths) {
      const value = this.getNestedValue(listing, path);
      if (value && value !== 'False') {
        return value;
      }
    }
    return null;
  }

  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : null;
    }, obj);
  }

  createChart() {
    const ctx = document.getElementById("chart_bedPrice");
    
    // Destroy existing chart if it exists
    if (this.currentChart) {
      this.currentChart.destroy();
    }

    // Create gradient for chart points
    const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(102, 126, 234, 0.8)');
    gradient.addColorStop(1, 'rgba(118, 75, 162, 0.8)');

    this.currentChart = new Chart(ctx, {
      type: "scatter",
      data: {
        datasets: [
          {
            label: "Properties",
            data: this.processedData.map((item, index) => ({
              x: item.beds,
              y: item.price,
              index: index // Store processed data index for click handling
            })),
            borderColor: '#667eea',
            backgroundColor: gradient,
            borderWidth: 2,
            pointRadius: 8,
            pointHoverRadius: 12,
            pointBorderWidth: 3,
            pointHoverBorderWidth: 4,
            pointBorderColor: '#ffffff',
            pointHoverBorderColor: '#ffffff',
            fill: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 1500,
          easing: 'easeInOutQuart'
        },
        legend: {
          display: false
        },
        scales: {
          yAxes: [{ 
            ticks: { 
              beginAtZero: true,
              callback: function(value) {
                return '$' + value.toLocaleString();
              },
              fontColor: '#4b5563',
              fontSize: 12,
              fontFamily: 'Inter, sans-serif'
            },
            scaleLabel: {
              display: true,
              labelString: 'Property Price',
              fontColor: '#374151',
              fontSize: 14,
              fontFamily: 'Inter, sans-serif',
              fontStyle: '600'
            },
            gridLines: {
              color: '#e5e7eb',
              zeroLineColor: '#d1d5db'
            }
          }],
          xAxes: [{ 
            ticks: { 
              beginAtZero: true,
              stepSize: 1,
              fontColor: '#4b5563',
              fontSize: 12,
              fontFamily: 'Inter, sans-serif'
            },
            scaleLabel: {
              display: true,
              labelString: 'Number of Bedrooms',
              fontColor: '#374151',
              fontSize: 14,
              fontFamily: 'Inter, sans-serif',
              fontStyle: '600'
            },
            gridLines: {
              color: '#e5e7eb',
              zeroLineColor: '#d1d5db'
            }
          }],
        },
        plugins: {
          zoom: {
            zoom: {
              enabled: true,
              mode: "xy",
              speed: 0.05,
            },
            pan: {
              enabled: true,
              mode: "xy"
            }
          },
        },
        onClick: (e, elements) => {
          if (elements.length > 0) {
            const elementIndex = elements[0]._index;
            const dataPoint = this.currentChart.data.datasets[0].data[elementIndex];
            const listingIndex = dataPoint.index;
            this.displayPropertyDetails(this.processedData[listingIndex]);
            
            // Add visual feedback
            this.highlightDataPoint(elementIndex);
          }
        },
        tooltips: {
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          titleFontColor: '#374151',
          titleFontFamily: 'Inter, sans-serif',
          titleFontStyle: '600',
          bodyFontColor: '#4b5563',
          bodyFontFamily: 'Inter, sans-serif',
          borderColor: '#e5e7eb',
          borderWidth: 1,
          cornerRadius: 8,
          displayColors: false,
          callbacks: {
            title: () => 'Property Details',
            label: (tooltipItem) => {
              const dataIndex = tooltipItem.index;
              const listing = this.processedData[dataIndex];
              return [
                `${listing.beds} beds, ${listing.baths} baths`,
                `Price: $${listing.price.toLocaleString()}`,
                `Area: ${listing.area.toLocaleString()} sq ft`,
                `Click to view more details`
              ];
            }
          }
        }
      },
    });
  }

  highlightDataPoint(index) {
    // Add a temporary highlight effect to the clicked data point
    const dataset = this.currentChart.data.datasets[0];
    const originalRadius = [...dataset.pointRadius];
    const originalBorderWidth = [...dataset.pointBorderWidth];
    
    dataset.pointRadius = dataset.pointRadius.map((radius, i) => i === index ? 15 : 8);
    dataset.pointBorderWidth = dataset.pointBorderWidth.map((width, i) => i === index ? 6 : 3);
    
    this.currentChart.update();
    
    // Reset after animation
    setTimeout(() => {
      dataset.pointRadius = originalRadius;
      dataset.pointBorderWidth = originalBorderWidth;
      this.currentChart.update();
    }, 1000);
  }

  displayPropertyDetails(listing) {
    // Update property info with enhanced styling
    document.getElementById("propertyInfo").innerHTML = `
      <div class="property-info">
        <h3><i class="fas fa-info-circle"></i> Property Information</h3>
        <p><strong>Address:</strong> ${listing.address}</p>
        <p><strong>Bedrooms:</strong> ${listing.beds}</p>
        <p><strong>Bathrooms:</strong> ${listing.baths}</p>
        <p><strong>Living Area:</strong> ${listing.area.toLocaleString()} sq ft</p>
        <p><strong>Price:</strong> $${listing.price.toLocaleString()}</p>
        <p><strong>Listing:</strong> 
          <a href="${listing.detailUrl}" target="_blank" rel="noopener">
            <i class="fas fa-external-link-alt"></i> View Full Details
          </a>
        </p>
      </div>
    `;

    // Update property image with enhanced styling
    if (listing.hasImage && listing.imgSrc) {
      document.getElementById("propertyPicture").innerHTML = `
        <div class="property-image-container">
          <h3><i class="fas fa-camera"></i> Property Image</h3>
          <img src="${listing.imgSrc}" 
              alt="Property at ${listing.address}"
              class="property-image"
              onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
          <div class="image-fallback" style="display: none;">
              <i class="fas fa-image-slash placeholder-icon"></i>
              <h3>Image Unavailable</h3>
              <p>The property image could not be loaded</p>
          </div>
          </div>
      `;
    } else {
      document.getElementById("propertyPicture").innerHTML = `
        <div class="card-placeholder">
          <i class="fas fa-image-slash placeholder-icon"></i>
          <h3>No Image Available</h3>
          <p>This property doesn't have an associated image</p>
        </div>
      `;
    }

    // Add fade-in animation to updated cards
    document.querySelectorAll('.detail-card').forEach(card => {
      card.classList.add('scale-in');
      setTimeout(() => card.classList.remove('scale-in'), 300);
    });
  }

  updateStats() {
    if (this.processedData.length === 0) return;

    const prices = this.processedData.map(item => item.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    document.getElementById('totalProperties').textContent = this.processedData.length;
    document.getElementById('priceRange').textContent = 
      `$${minPrice.toLocaleString()} - $${maxPrice.toLocaleString()}`;
  }

  clearPropertyDetails() {
    document.getElementById("propertyPicture").innerHTML = `
      <div class="card-placeholder">
        <i class="fas fa-image placeholder-icon"></i>
        <h3>Property Image</h3>
        <p>Select a property from the chart to view its image</p>
      </div>
    `;
    document.getElementById("propertyInfo").innerHTML = `
      <div class="card-placeholder">
        <i class="fas fa-info-circle placeholder-icon"></i>
        <h3>Property Information</h3>
        <p>Select a property from the chart to view detailed information</p>
      </div>
    `;
  }

  scrollToDashboard() {
    setTimeout(() => {
      document.querySelector(".dashboard").scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }, 500);
  }

  showLoading(show) {
    const loadingContainer = document.getElementById("loadingSpinner");
    const button = document.getElementById("enterButton");
    const btnText = button.querySelector(".btn-text");
    const btnIcon = button.querySelector(".btn-icon");
    
    if (show) {
      loadingContainer.style.display = "flex";
      button.disabled = true;
      btnText.textContent = "Analyzing...";
      btnIcon.className = "fas fa-spinner fa-spin btn-icon";
      button.classList.add("loading");
    } else {
      loadingContainer.style.display = "none";
      button.disabled = false;
      btnText.textContent = "Analyze Market";
      btnIcon.className = "fas fa-search btn-icon";
      button.classList.remove("loading");
    }
  }

  showToast(message, type = "success") {
    const toastId = type === "success" ? "successToast" : "errorToast";
    const messageId = type === "success" ? "toastMessage" : "errorToastMessage";
    const toast = document.getElementById(toastId);
    const messageElement = document.getElementById(messageId);
    
    messageElement.textContent = message;
    toast.classList.add("show");
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      this.hideToast(toast);
    }, 5000);
  }

  hideToast(toast) {
    toast.classList.remove("show");
  }
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
  new HomeTracker();
  
  // Add some additional polish effects
  setTimeout(() => {
    document.body.classList.add('loaded');
  }, 100);
});