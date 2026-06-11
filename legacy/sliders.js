$(document).ready(function() {
						$("#open-popup").on("click", function() {
							$("#popup-container").show();
							createRangeSlider();
							createChartsSlider();
						});

						$("#close-popup").on("click", function() {
							$("#popup-container").hide();
						});

						$(document).on("click", function(event) {
							if ($(event.target).is("#popup-container")) {
								$("#popup-container").hide();
							}
						});

						function createRangeSlider() {
							var fpValue = parseFloat($("#fp").val());
							var offset = 2;
							var sliderValues = [fpValue - offset, fpValue + offset];

							var minSliderValue = (fpValue < 10) ? 0 : fpValue - offset;
							var maxSliderValue = (fpValue < 10) ? 10 + fpValue : fpValue + offset;

							var sliderOptions = {
								range: true,
								min: minSliderValue,
								max: maxSliderValue,
								step: 0.1,
								values: sliderValues,
								slide: function(event, ui) {
									var selectedRange = ui.values[0] + " to " + ui.values[1];
									$("#ep").val(selectedRange);
									$("#range-slider .ui-slider-handle").eq(0).attr("data-value", ui.values[0]);
									$("#range-slider .ui-slider-handle").eq(1).attr("data-value", ui.values[1]);
								}
							};

							$("#range-slider").slider(sliderOptions);
							$("#range-slider .ui-slider-handle").each(function(index) {
								$(this).attr("data-value", sliderOptions.values[index]);
							});

							$("#fp").on("input", function() {
								var fpValue = parseFloat($(this).val());
								var sliderValues = [fpValue - offset, fpValue + offset];

								var minSliderValue = (fpValue < 10) ? 0 : fpValue - offset;
								var maxSliderValue = (fpValue < 10) ? 10 + fpValue : fpValue + offset;

								$("#range-slider").slider("option", {
									min: minSliderValue,
									max: maxSliderValue,
									values: sliderValues
								});

								var selectedRange = sliderValues[0] + " to " + sliderValues[1];
								$("#ep").val(selectedRange);

								updateSliderLabels(minSliderValue, maxSliderValue);
							});

							$("#fp").trigger("input");
						}

						function updateSliderLabels(minValue, maxValue) {
							var labels = $(".slider-labels span");

							labels.eq(0).text(minValue);
							labels.eq(1).text(minValue + (maxValue - minValue) * 0.25);
							labels.eq(2).text(minValue + (maxValue - minValue) * 0.5);
							labels.eq(3).text(minValue + (maxValue - minValue) * 0.75);
							labels.eq(4).text(maxValue);
						}


						function createChartsSlider() {
							var sliderOptions = {
								range: true,
								min: 0,
								max: 100,
								values: [40, 80],
								slide: function(event, ui) {
									var selectedRange = " RSI is above " + ui.values[0] + " and below " + ui.values[1] + ". ";
									
									if (ui.values[1] >= 0 && ui.values[1] < 25) {
										selectedRange += "Perfect Entry !!!";
									} else if (ui.values[1] >= 25 && ui.values[1] < 50) {
										selectedRange += "Good Entry !!!";
									} else if (ui.values[1] >= 50 && ui.values[1] < 75) {
										selectedRange += "Medium Entry !!!";
									} else if (ui.values[1] >= 75 && ui.values[1] <= 100) {
										selectedRange += "Bad Entry !!!";
									}


									$("#range-slider-charts .ui-slider-handle").eq(0).attr("data-value", ui.values[0]);
									$("#range-slider-charts .ui-slider-handle").eq(1).attr("data-value", ui.values[1]);
									$("#charts").val(selectedRange);
								}
							};

							$("#range-slider-charts").slider(sliderOptions);
							$("#range-slider-charts .ui-slider-handle").each(function(index) {
								$(this).attr("data-value", sliderOptions.values[index]);
							});
						}

						createRangeSlider();
						createChartsSlider();
					});
