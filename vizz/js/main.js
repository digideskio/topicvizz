(function($){
	"use strict";

	var vizsvg;
	var force;
	var info_box_open = false;
	var current_info_data = null;
	
	var info_collection = [];

	var graph = {
	  "nodes":[
		{"id":"Myriel","color":"rgb(12,34,56)", "name": "njaa", "desc": "blaaa"},
		{"id":"Napoleon","color":"rgb(12,34,56)", "name": "njaa", "desc": "blaaa"},
		{"id":"Mlle.Baptistine","color":"rgb(12,34,56)", "name": "njaa", "desc": "blaaa"},
		{"id":"Mme.Magloire","color":"rgb(12,34,56)", "name": "njaa", "desc": "blaaa"},
		{"id":"CountessdeLo","color":"rgb(12,34,56)", "name": "njaa", "desc": "blaaa"},
		{"id":"Geborand","color":"rgb(12,34,56)", "name": "njaa", "desc": "blaaa"},
		{"id":"Champtercier","color":"rgb(12,34,56)", "name": "njaa", "desc": "blaaa"},
		{"id":"Cravatte","color":"rgb(12,34,56)", "name": "njaa", "desc": "blaaa"},
		{"id":"Count","color":"rgb(12,34,56)", "name": "njaa", "desc": "blaaa"},
		{"id":"OldMan","color":"rgb(12,34,56)", "name": "njaa", "desc": "blaaa"},
		{"id":"Labarre","color":"rgb(12,34,56)", "name": "njaa", "desc": "blaaa"},
		{"id":"Valjean","color":"rgb(12,34,56)", "name": "njaa", "desc": "blaaa"},
		{"id":"Marguerite","color":"rgb(12,34,56)", "name": "njaa", "desc": "blaaa"},
		{"id":"Mme.deR","color":"rgb(12,34,56)", "name": "njaa", "desc": "blaaa"},
		{"id":"Isabeau","color":"rgb(12,34,56)", "name": "njaa", "desc": "blaaa"},
		{"id":"Gervais","color":"rgb(12,34,56)", "name": "njaa", "desc": "blaaa"}
	  ],
	  "links":[
		{"source":1,"target":2,"value":1},
		{"source":2,"target":1,"value":8},
		{"source":3,"target":1,"value":10},
		{"source":3,"target":2,"value":6},
		{"source":4,"target":1,"value":1},
		{"source":5,"target":1,"value":1},
		{"source":6,"target":1,"value":1},
		{"source":7,"target":1,"value":1},
		{"source":8,"target":1,"value":2},
		{"source":9,"target":1,"value":1}
	  ]
	};



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
		    .linkDistance(300)
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
					
					return d.color;
					
				})
				.on('dblclick', function(d, i) {
					if(d.name) {
						if(!info_box_open) {
							info_box_open = true;
							
							var info_box = $('#info_box');
							
							current_info_data = d;
						
							info_box.find(".head h2").html(current_info_data.name);
						
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
				
				node.append('text')
				.attr("fill", "rgb(255, 255, 255)")
				.attr("text-anchor", "middle")
				.attr("pointer-events", "none")
				.attr("y", 5)
				.html(function(d, i) {
					return d.name;
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
				//node.attr("cx", function(d) { return d.x; })
				//	.attr("cy", function(d) { return d.y; });
			  });
	}

	

	$(document).ready(function(){
		
		vizsvg = document.querySelector('#graph_viz');
		
		var vis = d3.select(vizsvg);
		
		initGraph(vis);
		
		//vis.addAttribute('viewBox', '0 0');
		
		

		var time_topbar_node = $("#time_topbar"),
			filter_sidebar_node = $("#filter_sidebar"),
			collector_sidebar_node = $('#collector_sidebar');
		var time_topbar_title_node = time_topbar_node.find(".title span"),
			filter_sidebar_title_node = filter_sidebar_node.find(".title span");

		var time_topbar_timeout = null,
			filter_sidebar_timeout = null,
			collector_sidebar_timeout = null;

		var left_handle_value_node = time_topbar_node.find(".left_handle_value"),
			right_handle_value_node = time_topbar_node.find(".right_handle_value");




		// add to collection
		function add_to_collection(info_data) {
			
			var color = (info_data.color) ?  info_data.color: 'rgb(25, 137, 224)';
			
			var collection_sidebar_con = $('#collector_sidebar .content');
		
			var new_item = $('<div class="item"></div>').hide();
			var new_item_placeholder = $('<div class="placeholder"></div>').click(function() {
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
					console.log('in');
				},
				function(){
					console.log('out');
				});
			
			new_item.append(new_item_placeholder);
			new_item.append(new_item_colorarea);
			collection_sidebar_con.append(new_item);
			
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
				collector_sidebar_node.stop().animate({left: "0px"}, 300);	
			}, 250);
			
		})
		.bind("mouseleave", function() {
				
				// don't even think about it!
				if(info_collection.length == 0)	return;
				
				collector_sidebar_node.stop();	
				
				collector_sidebar_timeout = setTimeout(function() {
					collector_sidebar_node.stop().animate({left: "-75px"}, 300);
				}, 400);
		});
		
		
		// add info box close handler
		$("#info_box .content .head .close_button")
		.css({opacity: 0.7})
		.hover(
			function() {
				console.log("asf");
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
					display: 'hidden', 
					height: 0,
					width: 0,
					marginLeft: 0,
					marginTop: 0
				});
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
			
			$("#info_box")
			.animate({marginLeft: '-2000px'}, 500)
			.fadeOut(200, function() {
				$(this).css({
					display: 'hidden',
					height: 0,
					width: 0,
					marginLeft: 0,
					marginTop: 0,
				});
				
				// don't add any more items if collection is full
				if(info_collection.length == 9)
					return;
			
				// add a copy to the collection if it hasn't been already added
				for(var i = 0; i < info_collection.length; i++) {
				
					if(info_collection[i].id == current_info_data.id) // TODO: check by id, when available
						return;
			
				}
			
				var c_obj = $.extend(current_info_data, {});
				info_collection.push(c_obj);
				add_to_collection(c_obj);
				current_info_data = null;
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
