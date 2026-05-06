if (window.jQuery) {
	(function ($) {
		$.fn.extend({
			blurjs: function (options) {
				this.defaultOptions = { customClass: 'blurjs', radius: 5, persist: false };
				function removeBlurs(_obj) {
					for (var i in window.blurJSClasses) {
						if (_obj.hasClass(window.blurJSClasses[i])) {
							_obj.removeClass(window.blurJSClasses[i]);
						}
					}
				}
				function singleSetting(obj, target) {
					if (target === 'remove') removeBlurs(obj);
				}
				function svg(amt) {
					if ($('#blurjs-' + amt).length != 0) { $('#blurjs-' + amt).remove(); }
					$('body').append('<svg id="blurjs-' + amt + '" style="display:none;"><filter id="blur' + amt + 'px"><feGaussianBlur in="SourceGraphic" stdDeviation="' + amt + '"></feGaussianBlur></filter></svg>');
				}
				function css(cssClass, amt) {
					svg(amt);
					return '<style type="text/css">.' + cssClass + '{-ms-filter:blur(' + amt + 'px);-webkit-filter:blur(' + amt + 'px);-moz-filter:blur(' + amt + 'px);-o-filter:blur(' + amt + 'px);filter: url("#blur' + (amt) + 'px");filter:progid:DXImageTransform.Microsoft.Blur(pixelradius=' + amt + ');}.' + cssClass + ' img{filter:progid:DXImageTransform.Microsoft.Blur(pixelradius=' + amt + ');}</style>';
				}
				if (typeof options == 'string') {
					singleSetting($(this), options);
					return;
				}
				var settings = $.extend({}, this.defaultOptions, options);
				if (typeof window.blurJSClasses == 'undefined') { window.blurJSClasses = []; }

				return this.each(function () {
					var $this = $(this), blurredClass = settings.customClass + '-' + settings.radius + '-radius';
					window.blurJSClasses.push(blurredClass);
					if (!settings.persist && $('head style:contains(' + settings.customClass + ')').length !== 0) {
						$('head style:contains(' + settings.customClass + ')').remove();
					}
					if ($('head style:contains(' + blurredClass + ')').length === 0) {
						var cssData = css(blurredClass, settings.radius);
						$(cssData).appendTo('head');
					}
					$this.addClass(blurredClass);
				});
			}
		});
		$.extend({
			blurjs: function (action) {
				if (action == 'reset') {
					for (var i in window.blurJSClasses) {
						$('.' + window.blurJSClasses[i]).removeClass(window.blurJSClasses[i]);
					}
				}
			}
		});

		var childwin;
		var tokenAcceso = '{{LLAVE_ENCRIPTADA}}';
		var baseUrl = '{{BASE_URL}}';
		var triggerClass = 'vda_' + Math.random().toString(36).substring(2, 10);

		function openEditorPopup() {
			var dataId = $("#unik_em_key").attr("data_id") || "";
			var finalUrl = baseUrl + "/acceso?t=" + encodeURIComponent(tokenAcceso) + (dataId ? "&id=" + encodeURIComponent(dataId) : "");
			console.log(finalUrl);

			var popupWidth = window.screen.availWidth ? window.screen.availWidth : 1280;
			var popupHeight = window.screen.availHeight ? window.screen.availHeight : 800;

			childwin = window.open(finalUrl, 'Popup', 'scrollbars=yes,resizable=yes,status=no,location=no,toolbar=no,menubar=no,width=' + popupWidth + ',height=' + popupHeight + ',left=0,top=0');

			var interval = setInterval(function () {
				if (childwin.closed !== false) {
					window.clearInterval(interval);
					$("#protector").remove();
					$.blurjs('reset');
					window.onscroll = function () { };
				} else {
					childwin.focus();
					if ($("#protector").length == 0) {
						$("<div/>", { 'id': 'protector', 'style': 'background-color: black; position:fixed; top:0; left:0; height:100%; width:100%; z-index:999999; opacity: 0.6;' }).appendTo('body');
					}
					window.onscroll = function () { };
				}
			}, 1000);

			var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
			var scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
			window.onscroll = function () { window.scrollTo(scrollLeft, scrollTop); };

			$('body').blurjs({
				customClass: 'blurjs',
				radius: 5,
				persist: false
			});
		}

		window.addEventListener('message', e => {
			if (e.data.function == "AccesoVideoOK") {
				console.log("Acceso concedido. App corriendo en ventana separada.");

				// Actualizamos el token con el que nos manda la app para futuras aperturas
				if (e.data.nuevo_token) {
					tokenAcceso = e.data.nuevo_token;
				}

				$("." + triggerClass).hide();

				// Leemos el contenedor dinámico desde el script tag usando jQuery
				var $scriptTag = $("#unik_em_key");
				var containerId = $scriptTag.length && $scriptTag.attr("data_btn") ? $scriptTag.attr("data_btn") : "editor_mascara";
				var $container = $("#" + containerId);

				// Construimos el botón en el contenedor con la URL correcta (SSO + Nuevo Nonce)
				if ($container.length) {
					$container.html('<button id="btn_reabrir_editor" class="boton" style="background:#10b981; color:white; padding:10px 20px; border:none; cursor:pointer; font-weight:bold; border-radius:4px;">Abrir Editor de Video</button>');

					$("#btn_reabrir_editor").off("click").on("click", function () {
						openEditorPopup();
					});
				} else {
					console.warn("Video API: No se encontró el contenedor con ID #" + containerId);
				}

			} else if (e.data.function == "Error") {
				alert('Error: ' + e.data.mensaje);
				$("#protector").remove();
				$.blurjs('reset');
				window.onscroll = function () { };
				if (childwin) childwin.close();

			} else if (e.data.function == "Cerrar") {
				$("#protector").remove();
				$.blurjs('reset');
				window.onscroll = function () { };
			}
		}, false);

		$(function () {
			var dynamicStyles = `
				.boton_bonito {
					transition: all 0.3s ease !important;
					box-shadow: 0 4px 6px rgba(0,0,0,0.1) !important;
					font-family: system-ui, -apple-system, sans-serif !important;
				}
				.boton_bonito:hover {
					transform: translateY(-2px) !important;
					box-shadow: 0 6px 12px rgba(0,0,0,0.15) !important;
					filter: brightness(1.1) !important;
				}
				.boton_bonito:active {
					transform: translateY(0) !important;
					box-shadow: 0 2px 4px rgba(0,0,0,0.1) !important;
				}
			`;
			$('<style>').text(dynamicStyles).appendTo('head');

			// Leemos configuración del script tag usando jQuery
			var $scriptTag = $("#unik_em_key");
			var containerId = $scriptTag.length && $scriptTag.attr("data_btn") ? $scriptTag.attr("data_btn") : "editor_mascara";
			var $container = $("#" + containerId);

			// Inyectamos el botón inicial si el contenedor existe y está vacío
			if ($container.length) {
				if ($container.find('.' + triggerClass).length === 0) {
					$container.html('<button class="boton_bonito ' + triggerClass + '" style="background:#032b66; color:white; padding:10px 20px; border:none; cursor:pointer; font-weight:bold; border-radius:4px;">Iniciar sesión Editor Video</button>');
				}
			} else {
				console.warn("Video API: No se encontró el contenedor HTML con ID #" + containerId + " para inyectar el botón de login.");
			}

			// Usamos delegación de eventos por si el botón se inyecta dinámicamente
			$(document).on("click", "." + triggerClass, function (e) {
				e.preventDefault();
				openEditorPopup();
			});
		});
	})(jQuery);
} else {
	console.error('Video API Error: jQuery no está definido.');
}
