/*
 * LikeLines
 * Copyright (c) 2011 R. Vliegendhart <ShinNoNoir@gmail.com>
 * 
 * Licensed under the MIT license:
 * 
 * Permission is hereby granted, free of charge, to any person obtaining 
 * a copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation 
 * the rights to use, copy, modify, merge, publish, distribute, sublicense, 
 * and/or sell copies of the Software, and to permit persons to whom the 
 * Software is furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR 
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, 
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER 
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING 
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

LikeLines = {};

// YouTube
(function(LikeLines){
	var WIDTH = 425,
	    HEIGHT = 356;
	
	LikeLines.YouTube = {
		
		STATE_UNSTARTED: -1,
		STATE_ENDED: 0,
		STATE_PLAYING: 1,
		STATE_PAUSED: 2,
		STATE_BUFFERING: 3,
		STATE_VIDEO_CUED: 5,
		
		embed: function(div_id, video_id, player_id, width, height, callback) {
			var url_query = '?' + $.param({
				enablejsapi: 1,
				version: 3,
				playerapiid: player_id
			});
			
			var swf_params = {
				allowScriptAccess: "always",
				allowFullScreen: true
			};
			var swf_atts = { id: player_id };
			
			if (!width || !height) {
				width = WIDTH;
				height = HEIGHT;
			}
			
			var self = this;
			var wrapped_callback = function (e) {
				self.registered_players[player_id] = {
					ready: false,
					llplayer: null,
					video_id: video_id
				};
				callback(e);
			};
			swfobject.embedSWF("http://www.youtube.com/v/" + video_id + url_query,
		                       div_id, width, height, "8", null, null, swf_params, swf_atts,
			                   wrapped_callback);
		},
		
		
		getMetadata: function(video_id, callback) {
			$.getJSON('http://gdata.youtube.com/feeds/api/videos/' +
			          video_id + '?v=2&alt=jsonc&prettyprint=true&callback=?',
					  callback);
		},
		
		
		getDuration: function(video_id, callback) {
			this.getMetadata(video_id, function(json) {
				if ('error' in json) {
					callback(-1);
				}
				else {
					callback(json.data.duration);
				}
			});
		},
		
		onStateChange: function(player_id, newstate) {
			this.registered_players[player_id].llplayer.onStateChange(newstate);
			console.log('Player ' + player_id + ', Newstate ' + newstate);
		},
		
		registered_players: []
	};
	
})(LikeLines);


// GUI
(function(LikeLines){
	
	LikeLines.Player = function(player_node, player_id) {
		this.player_node = player_node;
		this.player_id = player_id;
		this.video_node = document.getElementById(player_id);
		this.duration = -1;
		this.likes = [];
		
		// For now, assume YouTube:
		this.cur_video_id = LikeLines.YouTube.registered_players[player_id].video_id;
		if (LikeLines.YouTube.registered_players[player_id].ready) {
			this.onReady();
		}
	};
	
	// For now, assume YouTube video player:
	LikeLines.Player.prototype.playVideo = function() {
		this.video_node.playVideo();
	};
	LikeLines.Player.prototype.pauseVideo = function() {
		this.video_node.pauseVideo();
	};
	LikeLines.Player.prototype.stopVideo = function() {
		this.video_node.stopVideo();
	};
	LikeLines.Player.prototype.seekTo = function(seconds, allowSeekAhead) {
		this.video_node.seekTo(seconds, allowSeekAhead);
	};
	LikeLines.Player.prototype.getPlayerState = function() {
		return this.video_node.getPlayerState();
	};
	LikeLines.Player.prototype.getCurrentTime = function() {
		return this.video_node.getCurrentTime();
	};
	LikeLines.Player.prototype.getDuration = function(callback) {
		if (callback) {
			if (this.duration != -1) {
				callback(duration);
			}
			else {
				var self = this;
				LikeLines.YouTube.getDuration(this.cur_video_id, function(duration) {
					self.duration = duration;
					callback(duration);
				});
			}
		}
		else {
			return this.duration;
		}
	};
	LikeLines.Player.prototype.loadVideoById = function(video_id) {
		var self = this;
		this.cur_video_id = video_id;
		this.duration = -1;
		this.clearLikes();
		this.video_node.loadVideoById(video_id);
		this.getDuration(function(duration) {
			self.paintHeatmap();
		});
	};
	
	// NOTE: basically recreates the player
	LikeLines.attachGUI = function(video_node) {
		var llplayer_node, llcontrols, heatmap, likebutton, player_id, llplayer;
		
		video_node = $(video_node);
		video_node.addClass('LikeLines video');
		
		llplayer_node = video_node.wrap('<div></div>').parent();
		llplayer_node.addClass('LikeLines player');
		
		llcontrols = $(document.createElement('div'));
		llcontrols.appendTo(llplayer_node);
		llcontrols.addClass('LikeLines controls');
		
		heatmap = $(document.createElement('div'));
		heatmap.addClass('LikeLines heatmap');
		heatmap.appendTo(llcontrols);
		
		markers = $(document.createElement('div'));
		markers.addClass('LikeLines markersbar');
		markers.appendTo(llcontrols);
		
		likebutton = $('<button>Like</button>');
		likebutton.addClass('LikeLines like');
		likebutton.appendTo(llcontrols);
		
		player_id = video_node.prop('id');
		llplayer = new LikeLines.Player(llplayer_node.get(0), player_id);
		LikeLines.YouTube.registered_players[player_id].llplayer = llplayer;
		return llplayer;
	};
	
	LikeLines.Player.prototype.onReady = function () {
		// For now, assume YouTube video player:
		var self = this;
		this.getDuration(function(duration) {
			self.paintHeatmap();
		});
		
		var heatmap_node = $(this.player_node).find('.heatmap');
		
		heatmap_node.click(function(e) {
			self.onHeatmapClick(e, this);
		});
		heatmap_node.mousedown(function(e) {
			var heatmap = this;
			var drag_handler = function(e) {
				self.onHeatmapDrag(e, heatmap);
				heatmap.blur();
				e.preventDefault();
				return false;
			};
			$(window).mousemove(drag_handler);
			var mouseup_handler = function(e) {
				$(this).unbind('mousemove', drag_handler);
				$(this).unbind('mouseup', mouseup_handler);
				
				$(heatmap_node).get(0).blur();
				e.preventDefault();
				return false;
			};
			$(window).mouseup(mouseup_handler);
			
			heatmap.blur();
			e.preventDefault();
			return false;
		});
		
		var likebutton = $(this.player_node).find('.like');
		likebutton.click(function(e) {
			self.onLike(self.getPlayerState(), self.getCurrentTime());
		});
	};
	
	LikeLines.Player.prototype.onStateChange = function(newstate) {
		console.log('llplayer Newstate ' + newstate + ' @ ' + this.getCurrentTime());
	};
	
	LikeLines.Player.prototype.onLike = function(state, playback_position) {
		var self = this;
		if (state == LikeLines.YouTube.STATE_UNSTARTED || $.inArray(playback_position, this.likes) != -1) {
			return;
		}
		
		this.likes.push(playback_position);
		var markersbar = $(this.player_node).find('.markersbar');
		var marker = $('<div></div>').addClass('marker').appendTo(markersbar);
		
		var w = markersbar.outerWidth();
		var d = this.getDuration();
		var x = playback_position*w/d - marker.outerWidth()/2; 
		
		marker.css('left', x);
		marker.click(function (e) {
			self.seekTo(playback_position, true);
		});
	};
	
	LikeLines.Player.prototype.clearLikes = function() {
		this.likes = [];
		var markersbar = $(this.player_node).find('.markersbar').empty();
	};
	
	
	LikeLines.Player.prototype.onHeatmapClick = function(e, heatmap) {
		var x = e.pageX - $(heatmap).offset().left;
		var w = $(heatmap).outerWidth();
		var d = this.getDuration();
		if (d != -1) {
			this.seekTo(x*d/w, true);
		}
	};
	LikeLines.Player.prototype.onHeatmapDrag = function(e, heatmap) {
		// TODO: perhaps introduce throttling?
		var x = e.pageX - $(heatmap).offset().left;
		
		var w = $(heatmap).outerWidth();
		if (x < 0) {
			x = 0;
		}
		else if (x >= w) {
			x = w-1;
		}
		var d = this.getDuration();
		if (d != -1) {
			this.seekTo(x*d/w, true);
		}
	};
	
	LikeLines.Player.prototype.getHeatmap = function() {
		return static_heatmaps[this.cur_video_id] || {points: [], widths: [], weights:[]};
	};
	
	LikeLines.Player.prototype.paintHeatmap = function() {
		var duration = this.getDuration();
		if (duration == -1) { return; }
		var heatmap = this.getHeatmap();
		var heatmap_node = $(this.player_node).find('.heatmap');
		
		var stops = generateHeatmapStops(heatmap, duration);
		var num_stops = stops.length;
		
		// stops_format1: color pos%
		var stops_format1 = [];
		for (var i=0; i < num_stops; i++) {
			stops_format1[i] = stops[i].color + ' ' + stops[i].pct + '%';
		}
		stops_format1 = stops_format1.join(', ');
		
		// stops_format2: color-stop(pos%,color)
		var stops_format2 = [];
		for (i=0; i < num_stops; i++) {
			stops_format2[i] = 'color-stop(' + stops[i].pct + '%, ' + stops[i].color + ')';
		}
		stops_format2 = stops_format2.join(', ');
		
		heatmap_node = $(heatmap_node);
		/* old browsers */
		heatmap_node.css('background', 'white');
		/* FF3.6+ */
		heatmap_node.css('background', '-moz-linear-gradient(left, ' + stops_format1 + ')');
		/* Chrome,Safari4+ */
		heatmap_node.css('background', '-webkit-gradient(linear, left top, right top, ' + stops_format2 + ')');
		/* Chrome10+,Safari5.1+ */
		heatmap_node.css('-webkit-linear-gradient(left, ' + stops_format1 + ')');
		/* Opera11.10+ */
		heatmap_node.css('background', '-o-linear-gradient(left, ' + stops_format1 + ')');
		/* IE10+ */
		heatmap_node.css('-ms-linear-gradient(left, ' + stops_format1 + ')');
		/* W3C */
		heatmap_node.css('linear-gradient(left, ' + stops_format1 + ')');
	};
	
	// TODO: move this old function into LikeLines.Player and update:
	LikeLines.detachGUI = function(player_node){
		player_node = $(player_node);
		var llplayer = player_node.parents('.LikeLines.player:first');
		player_node.detach();
		player_node.insertAfter(llplayer);
		llplayer.remove();
	};
	
	
	function generateHeatmapStops(heatmap, duration) {
		/* 3 different hotspot-types in this prototype */
		var colors = ['white', 'yellow', 'orange', 'red'];
		var stops = [{pct: 0, color: colors[0]}];
		
		var num_points = heatmap.points.length;
		
		for (var i=0; i < num_points; i++) {
			var intensity = heatmap.weights[i];
			var cur_stops = [
				{
					pct: (heatmap.points[i] - heatmap.widths[i][0]) * 100 / duration,
					color: colors[0]
				},
				// {optional additional stop},
				{
					pct: heatmap.points[i]*100/duration, 
					color: undefined
				},
				// {optional additional stop},
				{
					pct: (heatmap.points[i] + heatmap.widths[i][1]) * 100 / duration,
					color: colors[0]
				}
			];
			
			// center color = intensity
			cur_stops[1].color = colors[intensity];
			
			// add two additional stops when highest intensity
			if (intensity == 3) {
				cur_stops.splice(1, 0, {
					pct: (cur_stops[0].pct+cur_stops[1].pct) / 2,
					color: colors[1]
				});
				cur_stops.splice(3, 0, {
					pct: (cur_stops[2].pct+cur_stops[3].pct) / 2,
					color: colors[1]
				});
				
				// duplicate the center stop
				cur_stops.splice(2, 0, {
					pct: cur_stops[2].pct,
					color: cur_stops[2].color
				});
				var diff = cur_stops[2].pct - cur_stops[1].pct;
				cur_stops[2].pct -= (diff/10);
				cur_stops[3].pct += (diff/10);
			}
			
			stops.push.apply(stops, cur_stops);
		}
		
		stops.push(stops[0]);
		return stops;
	}
})(LikeLines);




