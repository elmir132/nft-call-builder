// SOL AND VOLUME API

		   fetch('https://api-mainnet.magiceden.io/volumes')
		  .then(response => response.json())
		  .then(data => {
		    const volumeData = data.last24Hrs;

		    const solVolumeContainer = document.getElementById('sol-volume');
		    solVolumeContainer.textContent = `Volume 24h: ${volumeData}`;
		  })


		  .catch(error => console.error(error));


	     fetch('https://price.jup.ag/v1/price?id=sol')
      .then(response => response.json())
      .then(data => {
        const solPriceElement = document.getElementById('sol-price');
        const solPrice = data.data.price;
        solPriceElement.textContent = `Sol: ${solPrice}`;
      })
      .catch(error => console.error(error));

	// SOL AND VOLUME API