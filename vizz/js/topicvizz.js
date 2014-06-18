

(function($, window){
    "use strict";
    
    /*
     *  Renderer-Variable, woruber der Renderer gesteuert werden kann (VivaGraphJS)
     */
    var renderer = null;
    
    /* Variable, die das SVG-Element im DOM referenziert, in dem die Verlaufsgrafiken ausgegeben werden */
    var histogramvizsvg = null;
    
    /* "Globale" Variablen um Zugriff auf die Popup-Element zu haben */
    var abstract_text_popup = null,
        topic_title_popup   = null;
    
    /* Vorgefertigte Datenstruktur für die Nodes (Knoten), Lines (Kanten) sowie Hilfsvariablen */
    var data = {
        "nodes":                [],
        "links":                [],
        "years_min_max":        { min: null, max: null },
        "histogram_min_max":    { min: null, max: null }
    };
    
    
    /* Hält alle eingebundenen Erweiterungen fest */
    var extension_set = {};
    
    /* Liste aller Autoren */
    var authors = null;
    
    /* Hilfsvariable um die Mindest- und Maximalanzahl der Topicerwähnungen festzuhalten */
    var num_mentioned = {min: null, max: null};
    
    
    var helper = {
        /* Hilfsfunktion, um ein HSV- in ein RGB-Farbwert umzurechnen; da SVG keine HSV-Farbangabe unterstützt */
        /* http://de.wikipedia.org/wiki/HSV-Farbraum#Umrechnung_HSV_in_RGB */
        hsv2rgb: function(h, s, v) {
            if(s == 0) {
                var val = v * 255;
                return rgb = [val, val, val];
            }
            
            var hi = h/60;
            var i = Math.floor(hi); 
            var f = hi - i;
            var p = v * (1 - s);
            var q = v * (1 - s * f);
            var t = v * (1- s * (1 - f));
            
            var r, g, b;
            
            switch(i) {
                case 0:
                case 6:
                    r = v; g = t; b = p;
                    break;
                case 1:
                    r = q, g = v; b = p;
                    break;
                case 2:
                    r = p; g = v; b = t;
                    break;
                case 3:
                    r = p; g = q; b = v;
                    break;
                case 4:
                    r = t; g = p; b = v;
                    break;
                case 5:
                    r = v; g = p; b = q;
                    break;
            }
        
            return [Math.ceil(r * 255), Math.ceil(g * 255), Math.ceil(b * 255)];
        },

        /* Linienfunktion, um, anhand eines Wertearrays, ein SVG-Pfad zu erzeugen */
        line_function: function(data_arr, max_width, max_height, max_value) {
            
            /* Abstandsschritt zwischen den Pfadpunkten bestimmten */
            var width_step = max_width / (data_arr.length + 2);
            
            if(typeof(max_value) === 'undefined') {
                /* Den größten Wert im Wertearray bestimmen, um das Diagramm in seiner y-Achse zu skalieren */
                max_value = 0;
                for(var i = 0; i < data_arr.length; i++) {
                    if(max_value < data_arr[i]) max_value = data_arr[i];
                }
            }
            
            /* Skalisrungsfaktor bestimmen */
            var resize_quot = max_height / max_value;
            
            var line_data = [];
            
            line_data.push({"x": 0,
                            "y": max_height + 0.5 });
            
            /* Untere Punkte des Pfads berechnen (hin ->) */
            for(var i = 0; i < data_arr.length; i++) {
                line_data.push({"x": width_step + width_step * i,
                                "y": max_height + data_arr[i] * resize_quot + 0.5 });
            }
            
            line_data.push({"x": width_step + width_step * data_arr.length,
                            "y": max_height + 0.5 });
            
            line_data.push({"x": width_step + width_step * data_arr.length,
                            "y": max_height - 0.5});
            
            /* Oberen Punkte bestimmten (zurück <-) */
            for(var i = data_arr.length - 1; i >= 0; i--) {
                line_data.push({"x": width_step + width_step * i,
                                "y": max_height - data_arr[i] * resize_quot - 0.5 });
            }
            
            
            line_data.push({"x": 0,
                            "y": max_height - 0.5 });
            
            /* Von d3.js bereitgestellte Funktion, um einen Pfad einfacher zu erzeugen */
            var line_func = d3.svg.line()
                                .x(function(d) { return d.x; })
                                .y(function(d) { return d.y; })
                                /* 'cardinal' versucht den Pfad über die Punkte verlaufen zu lassen und schließt den Pfad am Ende */ 
                                .interpolate("monotone");
            
            /* Attributwert für 'd' zurückgeben */
            return line_func(line_data);
        },
        
        /* Jahrestexte innerhalb einer SVG-Gruppe erzeugen (justify) */
        create_year_text_in_group: function(group_node, year_start, year_amount, max_width) {
            
            /* Abstand zwischen den Textelementen (enthalten Jahreszahl) bestimmen */
            var width_step = max_width / (year_amount + 2);

            /* Für den Start und das Ende etwas wegnehmen */
            max_width -= (width_step * 2)
            
            var year_step = 1;
            
            /* Bei einer zu großen Anzahl an Jahren bei geringer verfügbarer Breite,
             *  sollen einige Jahre übersprungen werden */
            var year_text_step = year_amount / (max_width / 40.0);

            if(year_text_step > 1)
                year_step = Math.ceil(year_text_step);
            
            /* Für jede Jahreszahl ein Textelement erzeugen und es dem g-Element anhängen */
            for(var i = 0; i < year_amount; i += year_step) {
                group_node.append("text")
                    .attr("pointer-events", "none")
                    .attr("x", function() { return width_step + (width_step * i - 15); })
                    .attr("y", 20)
                    .attr("style", "font-size: 0.8em;")
                    .attr('text-anchor', 'middle')
                    .html("" + year_start);
                
                /* Das Jahr erhöhen */
                year_start += year_step;
            }
        }
    };
    
    
    
    /* Ausgelagerte Initialisierungs-Prozedur */
    function initGraph() {
        
        var graph = Viva.Graph.graph();
        
        for (var i = 0; i < data.nodes.length; ++i){
            graph.addNode(i, data.nodes[i]);
        }
        
        
        for (i = 0; i < data.links.length; ++i){
            var link = data.links[i];
            graph.addLink(link.source, link.target, {weight: link.weight});
        }
        
        var layout = Viva.Graph.Layout.forceDirected(graph, {
            springLength    : 200,
            springTransform : function(link, spring) {
                spring.length = 150 + (200 * (1 - link.data.weight));
            },
            springCoeff     : 0.0002,
            dragCoeff       : 0.02,
            gravity         : -2.2,
            timeStep        : 20,
            stableThreshold : 0.001
        });

        var svgGraphics = Viva.Graph.View.svgGraphics();

        svgGraphics.node(function(node) {
                
            var g = Viva.Graph.svg('g')
                .attr("class", "node");
            
            var rect = Viva.Graph.svg('rect')
                .attr("class", "topic")
                .attr("width", 30)
                .attr("height", 30)
                .attr("rx", 15)
                .attr("ry", 15)
                .attr("x", -15)
                .attr("y", -15);
                
            d3.select(rect).style({
                "stroke": "rgba(255, 255, 255, 0.4)",
                "stroke-width": 2,
                "fill": function() {
                    /* Sättigung und Helligkeit niedrig */
                    var rgb =  helper.hsv2rgb((1 - node.data.num_overall_mentioned/num_mentioned.max) * 130, 0.55, 0.71);
                    return "rgb(" + rgb[0] + ", " + rgb[1] + ", " + rgb[2] + ")";
                }
            });
            
            
            var size = 80 + (((node.data.num_overall_mentioned - num_mentioned.min) / (1 + num_mentioned.max - num_mentioned.min)) * 100);
            rect.attr("width", size);
            rect.attr("height", size);
            
            var size_h = size/2;
            
            rect.attr("rx", size_h);
            rect.attr("ry", size_h);
            rect.attr("x", -size_h);
            rect.attr("y", -size_h);
            
            
            var g_all = null;
            
            /* Ein Doppelklick auf ein Node (Rechteck) soll das Rechteck Maximieren */
            $(rect).on('dblclick', function(e) {
                
                e.stopPropagation();
                
                var d = node.data;
                
                if(d.timeout) {
                    window.clearTimeout(d.timeout);
                    d.timeout = null;
                }
                
                topic_title_popup.stop().fadeOut();           
                
                /* Bei fehlendem Topic-Namen, macht es keinen Sinn diesen zu Maximieren */
                if(d.topic) {
                    
                    /*
                     *  Node kann visuell unterhalb eines anderen Nodes liegen,
                     *      weshalb dieser in den Vordergrund platziert werden muss
                     *          (SVG-Elemente kennen kein "z-index"-Attribut)
                     */
                    var rect = d3.select(this);
                    var g_jq = $($(this).parent()).detach();
                    
                    if(g_all === null)
                        g_all = $("#graph_viz > svg > g");
                    
                    g_all.append(g_jq);
                    
                    /* Element-Referenzen für den späteren Gebrauch holen */
                    var top_text = $(this).parent().find("text");
                    var g_d3 = d3.select($(this).parent()[0]);
                    
                    if(d.open) {
                        /* Node ist im offen Zustand bzw. maximiert */
                        
                        /* In den Element-Daten festhalten, dass der Node nun geschlossen ist bzw. wird */
                        d.open = false;
                        
                        /* Closebutton ausblenden */
                        $(this)
                            .parent()
                            .find(".main_close_button")
                            .fadeOut();
                        
                        /* Zentrierter Topic-Name einblenden */
                        top_text.fadeIn();
                        $(this)
                            .parent()
                            .find(".main_content")
                            .fadeOut(function() {
                            
                                /* foreignObjects aus Gründen der Performance aus dem DOM-Baum entfernen */
                                $(this).parent().find("foreignObject").remove();
                            });
                        rect.transition()
                            .attr("width", d.size)
                            .attr("height", d.size)
                            .attr("rx", d.size/2)
                            .attr("ry", d.size/2)
                            .attr("x", -d.size/2)
                            .attr("y", -d.size/2)
                            .style("stroke-width", 2);
                        
                        /* Den Abstract-Popup ebenfalls schließen, wenn der Node geschlossen/minimiert wird */
                        abstract_text_popup.stop().fadeOut();
                    }
                    else {
                        /* Node ist im geschlossenen Zustand bzw. minimiert */
                        
                        /* In den Element-Daten festhalten, dass der Node nun offen ist bzw. geöffnet wird */
                        d.open = true;
                        
                        /*
                         *  ForeignObject für die Frontdarstellung eines Topics einfügen, um eingebettete XHTML-Elemente zu ermöglichen,
                         *      da SVG keine Elemente anbietet, die Word-Wrapping unterstützen
                         */
                        addForeignObjectMain(g_d3, node.data);
                        addForeignObjectExpansion(g_d3, node.data);
                        
                        /* Zentrierter Topic-Name ausblenden */
                        top_text.fadeOut();
                        
                        /* Closebutton einblenden */
                        $(this).parent().find(".main_close_button").fadeIn();
                        
                        /* Zuvor eingefügtes ForeignObject-Element (Vorderseite) einblenden */
                        $(this).parent().find(".main_content").fadeIn();
                        
                        /* Maximierungs-Transition (Animation) starten */
                        rect.transition()
                            .attr("width", 320)
                            .attr("height", 320)
                            .attr("rx", 40)
                            .attr("ry", 40)
                            .attr("x", -160)
                            .attr("y", -160)
                            .style("stroke-width", 7);
                    }
                
                }
            });
            
            
            $(rect).on('mouseover', function(e) {
                e.stopPropagation();
                
                var d = node.data;
                
                if(!d.open && e.buttons === 0) {
                    d.timeout = window.setTimeout(function() {
                        topic_title_popup
                            .html(d.topic)
                            .css({ 'left': (e.pageX + 10) + "px",
                                   'top': (e.pageY + 10) + "px"})
                            .stop().fadeIn(function() { d.timeout = null; });
                    }, 1000);
                }
            })
            .on('mouseleave', function() {
                var d = node.data;
            
                if(!d.open) {
                    if(d.timeout) {
                        window.clearTimeout(d.timeout);
                        d.timeout = null;
                    }
                    else
                        topic_title_popup.stop().fadeOut();
                }
            })
            .on('mousedown', function(e) {
                var d = node.data;
                
                if(!d.open) {
                    if(d.timeout) {
                        window.clearTimeout(d.timeout);
                        d.timeout = null;
                    }
                    else
                        topic_title_popup.stop().fadeOut();
                }
            });
            
            /* Minimale Nodegröße für den späteren Gebrauch sichern (für spätere Minimierung) */
            node.data.size = size;
                
            var topic_text = Viva.Graph.svg('text')
                .attr("fill", "rgb(255, 255, 255)")
                .attr("pointer-events", "none")
                .attr("y", 5)
                .attr("title", node.data.topic)
                .attr("text-anchor", "middle");
            
            
            $(topic_text).html(node.data.topic);
            
            var width_diff = ((node.data.topic.length * 8) + 20) - size;
            
            if(width_diff > 0) {
                /* Nach Nodegröße angepassten Topic-Name als Inhalt des Text-Elements setzen */
                var short_topic_str = node.data.topic;
                
                short_topic_str = short_topic_str.slice(0, Math.floor(size / 13)) + "...";
                
                $(topic_text).html(short_topic_str);
            }
            
            
            /* Schließenbutton hinzufügen */
            var image = Viva.Graph.svg('image')
                .attr("class", "main_close_button")
                .attr("x", "115")
                .attr("y", "-215")
                .attr("width", "80")
                .attr("height", "80")
                .link('./img/close_button.png');
            
            image.style.display = "none";
            
            $(image)
                .on("click", function(e) {
                    
                    e.preventDefault();
                    e.stopPropagation();
                    
                    var e = document.createEvent('UIEvents');
                    e.initUIEvent(  "dblclick", true, true,
                                    window, 0, 0, 0, 0, 0,
                                    false, false, false, false,
                                    0, null);
                
                    rect.dispatchEvent(e);
                    
                    $(this).fadeOut(function() {
                        $(this)
                            .attr("x", "115")
                            .attr("y", "-215");
                    });
                });
            
            g.append(rect);
            g.append(topic_text);
            g.append(image);
            
            return g;

        }).placeNode(function(nodeUI, pos){
            nodeUI.attr("transform", "translate(" + pos.x + ", " + pos.y + ")");
        });

        svgGraphics.link(function(link){
            return Viva.Graph.svg('line')
                    .attr('stroke', '#fff')
                    .attr('stroke-width', 1);
        });

        renderer = Viva.Graph.View.renderer(graph, {
            container : document.getElementById('graph_viz'),
            layout : layout,
            graphics : svgGraphics,
            prerender: 0,
            renderLinks : true
        });
        
        renderer.run();
        
        
        /* Hintergrund beim Panning mitbewegen */
        
        var start_curr_g_pos = [0, 0];
        var curr_g_pos = [];
        var graph_viz_jq_node = $('#graph_viz');
        var body_jq_node = $('body');
        
        graph_viz_jq_node.on('mousedown', function(e) {
            
            if(e.buttons === 2)
                return;
            
            /* Momentane Startposition für spätere Berechnungen zwischenspeichern */
            var start_pos = [e.clientX, e.clientY];
            var new_pos = [];
            
            graph_viz_jq_node.on('mousemove', function(e) {
                /*
                * Sofern man die Maus mit gedrückter Taste aus dem Fenster bewegt, bleibt das Panning beim Wiedereintritt aktiv;
                * der folgende Code überprüft bei jeder Mausbewegung, ob die Maustaste noch gedrückt wird und bricht das Panning ab,
                * wenn es nicht mehr so ist
                */
                 
                if(e.buttons === 0) {
                    graph_viz_jq_node.off('mousemove');
                    start_curr_g_pos = curr_g_pos;
                    return;
                }
                
                /* Die aktuelle Mausposition beziehen, nachdem sie bewegt wurde */
                var curr_pos = [e.clientX, e.clientY];
                
                /* Positions-Differenz bilden */
                new_pos = [curr_pos[0] - start_pos[0], curr_pos[1] - start_pos[1]];
                
                if(start_curr_g_pos.length === 2) {
                    /* Sofern die übergeordnete schon einmal in ihrere Position bewegt wurde, soll die letzte Verschiebung mitberücksichtigt werden */
                    new_pos[0] += start_curr_g_pos[0];
                    new_pos[1] += start_curr_g_pos[1];
                }
                
                /* Die Hintergrundgrafik soll sich mitbewegen -> CSS-Wert "no-repeat"" darf für die Hintergrundgrafik nicht gesetzt sein */
                body_jq_node.css('background-position', new_pos[0] + "px " + new_pos[1] + "px");
                
                /* Aktuelle Position für das nächsten Mal, wenn "mousemove" getriggert wird, aufbewahren */
                curr_g_pos = new_pos;
            });
        })
        .on('mouseup', function(e) {
            graph_viz_jq_node.off('mousemove');
            start_curr_g_pos = curr_g_pos;
        });
        
        
        /*
         *  Hinzufügen eines foreignObject-Elements, welcher es erlaubt innerhalb des SVG-Namespaces
         *      (X)HTML-Elemente einzubetten (ermöglicht die Nutzung von Elementen mit Word-Wrap-Eigenschaften);
         *  Inhalt der Vorderseite eines Topics
         */
        function addForeignObjectMain(node, d) {
        
            var content = node
                .append("foreignObject")
                .attr("class", "main_content")
                .attr("style", "display: none; margin-left: -150px; margin-top: -150px; cursor: default;")
                .attr("requiredExtensions", "http://www.w3.org/1999/xhtml")
                .attr("width", "300px")
                .attr("height", "300px")
                .attr("x", "-150px")
                .attr("y", "-150px")
                .on("dblclick", function(d, i) {
                    /*
                     *  Da der Node vom foreignObject komplett überdeckt wird,
                     *      kann auf diesem kein Doppelklick ausgeübt werden
                     *
                     *  Ein Doppelklick auf das foreignObject muss somit dem daunter liegenden 
                     *      Node gereicht werden. Dies wird durch ein simulierten Doppelklick auf das Rechteck-Element realisiert
                     */
                    var e = document.createEvent('UIEvents');
                    e.initUIEvent(  "dblclick", true, true,
                                    window, 0, 0, 0, 0, 0,
                                    false, false, false, false,
                                    0, null);
                
                    $(this).parent().find("rect")[0].dispatchEvent(e);
                });
            
            /* Übergeordnetes body-Element einfügen */
            var embed_div = content.append("xhtml:body")
                .attr("xmlns", "http://www.w3.org/1999/xhtml")
                .style("background", "transparent");
        

            /* Dem body-Element wird ein Header-Element hinzugefügt */
            embed_div.append("h2")
                .attr("class", "topic_name")
                .text(d.topic);
            
            
            /*
             *  Ist der Abstact zu lang für den Node, wird er gekürzt dargestellt
             *
             *  Über ein zusätzlich angehängtes Auslassungszeichen ([...]), wird der restliche 
             *      Abstract in einem Popup angezeigt
             *
             *  Ist der Abstract kurz genug, wird kein Auslassungszeichen angehangen
             */
            
            /*
             *  Im späteren Verlauf kann die Variable "full_abstract_popup_text" je nach Abstract-Länge,
             *      ein Span-Element für das Auslassungszeichen enthalten
             */
            var full_abstract_popup_text = null;
            
            /* Div-Element für den Abstract erzeugen und einfügen */
            var abstract_text_div = embed_div.append("div")
                .attr("class", "abstract_text")
                .html(function() {
                    
                    /*
                     *  Ein verkürzter Abstact soll maximal 360 Zeichen besitzen,
                     *      bzw. etwas mehr, wenn kurz nach dem 360.ten Zeichen ein Leerzeichen existiert
                     */
                    var i = 360;
                    while(i < d.abstract.length && d.abstract[i] != ' ') {
                        i++;
                    }
                    
                    /* "Schnittposition" für den späteren Gebrauch sichern */
                    d.abstract_pos = i;
                    
                    /* Den restlichen Abstract-Text extrahieren */
                    var abstract_rest = d.abstract.slice(d.abstract_pos);
                    
                    /*
                     *  Ist der restliche Abstract-Text größer als 0 Zeichen,
                     *      wird ein Auslassungs-Kennzeichen hinzugefügt
                     */
                    if(abstract_rest.length > 0) {
                    
                        /* Das neue Span-Element wird der "full_abstract_popup_text"-Variable zugewiesen */
                        full_abstract_popup_text = $("<span>")
                        .html("[...]")
                        .hover(function(e) { /* MouseEnter */
                            
                            if(!d.open)
                                return;
                            
                            /* Popup mit dem restlichen Abstract-Text befüllen und danach direkt einblenden */
                            abstract_text_popup
                                .html(abstract_rest)
                                .css({  'left': (e.pageX + 10) + "px",
                                        'top': (e.pageY + 10) + "px"})
                                .stop()
                                .fadeIn();
                        },
                        function(e) { /* MouseLeave */
                            
                            /*
                             *  Beim verlassen des Auslassungszeichen-Elements mit der Maus,
                             *      soll der Popup ausgeblendet werden
                             */
                            abstract_text_popup
                                .stop()
                                .fadeOut();
                        });
                    }
                    
                    /* Den verkürzten Abstract für die Darstellung zurückgeben */
                    return d.abstract.slice(0, i) + " ";
                });
            
            /*
             *  Existiert ein restlicher Abstract, wurde auch ein Span-Element erzeugt
             *      und der Variable "full_abstract_popup_text" zugewiesen
             *    
             *  Das Span-Element, mit dem verkürzten Abstract, kann somit dem Div-Element angehangen werden,
             *      um den Popup mit dem restlichen Abstract aufrufen zu können
             */
            if(full_abstract_popup_text != null) {
                $(abstract_text_div.node()).append(full_abstract_popup_text);
            }
            
            
            /*
             *  Hinzufügen eines Div-Elements, um Dateien aufzulisten,
             *      die mit dem Topic in Beziehung stehen
             */
            var turn_over_placer = embed_div.append("div")
                .attr("class", "turn_over_placer");
            

            var turn_over_btn = turn_over_placer.append("a")
                .attr("class", "turn_over_btn")
                .attr("href", "javascript:void(0);");
            
            var turn_over_btn_jq = $(turn_over_btn.node());
            
            turn_over_btn_jq.html('+');
            
            turn_over_btn_jq.on('click', function(e) {
                
                var rect = d3.select($(node.node()).find('rect')[0]);
                
                /* Haupt-ForeignObject ausblenden */
                $(content.node()).stop().fadeOut();
                
                /* Closebutton ausblenden und neu positionieren */
                var main_close_button = $(content.node()).parent().find('.main_close_button');
                
                main_close_button.fadeOut(function() {
                    $(this)
                        .attr("x", "275")
                        .attr("y", "-335");
                });
                
                /* Wende-Transition (Animation) starten  -> von der Vorder- zur Rückseite */
                rect.transition()
                    .duration(700)
                    .attr("width", 0)
                    .attr("rx", 40)
                    .attr("ry", 40)
                    .attr("x", 0)
                    .each('end', function() {
                        rect.transition()
                            .duration(700)
                            .attr("width", 640)
                            .attr("height", 560)
                            .attr("rx", 40)
                            .attr("ry", 40)
                            .attr("x", -320)
                            .attr("y", -280)
                            .each('end', function() {
                                /* Erweiterungs-ForeignObject einblenden */
                                var forgObj = $(node.node()).find(".expanded_content").fadeIn();
                                /* Nano-Scrollbar für die zusätzlichen Topic-Infos einbinden */
                                forgObj.find(".nano").nanoScroller({ flash: true });
                                
                                /* Closebutton nach Wendeanimation einblenden */
                                main_close_button.fadeIn();
                            });
                    });
            });
            
        }
        
        
        
        /*
         *  Hinzufügen eines foreignObject-Elements, welcher es erlaubt innerhalb des SVG-Namespaces
         *      (X)HTML-Elemente einzubetten (ermöglicht die Nutzung von Elementen mit Word-Wrap-Eigenschaften);
         *  Inhalt der Rückseite eines Topics
         */
        function addForeignObjectExpansion(node, d) {
            var content = node
                .append("foreignObject")
                .attr("class", "expanded_content")
                .attr("style", "display: none; margin-left: -320px; margin-top: -320px; cursor: default;")
                .attr("requiredExtensions", "http://www.w3.org/1999/xhtml")
                .attr("width", "640px")
                .attr("height", "560px")
                .attr("x", "-320px")
                .attr("y", "-280px")
                .on("dblclick", function(d, i) {
                
                    /*
                     *  Da der Node vom foreignObject komplett überdeckt wird,
                     *      kann auf diesem kein Doppelklick ausgeübt werden
                     *
                     *  Ein Doppelklick auf das foreignObject muss somit dem daunter liegenden 
                     *      Node gereicht werden. Dies wird durch ein simulierten Doppelklick auf das Rechteck-Element realisiert
                     */
                    var e = document.createEvent('UIEvents');
                    e.initUIEvent(  "dblclick", true, true,
                                    window, 0, 0, 0, 0, 0, 
                                    false, false, false, false,
                                    0, null);
                
                    $(this).parent().find("rect")[0].dispatchEvent(e);
                });
            
            /* Übergeordnetes body-Element einfügen */
            var embed_div = content.append("xhtml:body")
                .attr("xmlns", "http://www.w3.org/1999/xhtml")
                .style("background", "transparent");
        

            /* Dem body-Element wird ein Header-Element hinzugefügt */
            embed_div.append("h2")
                .attr("class", "topic_name")
                .text(d.topic);
            
            

            /* DIV-Container, in dem nur der für das Topic relevante Verlauf grafisch ausgegeben wird */                
            var histogram_single_diagram = embed_div.append("div")
                .attr("class", "histogram_single_diagram");
                
            
            /* Frequenz-Diagramm erzeugen */
            
            var topic_single_diagram = histogram_single_diagram.append("svg").attr("class", "topic_single_diagram");
            
            var data_arr = [];
            
            topic_single_diagram.append("g")
                .attr("class", "frequence_path")
                .attr("transform", "translate(30, 10)")
                .append("path")
                .attr("d", function() {
                    var histogramm_arr = d.frequency_per_year;
                    
                    data_arr = [];
                    for(var i = data.years_min_max.min; i <= data.years_min_max.max; i++) {
                        var val = histogramm_arr[''+i];
                        
                        if(typeof(val) === 'undefined')
                            val = 0;
                        
                        data_arr.push(val);
                    }
                    
                    return helper.line_function(data_arr, 620, 50);
                })
                .attr("stroke-width", "0");
            
            
            var year_group = topic_single_diagram.append("g")
                .attr("class", "frequence_years")
                .attr("transform", "translate(45, 120)")
            
            helper.create_year_text_in_group(year_group, data.years_min_max.min, data_arr.length, 620);
            
                
            /* DIV-Container, in dem weitere Infos ausgegeben werden */
            var topic_more_infos = embed_div.append("div")
                .attr("class", "topic_more_infos");
            
            /* Autoren-Liste */
            var authors_list = topic_more_infos.append("div")
                .attr("class", "authors_list");
            
            authors_list.append("span")
                        .text("Autoren");
                        
            var authors_content = authors_list.append("div")
                        .attr("class", "content_wrapper nano")
                            .append("div")
                                .attr("class", "content");
                                
            var authors_arr = [];
            var mentioned_by_arr = d.mentioned_by;
            
            if(typeof(mentioned_by_arr) !== 'undefined') {
                
                /* Die Namen aller Autoren heraussuchen, die das Topic erwähnt haben */
                for(var i = 0; i < mentioned_by_arr.length; i++) {
                    for(var j = 0; j < authors.length; j++) {
                        if(authors[j].id === mentioned_by_arr[i]) {
                            authors_arr.push(authors[j].name);
                        }
                    }
                }
                
            }
            
            /* Autoren-Liste füllen */
            var authors_ul = authors_content.append("ul").attr("class", "list");
            for(var i = 0; i < authors_arr.length; i++) {
                authors_ul.append("li").text(authors_arr[i]);
            }
            
            
            /* Dokumenten-Liste */
            var docs_list = topic_more_infos.append("div")
                .attr("class", "documents_list");
            docs_list.append("span")
                        .text("Dokumente");
            
            var docs_content = docs_list.append("div")
                        .attr("class", "content_wrapper nano")
                            .append("div")
                                .attr("class", "content");                
            
            // TODO: richtig verlinken
            var docs_arr = d.files;
            
            /* Dokumenten-Liste füllen */
            var docs_ul = docs_content.append("ul").attr("class", "list");
            for(var i = 0; i < docs_arr.length; i++) {
                docs_ul.append("li").append("a").attr("target", "_blank").attr("href", "#" + docs_arr[i]).text(docs_arr[i]);
            }
            
            
            /* Links-Liste */
            var links_list = topic_more_infos.append("div")
                .attr("class", "links_list");
            
            links_list.append("span")
                        .text("Links");
            
            var links_content = links_list.append("div")
                        .attr("class", "content_wrapper nano")
                            .append("div")
                                .attr("class", "content");
            
             // TODO: austauschen
            var links_arr = [{"title": "Wikipedia",
                              "href":  "http://de.wikipedia.org/w/index.php?title=Spezial:Suche&search=" + d.topic },
                             {"title": "DBPedia",
                              "href":  "http://dbpedia.org/resource/" + d.topic} ];
            
            /* Links-Liste füllen */
            var links_ul = links_content.append("ul").attr("class", "list");
            for(var i = 0; i < links_arr.length; i++) {
                links_ul.append("li").append("a").attr("target", "_blank").attr("href", links_arr[i].href).text(links_arr[i].title);
            }
            
            
            
            /* Clearfix */
            topic_more_infos.append("div")
                .attr("class", "clear_fix");
            
            /*
             *  Hinzufügen eines Div-Elements, um Dateien aufzulisten,
             *      die mit dem Topic in Beziehung stehen
             */
            var turn_over_placer = embed_div.append("div")
                .attr("class", "turn_over_placer");
            

            var turn_over_btn = turn_over_placer.append("a")
                .attr("class", "turn_over_btn")
                .attr("href", "javascript:void(0);");
            
            var turn_over_btn_jq = $(turn_over_btn.node());
            
            turn_over_btn_jq.html('-');
            
            turn_over_btn_jq.on('click', function() {
                var rect = d3.select($(node.node()).find('rect')[0]);
                
                /* Closebutton ausblenden und neu positionieren */
                var main_close_button = $(content.node()).parent().find('.main_close_button');
                
                main_close_button.fadeOut(function() {
                    $(this)
                        .attr("x", "115")
                        .attr("y", "-215");
                });
                
                /* Erweiterungs-ForeignObject ausblenden */
                var forObj = $(content.node()).stop().fadeOut();
                forObj.find(".nano").nanoScroller({ flash: true });
                
                /* Wende-Transition (Animation) starten -> von der Rück- zur Vorderseite */
                rect.transition()
                    .duration(700)
                    .attr("width", 0)
                    .attr("rx", 40)
                    .attr("ry", 40)
                    .attr("x", 0)
                    .each('end', function() {
                    
                        rect.transition()
                            .duration(700)
                            .attr("width", 320)
                            .attr("height", 320)
                            .attr("rx", 40)
                            .attr("ry", 40)
                            .attr("x", -160)
                            .attr("y", -160)
                            .each('end', function() {
                                /* Haupt-ForeignObject einblenden */
                                $(node.node()).find(".main_content").fadeIn();
                                
                                /* Closebutton nach Wendeanimation einblenden */
                                main_close_button.fadeIn();
                            })
                    });
            });
        }
    }


    /* Nach außen sichtbare Funktionen definieren */
    window.TopicVizz = {
        init: function(jsobj) {
            
            /* Übergabe der Daten von außen;
             *  können dort über Ajax oder durch Einbindung über einen Script-Tag
             *      bezogen werden
             */
             
             /* Testen ob es einer bestimmten Aufbaustruktur folgt */
            if(!jsobj || !jsobj.authors || !jsobj.topics)
                return false;
            
            /* Autorenliste für weitere Nutzung sichern */
            authors = jsobj.authors;
            
            var id_index_map = {};
            var runner = 0;
            
            $.each(jsobj.topics, function(i, v) {
                var num_in_years_mentioned = 0;
                var num_overall_mentioned = 0;
                
                for(var j in v.frequency_per_year) {
                    if(v.frequency_per_year.hasOwnProperty(j)) {
                        num_overall_mentioned += v.frequency_per_year[j];
                        num_in_years_mentioned++;
                    }
                }
                
                
                // num_in_years_mentioned // könnte evtl. auch als Filterparameter herangezogen werden
                if(num_overall_mentioned < 1) // Schöne Stelle für ein Threshold
                    return;
                
                v.num_overall_mentioned = num_overall_mentioned;
                
                if(num_mentioned.max == null || num_overall_mentioned > num_mentioned.max)
                    num_mentioned.max = num_overall_mentioned;
                
                if(num_mentioned.min == null || num_overall_mentioned < num_mentioned.min)
                    num_mentioned.min = num_overall_mentioned;
                
                data.nodes.push(v);
                id_index_map[v.id] = runner;
                runner++;
                
                
                /* Das niedrigste und das höchste Jahr, sowie direkt auch die Häufigkeit */
                var node_years = v.frequency_per_year;

                $.each(node_years, function(i, num) {
                    var year = parseInt(i);
                    var histogram = num;
                    
                    if(data.years_min_max.min === null || year < data.years_min_max.min)
                        data.years_min_max.min = year;

                    if(data.years_min_max.max === null || year > data.years_min_max.max)
                        data.years_min_max.max = year;

                    if(data.histogram_min_max.min === null || histogram < data.histogram_min_max.min)
                        data.histogram_min_max.min = histogram;

                    if(data.histogram_min_max.max === null || histogram > data.histogram_min_max.max)
                        data.histogram_min_max.max = histogram;
                });
                
                
                /* Allen Extensions alle Nodes zum Auswerten reichen */
                $.each(extension_set, function(i, ext) {
                    ext.eval_topic && ext.eval_topic(v);
                });
            });
            
            
            /* Überprüfen, ob nicht bereits eine Kante in entgegengesetzter Richtung existiert */
            var unique_link = function(source, target) {
            
                var is_unique = true;
            
                $.each(data.links, function(i, v) {
                    if(v['source'] === target && v['target'] === source) {
                        is_unique = false;
                        return false;
                    }
                });
                
                return is_unique;
            }
            
            
            $.each(data.nodes, function(i, v) {
                
                /* Sicherheitshalber überprüfen, ob das Topic überhaupt Kanten zu anderen Topics besitzt */
                if(typeof(v.edges) === 'undefined')
                    return true;
                
                $.each(v.edges, function(sub_i, sub_v) {
                    
                    if(     typeof(id_index_map[v.id]) !== 'undefined'
                        &&  typeof(id_index_map[sub_v.neighbour]) !== 'undefined'
                        &&  unique_link(id_index_map[v.id], id_index_map[sub_v.neighbour])) {
                        data.links.push({  source: id_index_map[v.id],
                                            target: id_index_map[sub_v.neighbour],
                                            weight: sub_v.weight});
                    }
                });
            });
            
            
            var body_node = $('body');
            var views_sidebar = body_node.find('#views_sidebar');
            
            
            var callbacks = {
                onShow: function() {
                    /* Stoppe den Graphen im Hintergrund
                     * -> da nicht mehr im Fokus und zu dem Zeitpunkt irrelevant */
                    if(renderer)
                        renderer.pause();
                },
                onHide: function() {
                    /* Den Graphen im Hintergrund fortfahren */
                    if(renderer)
                        renderer.resume();
                }
            };
            

            console.log(extension_set);

            /* Extention-Overlays erzeugen */
            $.each(extension_set, function(i, ext) {
                
                var overlay_node = $('<div>').addClass('overlay');
                body_node.prepend(overlay_node);
                
                ext.init && ext.init(overlay_node, jsobj, data, callbacks, helper);
            
                /* Sidebar-Button erzeugen und EventListener hinzufügen */
                var ext_button = $('<input>').attr('type', 'button');
                
                if(ext.info.shortname) {
                    ext_button.attr('id', ext.info.shortname + '_button')
                              .val(ext.info.shortname);
                }
                
                views_sidebar.append(ext_button);
                
                ext_button.on('click', function() {
                    if(ext.is_open()) {
                        /* Popup bzw. Overlay ausblenden */
                        ext.hide();
                    }
                    else {
                        $.each(extension_set, function(i, ext) {
                            /* Popup bzw. Overlay ausblenden, sofern offen */
                            if(ext.is_open())
                                ext.hide();
                        });
                        
                        /* Popup bzw. Overlay einblenden */
                        ext.show();
                    }
                });
                
            });
            
            /* Ausgabe der Anzahl aller betrachteten Nodes und Kanten über die Konsole ausgeben */
            console.log("topics_count", data.nodes.length);
            console.log("edges_count", data.links.length);
            
            /* Den Graphen erst aufbauen, nachdem alle relevanten Topics ausgewählt wurden */
            initGraph();
        },
        bindExtension: function(extObj) {
            /* Eine Extension muss über ein Informationsfeld verfügen */
            if(!extObj || !extObj.info || !extObj.info.name || extension_set[extObj.info.name])
                return;
            
            extension_set[extObj.info.name] = extObj;
        }
    };
    


    /* Handler usw. erst zuweisen, wenn der DOM-Baum komplett aufgebaut ist bzw. die Seite komplett geladen wurde */
    $(document).ready(function() {
        
        /* Referenz auf die im DOM existierende Popup-Elemente holen und für den späteren Gebrauch sichern */
        abstract_text_popup = $("#abstract_text_popup");
        topic_title_popup   = $("#topic_title_popup");
        
        $(".overlay_close_button")
            .css("opacity", 0.4)
            .hover( function(e) { $(this).stop().animate({"opacity": 1.0}, 300); }, /* MouseEnter */
                    function(e) { $(this).stop().animate({"opacity": 0.4}, 200); }); /* MouseLeave */
        
        
        /* Panning des Graphen unterbrechen, wenn mit gedrückter Maustaste über ein Overlay gefahren wird */
        $('.overlay').on('mouseenter', function(e) {
            if(e.buttons === 1 || e.buttons === 2) {
                var e = document.createEvent('UIEvents');
                e.initUIEvent(  "mouseup", true, true,
                                window, 0, 0, 0, 0, 0,
                                false, false, false, false,
                                0, null);
                
                $('#graph_viz').get(0).dispatchEvent(e);
            }
        });
        
    })

})(this.jQuery, window)
