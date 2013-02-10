(function($){
$.fn.epochago = function(options) {

	var defaults = {
	};
	var options = $.extend(defaults, options);

	return this.each(function() {

		obj = $(this);
		if (obj.attr('title') != undefined) {
			var body = obj.attr('title');
		} else {
			var body = obj.html();
			obj.attr('title', obj.html());
		}

		var ts = Math.round((new Date()).getTime() / 1000);
		var seconds = ts - body;
		var minutes = seconds / 60;
		var hours = minutes / 60;
		var days = hours / 24;
		var years = days / 365;

		var str = '';

		function pStr(count, period) {
			count = Math.round(count);
			if (count > 1) {
				return 'about '+count+' '+period+'s ago';
			} else {
				return 'about '+count+' '+period+' ago';
			}
		}

		if (years >= 1) {
			str = pStr(years, 'year');
		} else if (days >= 1) {
			str = pStr(days, 'day');
		} else if (hours >= 1) {
			str = pStr(hours, 'hour');
		} else if (minutes >= 1) {
			str = pStr(minutes, 'minute');
		} else {
			str = pStr(seconds, 'second');
		}

		obj.html(str);

	});
};
})(jQuery);

