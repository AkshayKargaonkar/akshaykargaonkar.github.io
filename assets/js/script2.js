window.addEventListener("DOMContentLoaded", function () {
    const animatedImage = document.getElementById("animated-faucethead");
    const designImage = document.querySelector(".design-faucethead");
    const container = document.querySelector(".design-container");
    const totalFrames = 180; // Adjust to match your total number of frames
    const scrollLimit = 1000; // Unified scroll limit for both frame change and position change
    const minScroll = 100;
  
    // Capture the initial position of the image when the page loads
    const initialPosition = designImage.offsetTop;
    let lastRecordedPosition = initialPosition;
  
    window.addEventListener("scroll", function () {
        const scrollTop = window.scrollY;
        const containerRect = container.getBoundingClientRect();
  
        // Apply sticky positioning to the design image, not the animated image
        if (scrollTop <= minScroll) {
            // Before reaching initial position, reset design image to default
            designImage.style.position = "relative";
            designImage.style.top = "0px";
          
        } else if (scrollTop > minScroll && scrollTop <= scrollLimit) {
            // When within range, fix the design image in place
            designImage.style.position = "sticky";
            designImage.style.top = "0px";
            lastRecordedPosition = designImage.offsetTop;
            
        } else {
            // After scrollLimit, let the design image scroll naturally again
            designImage.style.position = "relative";
            designImage.style.top = `${lastRecordedPosition}px`
        }
  
        // Frame change logic for animated image
        if (scrollTop >= minScroll && scrollTop <= scrollLimit) {
            const frameIndex = Math.min(
                totalFrames - 1,
                Math.floor(((scrollTop - minScroll) / (scrollLimit - minScroll)) * totalFrames)
            );
            const frameNumber = String(frameIndex + 1).padStart(4, '0'); // Ensures 4-digit format
            animatedImage.src = `./faucethead/${frameNumber}.webp`;
        }
    });
  });
  