// Static methods
function onYouTubePlayerReady(player_id) {
	console.log('onYouTubePlayerReady: ' + player_id);
	var registered_players = LikeLines.YouTube.registered_players;
	
	if (player_id in registered_players) { 
		registered_players[player_id].ready = true;
		if (registered_players[player_id].llplayer) {
			registered_players[player_id].llplayer.onReady();
		}
	}
	
	document.getElementById(player_id).addEventListener('onStateChange', 
		'(function(state){LikeLines.YouTube.onStateChange("' + player_id + '", state);})');
}


/* This prototype uses static heatmaps, not dynamicly generated ones based on user interaction */
var static_heatmaps = {
	'wPTilA0XxYE': {
		points: [21, 38, 67, 120], // Required to be sorted!
		widths: [[2, 6], [2, 10], [3, 6], [3, 6]],
		weights: [2, 1, 3, 3]
	},
	'Jd3-eiid-Uw': {
		points: [149,165,215,230],
		widths: [[1,15],[0,20],[5,10],[2,15]],
		weights: [1,2,2,3]
	},
	'_DeQUW-bFZ0' : {
		points: [0,130,218,624],
		widths: [[0,130],[5,80],[10,40],[2,10]],
		weights: [2,3,3,1]
	},
	// FOR RECORDING PURPOSES:
	'piFtq4wYid0' : {
		points: [35,78],
		widths: [[2,15],[3,30]],
		weights: [3,1]
	}
};

// For recording purposes, fake evolution of heatmaps:
threeStepsAnimation = (function () {
	var timed_static_heatmaps = [{}, {}, {}, {}];
	$.each(static_heatmaps, function(video_id) {
		var heatmap = static_heatmaps[video_id];
		var num_points = heatmap.points.length;
		
		for (var t=0; t <= 3; t++) {
			var new_heatmap = {
				points: [],
				widths: [],
				weights: []
			};
			
			for (var i=0; i < num_points; i++) {
				if (heatmap.weights[i] > (3-t)) {
					var w1, w2;
					w1 = heatmap.widths[i][0] / 4 * (t+1);
					w2 = heatmap.widths[i][1] / 4 * (t+1);
					
					new_heatmap.points.push(heatmap.points[i]);
					new_heatmap.widths.push([w1,w2]);
					new_heatmap.weights.push(heatmap.weights[i] - 3 + t);
				}
			}
			
			timed_static_heatmaps[t][video_id] = new_heatmap;
		}
	});
	
	return function(t) {
		static_heatmaps = timed_static_heatmaps[t];
		return static_heatmaps;
	};
})();

