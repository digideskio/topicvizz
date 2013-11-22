(function($){
	"use strict";

	var vizsvg;
	var force;
	var collector_sidebar_open = false;
	var info_box_open = false;
	var current_info_data = null;
	
	var info_collection = [];

	var graph = {
	  "nodes":[],
	  "links":[]
	};


	$.getJSON('./data/topics.json', function(json) {
		$.each(json, function(i, v) {
			graph.nodes.push(v);
			
			$.each(v.edges, function(sub_i, sub_v) {
				graph.links.push({source: parseInt(v.id) - 1, target: parseInt(sub_v.neighbour) - 1, weight: sub_v.weight});
			});
		});
	});
	

	function initGraph(vis) {
		
		//var color = d3.scale.category20();
		
		var height = $(window).height(),
			width = $(window).width();
		
		vizsvg.style.height = height + "px";
		vizsvg.style.width = width + "px";
		
		force = d3.layout.force()
		    .nodes(graph.nodes)
		    .links(graph.links)
		    .charge(-100)
		    .gravity(0.01)
		    .linkStrength(0.2)
		    .linkDistance(function(link) {
		    	return 500 * (1-link.weight);
		    })
		    .size([width,height])
		    .start();
		    
		    
			var link = vis.selectAll(".link")
				.data(graph.links)
				.enter().append("line")
				.attr("class", "link")
				.style("stroke-width", function(d) { return Math.sqrt(d.value); })
				.style("stroke", function(d) {
				
					return "rgb(255, 255, 255)";
				
				});

			var node = vis.selectAll(".node")
				.data(graph.nodes)
				.enter().append('g')
				.attr("class", "node");
				
				
				node.append("circle")
				.attr("r", 30)
				.style("fill", function(d) {
					//return d.color;
					return "#729FCF";
				})
				.on('dblclick', function(d, i) {
					if(d.topic) {
						
						var circle = d3.select(this);
						var g = $($(this).parent()).detach();
						$("#graph_viz").append(g);

						var top_text = $(this).parent().find("text");
						
						if(d.open) {
							d.open = false;
							top_text.fadeIn();
							circle.transition().attr("r", d.width).style("stroke", "transparent");
							
							force.charge(-100);
							force.start();
						}
						else {
							d.open = true;
							top_text.fadeOut();
							circle.transition().attr("r", 150).style("stroke", "rgba(255, 255, 255, 0.4)");
							
							force.charge(function(d) {
								return (d.open) ? -700: -100;
							});
							force.start();
						}
					
					}
				});
				/*
				.on('dblclick', function(d, i) {
					if(d.topic) {
						
						if(!info_box_open) {
							info_box_open = true;
							
							var info_box = $('#info_box');
							
							current_info_data = d;
						
							info_box.find(".head h2").html(current_info_data.topic);
						
							if(current_info_data.desc)
								info_box.find(".body").html(current_info_data.desc);
						
							info_box
							.css({
								opacity: 0.0,
								display: 'block'
							})
							.animate({
								opacity: 1.0,
								width: '500px',
								height: '400px',
								marginLeft: '-250px',
								marginTop: '-200px'
							}, 300);
						}
					}
				});
				*/
				
				node.append('text')
				.attr("fill", "rgb(255, 255, 255)")
				.attr("pointer-events", "none")
				.attr("y", 5)
				.html(function(d, i) {
					return d.topic;
				}).attr("text-anchor", function(d) {
					
					var width = this.getBBox().width / 2 + 10;
					
					$(this).parent().find("circle").attr("r", width);
					d.width = width;
				
					return "middle";
				});
				
				node.call(force.drag);
			
			force.on("tick", function() {
				link.attr("x1", function(d) { return d.source.x; })
					.attr("y1", function(d) { return d.source.y; })
					.attr("x2", function(d) { return d.target.x; })
					.attr("y2", function(d) { return d.target.y; });
				
				node.attr("transform", function(d, i) {
					return "translate(" + d.x + ", " + d.y + ")";
				});
			  });
	}

	

	$(document).ready(function(){
		
		vizsvg = document.querySelector('#graph_viz');
		
		var vis = d3.select(vizsvg);
		
		initGraph(vis);
		
		//vis.addAttribute('viewBox', '0 0');
		
		

		var filter_sidebar_node = $("#filter_sidebar");
			/*
			time_topbar_node = $("#time_topbar"),
			collector_sidebar_node = $('#collector_sidebar');
			*/
		var filter_sidebar_title_node = filter_sidebar_node.find(".title span");
			/*
			time_topbar_title_node = time_topbar_node.find(".title span");
			*/

		var filter_sidebar_timeout = null;
			/*
			time_topbar_timeout = null,
			collector_sidebar_timeout = null;
			*/

		/*
		var left_handle_value_node = time_topbar_node.find(".left_handle_value"),
			right_handle_value_node = time_topbar_node.find(".right_handle_value");
		*/



		// ### Filter Sidebar ###
		filter_sidebar_node.bind("mouseenter", function() {
			
			// cancel the start of the close animation
			if(filter_sidebar_timeout !== null) {
				clearTimeout(filter_sidebar_timeout);
				filter_sidebar_timeout = null;
			}
		
			setTimeout(function() {
				filter_sidebar_node.stop().animate({right: "0px"}, 300);	
				filter_sidebar_title_node.stop().fadeOut(300);
			}, 250);
			
		})
		.bind("mouseleave", function() {

				filter_sidebar_node.stop();	
				filter_sidebar_title_node.stop();			
				
				filter_sidebar_timeout = setTimeout(function() {
					filter_sidebar_node.stop().animate({right: "-265px"}, 300);
					filter_sidebar_title_node.stop().fadeIn(300);
				}, 400);
		});
		
		
		
		/*
		
		// add to collection
		function add_to_collection(info_data) {
			
			var color = (info_data.color) ?  info_data.color: 'rgb(25, 137, 224)';
			
			var collection_sidebar_con = $('#collector_sidebar .content');
		
			var new_item = $('<div class="item"></div>').hide();
			var new_item_placeholder = $('<div class="placeholder"></div>')
				.click(function() {

					new_item.animate({opacity: 0.0, height: 0}, 300, function() {
						$(this).remove();
					
						for(var i = 0; i < info_collection.length; i++) {
							if(info_collection[i] === info_data) {
								info_collection.splice(i, 1);
								
								if(info_collection.length == 0) {
									$('#collector_sidebar').stop().animate({left: "-75px"}, 300);
								}
							
								return;
							}
						}
					});
				});
			
			var new_item_colorarea = $('<div class="colorarea"></div>').css({background: color})
				.hover(function(){
					//console.log('in');
				},
				function(){
					//console.log('out');
				});
			
			new_item.append(new_item_placeholder);
			new_item.append(new_item_colorarea);
			collection_sidebar_con.append(new_item);
			
			
			var sidepopup = $("#sidepopup");
			
			collection_sidebar_con.mousemove(function(e) {
				
				if(!collector_sidebar_open)
					return;
				
				var w_height = $(window).height();
				
				var n_left = e.pageX + 60;
				var n_top = e.pageY;
				
				if((n_top + 400 + 100) > w_height) {
					n_top = n_top - (n_top + 400 + 100 - w_height)
				}
				
				sidepopup.css({
					left: n_left,
					top: n_top
				})
			});
			
			new_item_colorarea.mouseenter(function() {
				
				if(!collector_sidebar_open)
					return;
				
				sidepopup.find(".content > .head > h2").html(info_data.name);
				sidepopup.find(".content > .body").html(info_data.desc)
				
				sidepopup.show();
			});
			
			new_item.fadeIn(300);
		}
		
		
		// add top- / sidebar handler
		
		// ### Time Sidebar ###
		time_topbar_node.bind("mouseenter", function() {
				
				// cancel the start of the close animation
				if(time_topbar_timeout !== null) {
					clearTimeout(time_topbar_timeout);
					time_topbar_timeout = null;
				}
				
				setTimeout(function() {
					time_topbar_node.stop().animate({top: "0px"}, 200);
					time_topbar_title_node.stop().fadeOut(200);
				}, 250);
		})
		.bind("mouseleave", function() {
		
			time_topbar_node.stop();
			time_topbar_title_node.stop();
		
			time_topbar_timeout = setTimeout(function() {
				time_topbar_node.stop().animate({top: "-115px"}, 200);
				time_topbar_title_node.stop().fadeIn(200);
			}, 400);
		});
		
		// ### Collector Sidebar ###
		collector_sidebar_node.bind("mouseenter", function() {
			
			// keep the sidebar closed if no item exists in the collection
			if(info_collection.length == 0)	return;
			
			// cancel the start of the close animation
			if(collector_sidebar_timeout !== null) {
				clearTimeout(collector_sidebar_timeout);
				collector_sidebar_timeout = null;
			}
		
			setTimeout(function() {
				collector_sidebar_node.stop().animate({left: "0px"}, 300, function() {
					collector_sidebar_open = true;
				});
			}, 250);
			
		})
		.bind("mouseleave", function() {
				
				$("#sidepopup").fadeOut(100);
				
				// don't even think about it!
				if(info_collection.length == 0)	return;
				
				collector_sidebar_node.stop();	
				
				collector_sidebar_timeout = setTimeout(function() {
					collector_sidebar_node.stop().animate({left: "-75px"}, 300);
					collector_sidebar_open = true;
				}, 400);
		});
		
		
		// add info box close handler
		$("#info_box .content .head .close_button")
		.css({opacity: 0.7})
		.hover(
			function() {
				$(this).stop().animate({opacity: 1.0}, 100);
			},
			function() {
				$(this).stop().animate({opacity: 0.7}, 100);
			}
		)
		.click(function() {
			info_box_open = false;
		
			$("#info_box")
			.fadeOut(300, function() {
				$(this).css({
					display: 'none', 
					height: 0,
					width: 0,
					marginLeft: 0,
					marginTop: 0
				});
				
				info_box_open = false;
			});
			;
		});
		
		// add info box "add to collection" handler
		$("#info_box .collection_button")
		.css({opacity: 0.1})
		.hover(
			function() {
				$(this).stop().animate({opacity: 1.0}, 100);
			},
			function() {
				$(this).stop().animate({opacity: 0.1}, 100);
			}
		)
		.click(function() {
			info_box_open = false;
			
			// don't add any more items to the collection if already full
			if(info_collection.length == 8) {
				return;
			}
			
			$("#info_box")
			.animate({marginLeft: '-2000px'}, 500)
			.fadeOut(200, function() {
				
				$(this).css({
					display: 'none',
					height: 0,
					width: 0,
					marginLeft: 0,
					marginTop: 0,
				});
				
			
				// add a copy to the collection if it hasn't been already added
				for(var i = 0; i < info_collection.length; i++) {
				
					if(info_collection[i].id == current_info_data.id) // TODO: check by id, when available
						return;
			
				}
			
				var c_obj = $.extend(current_info_data, {});
				info_collection.push(c_obj);
				add_to_collection(c_obj);
				current_info_data = null;
				
				info_box_open = false;
			});
			
		});
		
		
		left_handle_value_node.html("10");
		right_handle_value_node.html("90");
		
		// add slider
		$("#time_slider")
		.slider({
			range:true,
			min: 0,
			max: 100,
			values: [10, 90],
			change: function(e, ui) {
				// filter nodes
			},
			slide: function(e, ui) {
				left_handle_value_node.html(""+ui.values[0]);
				right_handle_value_node.html(""+ui.values[1]);
			}
		});
		
		*/
		
		
		
		
		// when window is being resized
		$(window).resize(function() {
		
			var height = $(window).height(),
				width = $(window).width();
		
			force.size([width, height]);
			vizsvg.style.height = height + "px";
			vizsvg.style.width = width + "px";
		});
	})

})(this.jQuery)
