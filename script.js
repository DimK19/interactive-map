const countries = document.querySelectorAll("#map svg path");
const selectedCountry = document.querySelector("#selectedCountry");

/*
// Testing code to find naming mismatches between data.js and world.svg
Object.keys(countryData).forEach(data => {
    let found = 0;
    countries.forEach(country => {
        const identifier = country.getAttribute("name") || country.id || country.getAttribute("class");
        if(data == identifier) {
            found = 1;
        }
    });
    
    if(found == 0) {
        console.log(`${data} not found.`);
    }
});
*/

// 0. Pre-fetch ALL YouTube data immediately in the background
Object.values(countryData).forEach(data => {
    if(data.yt_links && data.yt_links.length > 0) {
        // Create an array to hold the preloaded data
        data.fetchedVideos = new Array(data.yt_links.length).fill(null);
        
        data.yt_links.forEach((link, index) => {
            fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(link)}&format=json`)
                .then(res => res.json())
                .then(ytData => {
                    data.fetchedVideos[index] = { link, ytData };
                })
                .catch(err => {
                    console.error("Failed to preload:", link);
                });
        });
    }
});

// 1. Standardize identifiers and check against data.js
countries.forEach(country => {
    const identifier = country.getAttribute("name") || country.id || country.getAttribute("class");
    country.dataset.country = identifier;

    // Check if country exists AND has at least 1 link in the array
    if(typeof countryData !== 'undefined' && countryData[identifier]) {
        const links = countryData[identifier].yt_links;
        if(Array.isArray(links) && links.length > 0) {
            country.classList.add("available");
        }
    }
});

// Helper function to cleanly close the popup
function closePopup() {
    selectedCountry.style.display = "none";
    document.querySelectorAll("#map svg path.selected").forEach(p => {
        p.classList.remove("selected");
    });
}

// 2. Dismiss popup when clicking the ocean or an unavailable country
document.addEventListener("click", (e) => {
    if(!e.target.closest('path.available') && !e.target.closest('#selectedCountry')) {
        closePopup();
    }
});

countries.forEach(country => {
    // 3. Handle hovering
    country.addEventListener("mouseenter", () => {
        if(!country.classList.contains("available")) return;
        const target = country.dataset.country;
        document.querySelectorAll(`#map svg path[data-country="${target}"]`)
            .forEach(p => p.classList.add("hovered"));
    });

    country.addEventListener("mouseleave", () => {
        if(!country.classList.contains("available")) return;
        const target = country.dataset.country;
        document.querySelectorAll(`#map svg path[data-country="${target}"]`)
            .forEach(p => p.classList.remove("hovered"));
    });

    // 4. Handle clicks & Native Smooth Scroll Carousel (Synchronous)
    country.addEventListener("click", (e) => {
        if (!country.classList.contains("available")) return;
        
        const target = country.dataset.country;
        const data = countryData[target];
        const links = data.yt_links;
        
        document.querySelectorAll("#map svg path.selected").forEach(p => {
            p.classList.remove("selected");
        });
        document.querySelectorAll(`#map svg path[data-country="${target}"]`)
            .forEach(p => p.classList.add("selected"));

        const rect = country.getBoundingClientRect();
        const x = rect.left + rect.width / 2 + window.scrollX;
        let y;

        selectedCountry.classList.remove("popup-top", "popup-bottom");

        if(rect.top < 350) {
            y = rect.bottom + window.scrollY;
            selectedCountry.classList.add("popup-bottom");
        }
        else {
            y = rect.top + window.scrollY;
            selectedCountry.classList.add("popup-top");
        }

        const safeX = Math.max(180, Math.min(x, document.documentElement.clientWidth - 180));

        selectedCountry.style.left = `${safeX}px`;
        selectedCountry.style.top = `${y}px`;
        selectedCountry.style.display = "block";

        if(links.length > 1) {
            selectedCountry.classList.add("multi-video");
        }
        else {
            selectedCountry.classList.remove("multi-video");
        }

        // Generate the cards instantly from the preloaded data
        const cardsHtml = links.map((link, index) => {
            const v = data.fetchedVideos[index];
            
            // Fallback in the extremely rare case they click before the background fetch finishes
            if (!v || !v.ytData) {
                return `<div class="carousel-slide"><a href="${link}" target="_blank" class="fallback-link">Παρακολουθήστε το βίντεο</a></div>`;
            }
            
            return `
                <div class="carousel-slide">
                    <a href="${v.link}" target="_blank" class="video-card">
                        <img src="${v.ytData.thumbnail_url}" alt="Thumbnail" />
                        <div class="video-info">
                            <div class="video-title">${v.ytData.title}</div>
                            <div class="video-author">${v.ytData.author_name}</div>
                        </div>
                    </a>
                </div>
            `;
        }).join('');

        let carouselControls = "";
        let counterHtml = "";

        if(links.length > 1) {
            carouselControls = `
                <button class="carousel-arrow left-arrow" disabled>&#10094;</button>
                <button class="carousel-arrow right-arrow">&#10095;</button>
            `;
            counterHtml = `<div class="carousel-counter">Βίντεο 1 από ${links.length}</div>`;
        }

        // Inject everything instantly
        selectedCountry.innerHTML = `
            <button class="close-btn">&times;</button>
            <div class="country-name">${data.name_gr}</div>
            <div id="yt-card-container">
                <div class="carousel-container">
                    ${carouselControls}
                    <div class="carousel-track">
                        ${cardsHtml}
                    </div>
                </div>
                ${counterHtml}
            </div>
        `;

        selectedCountry.querySelector(".close-btn").addEventListener("click", closePopup);

        // Attach scrolling logic if there are multiple videos
        if(links.length > 1) {
            const ytContainer = document.getElementById("yt-card-container");
            const track = ytContainer.querySelector('.carousel-track');
            const btnLeft = ytContainer.querySelector('.left-arrow');
            const btnRight = ytContainer.querySelector('.right-arrow');
            const counter = ytContainer.querySelector('.carousel-counter');

            // Update arrows and counter based on scroll position
            track.addEventListener('scroll', () => {
                const index = Math.round(track.scrollLeft / track.clientWidth);
                btnLeft.disabled = index === 0;
                btnRight.disabled = index === links.length - 1;
                counter.textContent = `Βίντεο ${index + 1} από ${links.length}`;
            });

            btnLeft.addEventListener('click', (e) => {
                e.stopPropagation();
                track.scrollBy({ left: -track.clientWidth, behavior: 'smooth' });
            });

            btnRight.addEventListener('click', (e) => {
                e.stopPropagation();
                track.scrollBy({ left: track.clientWidth, behavior: 'smooth' });
            });
        }
    });
});
