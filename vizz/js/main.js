(function($){

	var info_box_open = false;

	var Renderer = function(canvas){
		var canvas = $(canvas).get(0)
		var ctx = canvas.getContext("2d");
		var particleSystem

		var that = {
			init:function(system){
				//
				// the particle system will call the init function once, right before the
				// first frame is to be drawn. it's a good place to set up the canvas and
				// to pass the canvas size to the particle system
				//
				// save a reference to the particle system for use in the .redraw() loop
				particleSystem = system

				// inform the system of the screen dimensions so it can map coords for us.
				// if the canvas is ever resized, screenSize should be called again with
				// the new dimensions

				var win_jq = $(window);

				canvas.width = win_jq.width() - 8;
				canvas.height = win_jq.height() - 8;

				particleSystem.screenSize(canvas.width, canvas.height);
				particleSystem.screenPadding(150); // leave an extra 80px of whitespace per side

				win_jq.resize(function() {
					canvas.width = $(this).width() - 8;
					canvas.height = $(this).height() - 8;
					particleSystem.screenSize(canvas.width, canvas.height);
					that.redraw();
				});

				// set up some event handlers to allow for node-dragging
				that.initMouseHandling();
			},

			redraw:function(){
				//
				// redraw will be called repeatedly during the run whenever the node positions
				// change. the new positions for the nodes can be accessed by looking at the
				// .p attribute of a given node. however the p.x & p.y values are in the coordinates
				// of the particle system rather than the screen. you can either map them to
				// the screen yourself, or use the convenience iterators .eachNode (and .eachEdge)
				// which allow you to step through the actual node objects but also pass an
				// x,y point in the screen's coordinate system
				//
				//ctx.fillStyle = "white"
				ctx.clearRect(0,0, canvas.width, canvas.height)

				particleSystem.eachEdge(function(edge, pt1, pt2){
					// edge: {source:Node, target:Node, length:#, data:{}}
					// pt1: {x:#, y:#} source position in screen coords
					// pt2: {x:#, y:#} target position in screen coords

					// draw a line from pt1 to pt2
					ctx.strokeStyle = "rgba(255,255,255, .333)"
					ctx.lineWidth = 2
					ctx.beginPath()
					ctx.moveTo(pt1.x, pt1.y)
					ctx.lineTo(pt2.x, pt2.y)
					ctx.stroke()
				});

				particleSystem.eachNode(function(node, pt){
					// node: {mass:#, p:{x,y}, name:"", data:{}}
					// pt: {x:#, y:#} node position in screen coords

					// draw a rectangle centered at pt
					var w = 15;
					ctx.fillStyle = (node.data.color) ? node.data.color : "white"
					//ctx.fillRect(pt.x-w/2, pt.y-w/2, w,w)
					ctx.beginPath();
					var r = (node.data.root || node.data.alone) ? 5: 0;
					//console.log(node.data.text, ctx.measureText(node.data.text))
					ctx.arc(pt.x, pt.y, w+r+((node.data.text) ? ctx.measureText(node.data.text).width:0)/2, 0, 2*Math.PI, false);
					ctx.fill();

					if(node.data.text) {
						ctx.fillStyle = 'white';
						ctx.font = 'bold 15px Arial';
						ctx.fillText(node.data.text, pt.x - ctx.measureText(node.data.text).width/2, pt.y + 5)
					}
				});
			},

			initMouseHandling:function(){
				// no-nonsense drag and drop (thanks springy.js)
				var dragged = null;
				var dblclicked = null;

				// set up a handler object that will initially listen for mousedowns then
				// for moves and mouseups while dragging
				var handler = {
					clicked:function(e){
						var pos = $(canvas).offset();
						_mouseP = arbor.Point(e.pageX-pos.left, e.pageY-pos.top)
						dragged = particleSystem.nearest(_mouseP);

						if (dragged && dragged.node !== null){
							// while we're dragging, don't let physics move the node
							dragged.node.fixed = true
						}

						$(canvas).bind('mousemove', handler.dragged)
						$(window).bind('mouseup', handler.dropped)

						return false
					},
					dblclicked: function(e) {
						var pos = $(canvas).offset();
						_mouseP = arbor.Point(e.pageX-pos.left, e.pageY-pos.top)
						dblclicked = particleSystem.nearest(_mouseP);

						if (dblclicked && dblclicked.node !== null){
							if(dblclicked.node.data.text) {
								//console.log(dblclicked.node.data.text);
							
								if(!info_box_open) {
									info_box_open = true;
									
									var info_box = $('#info_box');
								
									info_box.find(".head h2").html(dblclicked.node.data.text);
								
									if(dblclicked.node.data.desc)
										info_box.find(".body").html(dblclicked.node.data.desc);
								
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
						}

						dblclicked = null;

						return false
						
					},
					dragged:function(e){
						var pos = $(canvas).offset();
						var s = arbor.Point(e.pageX-pos.left, e.pageY-pos.top)

						if (dragged && dragged.node !== null){
						  var p = particleSystem.fromScreen(s)
						  dragged.node.p = p
						}

						return false
					},

					dropped:function(e){
						if (dragged===null || dragged.node===undefined) return
						if (dragged.node !== null) dragged.node.fixed = false
						dragged.node.tempMass = 1000
						dragged = null
						$(canvas).unbind('mousemove', handler.dragged)
						$(window).unbind('mouseup', handler.dropped)
						_mouseP = null
						return false
					}
				}

				// start listening
				$(canvas).mousedown(handler.clicked);
				$(canvas).dblclick(handler.dblclicked);
			}
		}
		
		return that
	}

	$(document).ready(function(){
		var canvas_id = "graph_viz";
		var c = $("#" + canvas_id).get(0);
		c.width = 600;
		c.height = 600;

		var time_topbar_node = $("#time_topbar"),
			filter_sidebar_node = $("#filter_sidebar");
		var time_topbar_title_node = time_topbar_node.find(".title span"),
			filter_sidebar_title_node = filter_sidebar_node.find(".title span");

		var time_topbar_timeout = null,
			filter_sidebar_timeout = null;

		var left_handle_value_node = time_topbar_node.find(".left_handle_value"),
			right_handle_value_node = time_topbar_node.find(".right_handle_value");

		var sys = arbor.ParticleSystem(1000, 600, 0.5); // create the system with sensible repulsion/stiffness/friction
		sys.parameters({gravity:true}); // use center-gravity to make the graph settle nicely (ymmv)
		sys.renderer = Renderer("#" + canvas_id); // our newly created renderer will have its .init() method called shortly by sys...

		// add some nodes to the graph and watch it go...
		sys.addNode('a', {color: 'orange', text: 'baaamm!', root: true, desc: 'Ahoy hoy!'});
		sys.addNode('e', {color: '#05A2C4', text: 'yamm!', alone: true, desc: 'Geht!'});
		sys.addNode('b', {color: 'red', text: 'nyan~nyan~nyan', desc: 'Cat!'});
		sys.addEdge('a','b');
		sys.addEdge('a','c');
		sys.addEdge('a','d');


		// add top- / sidebar handler
		$("#time_topbar").bind("mouseenter", function() {
				
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
		
		
		$("#filter_sidebar").bind("mouseenter", function() {
			
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
		
		
		// add info box close handler
		$("#info_box .head .close_button")
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
					display: 'hidden', 
					height: 0,
					width: 0,
					marginLeft: 0,
					marginTop: 0
				});
			});
			;
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
	})

})(this.jQuery)
