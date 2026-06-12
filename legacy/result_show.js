		// Get the form element and add a submit event listener
		const form = document.querySelector('form');
		form.addEventListener('submit', (event) => {
  // Prevent the default form submission behavior
		  event.preventDefault();

		  // Get the form input values
		  const name = document.querySelector('#name').value;
		  const fp = document.querySelector('#fp').value;
		  const listed = document.querySelector('#listed').value;
		  const ep = document.querySelector('#ep').value;
		  const risks = document.querySelector('#risks').value;
		  const description = document.querySelector('#description').value;
		  const charts = document.querySelector('#charts').value;
		  const links = document.querySelector('#links').value;
		  // Get the checked checkboxes
		  const checkbox = document.querySelectorAll('input[type="checkbox"]:checked');
		  const rsi = Array.from(checkbox).map((checkbox) => checkbox.value).join(', ');

		  // Get the selected emoji
		  const rocketEmoji = document.querySelector('#rocket-emoji');
		  const recycleEmoji = document.querySelector('#recycle-emoji');
		  const emoji = rocketEmoji.classList.contains('selected') ? 'Rocket 🚀' : 'Re-invest ♻️';
		  const emoji1 = rocketEmoji.classList.contains('selected') ? '🚀' : '♻️';


		  // Display the input values in the result section
		  document.querySelector('#result-name').textContent = name;
		  document.querySelector('#result-fp').textContent = fp;
		  document.querySelector('#result-listed').textContent = listed;
		  document.querySelector('#result-ep').textContent = ep;
		  document.querySelector('#result-risks').textContent = risks;
		  document.querySelector('#result-description').textContent = description;
		  document.querySelector('#result-charts').textContent = charts;
		  document.querySelector('#result-emoji').textContent = emoji; // Add emoji value to the result
		  document.querySelector('#result-emoji1').textContent = emoji1; // Add emoji value to the result
		  document.querySelector('#result-rsi').textContent = rsi;
		  document.querySelector('#result-links').textContent = links;
		});

		// Add event listeners for emoji selection
		const rocketEmoji = document.querySelector('#rocket-emoji');
		const recycleEmoji = document.querySelector('#recycle-emoji');

		rocketEmoji.addEventListener('click', () => {
			rocketEmoji.classList.add('selected');
			recycleEmoji.classList.remove('selected');
		});

		recycleEmoji.addEventListener('click', () => {
			recycleEmoji.classList.add('selected');
			rocketEmoji.classList.remove('selected');
		});



		function debounce(func, delay) {
			let timeoutId;

			return function () {
				const context = this;
				const args = arguments;

				clearTimeout(timeoutId);
				timeoutId = setTimeout(function () {
					func.apply(context, args);
				}, delay);
			};
		}

