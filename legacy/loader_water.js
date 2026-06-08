// Hide the loader and show the page content
    function showPage() {
      $('body').removeClass('loading'); // Remove the "loading" class from body
    }

    // Wait for the page to fully load
    $(window).on('load', function() {
      showPage();
    });