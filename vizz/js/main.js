
(function($){
    "use strict";
    
    /*
     *  Renderer-Variable, woruber der Renderer gesteuert werden kann (VivaGraphJS)
     */
    var renderer = null;
    
    /* Variable, die das SVG-Element im DOM referenziert, in dem die Verlaufsgrafiken ausgegeben werden */
    var frequencyvizsvg = null;
    
    /* "Globale" Variable um Zugriff auf das Popup-Element zu haben */
    var abstract_text_popup = null;
    
    /* Vorgefertigte Datenstruktur für die Nodes (Knoten) und Lines (Kanten) */
    var data = {
        "nodes":[],
        "links":[]
    };
    
    var frequency_overlay = null;
    
    
    /* Hilfsvariablen, um das kleineste und größte Jahr sowie den kleinsten und größten Häufigkeitswert feestzuhalten */
    var years_min_max = {min: null, max: null};
    var frequency_min_max = {min: null, max: null};
    var num_mentioned = {min: null, max: null};
    
    /* Liste von Autoren */
    var authors = null;

    
    /*
     *  JSON-Dokument mit den Topics beziehen und in die zuvor definierte Datensturktur einpflegen
     *      (momentan kann nur Firefox lokale Dateien per XHR beziehen)
     */
    $.getJSON('./data/max.json', function(json) {
        
        authors = json.authors;
        
        var id_index_map = {};
        
        var runner = 0;
        
        $.each(json.topics, function(i, v) {
            var num_in_years_mentioned = 0;
            var num_overall_mentioned = 0;
            
            for(var j in v.frequency_per_year) {
                if(v.frequency_per_year.hasOwnProperty(j)) {
                    num_overall_mentioned += v.frequency_per_year[j];
                    num_in_years_mentioned++;
                }
            }
            
            
            // num_in_years_mentioned // könnte evtl. auch als Filterparameter herangezogen werden
            if(num_overall_mentioned < 2) // Schöne Stelle für ein Threshold
                return;
            
            v.num_overall_mentioned = num_overall_mentioned;
            
            if(num_mentioned.max == null || num_overall_mentioned > num_mentioned.max)
                num_mentioned.max = num_overall_mentioned;
            
            if(num_mentioned.min == null || num_overall_mentioned < num_mentioned.min)
                num_mentioned.min = num_overall_mentioned;
            
            data.nodes.push(v);
            id_index_map[v.id] = runner;
            runner++;
            
            /* Durch alle "Nodes" traversieren und das niedrigste und das höchste Jahr, sowie direkt auch die Häufigkeit */
            var node_years = v.frequency_per_year;

            $.each(node_years, function(i, v) {
                var year = parseInt(i);
                var frequency = v;
                
                if(years_min_max.min === null || year < years_min_max.min)
                    years_min_max.min = year;

                if(years_min_max.max === null || year > years_min_max.max)
                    years_min_max.max = year;

                if(frequency_min_max.min === null || frequency < frequency_min_max.min)
                    frequency_min_max.min = frequency;

                if(frequency_min_max.max === null || frequency > frequency_min_max.max)
                    frequency_min_max.max = frequency;
            });
        });
        
        
        /* Überprüfen, dass nicht bereits eine Kante in entgegengesetzter Richtung existiert */
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
        
        /* Ausgabe der Anzahl aller betrachteten Nodes und Kanten über die Konsole ausgeben */
        console.log("topics_count", data.nodes.length);
        console.log("edges_count", data.links.length);
        
        /* Den Graphen erst aufbauen, nachdem das JSON-Dokument geparst und alle relevanten Topics ausgewählt wurden */
        initGraph();
    })
    .error(function(e, i) {
        console.log(e, i);
    });
    
    
    /* Linienfunktion, um, anhand eines Wertearrays, ein SVG-Pfad zu erzeugen */
    var line_function = function(data_arr, max_width, max_height, max_value) {
        
        /* Abstandsschritt zwischen den Pfadpunkten bestimmten */
        var width_step = max_width / data_arr.length;
        
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
        
        /* Untere Punkte des Pfads berechnen (hin ->) */
        for(var i = 0; i < data_arr.length; i++) {
            line_data.push({"x": width_step * i, "y": max_height + data_arr[i] * resize_quot });
        }
        
        /* Zwei Punkte am Ende, um einen mehr oder wenigen glatten Schnitt zu erreichen */
        line_data.push({"x": width_step * (data_arr.length - 1) + 7, "y": max_height - 10 + data_arr[data_arr.length - 1] * resize_quot });
        line_data.push({"x": width_step * (data_arr.length - 1) + 7, "y": max_height + 10 - data_arr[data_arr.length - 1] * resize_quot });
        
        /* Oberen Punkte bestimmten (zurück <-) */
        for(var i = data_arr.length-1; i >= 0; i--) {
            line_data.push({"x": width_step * i, "y": max_height - data_arr[i] * resize_quot });
        }
        
        /* Letzten Punkt setzen, damit ein glatter Schnitt am Anfang erreicht wird */
        line_data.push({"x": 0 , "y": max_height - data_arr[0] * resize_quot });
        
        /* Von d3.js bereitgestellte Funktion, um einen Pfad einfacher zu erzeugen */
        var line_func = d3.svg.line()
                            .x(function(d) { return d.x; })
                            .y(function(d) { return d.y; })
                            /* 'cardinal' versucht den Pfad über die Punkte verlaufen zu lassen und schließt den Pfad am Ende */ 
                            .interpolate("cardinal");
        
        /* Attrbutwert für 'd' zurückgeben */
        return line_func(line_data);
    };

    
    
    /* Jahrestexte innerhalb einer SVG-Gruppe erzeugen (justify) */
    var create_year_text_in_group = function(group_node, year_start, year_amount, max_width) {
        
        /* Abstand zwischen den Textelementen (enthalten Jahreszahl) bestimmen */
        var width_step = max_width / year_amount;
        
        /* Für jede Jahreszahl ein Textelement erzeugen und es dem g-Element anhängen */
        for(var i = 0; i < year_amount; i++) {
            group_node.append("text")
                .attr("pointer-events", "none")
                .attr("x", function() { return width_step * i - 15; })
                .attr("y", 20)
                .attr("style", "font-size: 0.8em;")
                .attr('text-anchor', 'middle')
                .html("" + year_start);
            
            /* Das Jahr erhöhen */
            year_start++;
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
            graph.addLink(link.source, link.target, link.value);
        }
        
        var layout = Viva.Graph.Layout.forceDirected(graph, {
            springLength : 200,
            springCoeff : 0.0002,
            dragCoeff : 0.02,
            gravity : -1.2
        });


        var graphics = Viva.Graph.View.webglGraphics();
        
        renderer = Viva.Graph.View.renderer(graph, {
            layout: layout,
            graphics: graphics,
            container: document.getElementById('graph_viz')
        });
        
        
        var events = Viva.Graph.webglInputEvents(graphics, graph);
        
        events.click(function(node) {
            console.log(node);
        });
        
        renderer.run();
    }



    /* Handler usw. erst zuweisen, wenn der DOM-Baum komplett aufgebaut ist bzw. die Seite komplett geladen wurde */
    $(document).ready(function() {
        
        /* Referenz auf das im DOM existierende Popup-Element holen und für den späteren Gebrauch sichern */
        abstract_text_popup = $("#abstract_text_popup");
        
        /* Referenz auf das Overlay-Popup holen und für den späteren Gebrauch sichern */
        frequency_overlay = $("#frequency_overlay");
        $("#frequency_overlay_close_button").on("click", function() { toggle_frequency_overlay(); })
            .css("opacity", 0.4)
            .hover( function(e) { $(this).stop().animate({"opacity": 1.0}, 300); }, /* MouseEnter */
                    function(e) { $(this).stop().animate({"opacity": 0.4}, 200); }); /* MouseLeave */
        
        
        /* Click-Handler den Elementen innerhalb der Sidebar zuweisen */
        $("#frequency_diagramm_button").on('click', function() {
            toggle_frequency_overlay();
        });
        
        
        /* Ausglagerte Prozedur zur Diagrammerstellung (Zeitliche Entwicklung der Häufigkeit eines Terms) */
        function create_frequency_diagram() {
        
            /* Node-Referenz des DIV-Elements holen */
            frequencyvizsvg = document.querySelector('#frequency_viz');
            var frequencyvis = d3.select(frequencyvizsvg);

            var frequencyvizsvg_jq = $(frequencyvizsvg);

            /* Dimension des SVG-Elements setzen */
            frequencyvizsvg_jq.css("height", frequencyvizsvg_jq.height() + "px");
            frequencyvizsvg_jq.css("width", frequencyvizsvg_jq.width() + "px");
            
            /* Die für die Ausgabe relevanten Daten für d3.js holen bzw. Umbettungsstrukturen definieren */
            var nodes = data.nodes;
            
            /* D3.js - Einbindung */
            var item_histories =
                frequencyvis.selectAll('.term_history')
                    .data(nodes)
                    .enter();
            
            /* Ausgabe des Terms bzw. Topics */
            var item_g = item_histories.append("g")
                .attr("transform", function(d, i) {
                    return "translate(0, " + (i * 110 + 10) + ")";
                });
                
            item_g.append("text")
                .attr("class", "item_title_text")
                .attr("pointer-events", "none")
                .attr("dx", "175px")
                .attr("y", function(d, i) {
                    return (55 + i * 30) + "px";
                })
                .html(function(d, i) {
                    return d.topic; /* Topic-Name als Inhalt des Text-Elements setzen */
                })
                .attr("text-anchor", "end");
            
            var data_arr = [];
            
            item_g.append("g")
                .attr("class", "frequence_path")
                .attr("transform", function(d, i) { return "translate(200, "+(i*30)+")"; })
                .append("path")
                .attr("d", function(d, i) {
                    
                    var freq_arr = d.frequency_per_year;
                    
                    data_arr = [];
                    for(var i = years_min_max.min; i <= years_min_max.max; i++) {
                        var val = freq_arr[''+i];
                        
                        if(typeof(val) === 'undefined')
                            val = 0;
                        
                        data_arr.push(val);
                    }
                    
                    return line_function(data_arr, 700, 50, frequency_min_max.max);
                })
                .attr("stroke-width", "0");
            
            var g_nodes = $(frequencyvis.node()).children();
            
            var new_height = null;
            
            $.each(g_nodes, function(i, d) {
                var g_year_node = $(document.createElementNS('http://www.w3.org/2000/svg', 'g'));
                
                $(d).after(g_year_node);
                var g_node = d3.select(g_year_node[0]);
                
                var year_group = g_node
                    .attr("class", "frequence_years")
                    .attr("transform", function(d) {  new_height = 100 + (i*140); return "translate(215, " + new_height + ")"; });
                
                create_year_text_in_group(year_group, years_min_max.min, data_arr.length, 700);
            });
            
            frequency_viz.style.height = (new_height + 70) + "px";
        }
        
        
        /* Funktion zur Steuerung des Häufigkeits-Popups bzw. -Overlays */
        function toggle_frequency_overlay() {
            
            /* Sofern das Popup nicht offen ist */
            if(!frequency_overlay.is(':visible')) {
                /* Stoppe den Graphen im Hintergrund -> da nicht mehr im Fokus und zu dem Zeitpunkt irrelevant */
                if(renderer)
                    renderer.pause();
                
                /* Erzeuge das Häufigkeits-Diagramm */
                create_frequency_diagram();
                /* Popup bzw. Overlay einblenden */
                frequency_overlay.stop().fadeIn();
            
                /* Nano-Scrollbar initialisieren */
                $(".nano").nanoScroller({ flash: true });
            }
            /* Sofern das Popup offen ist */
            else {
                /* Blende das Popup bzw. Overlay aus und entleere den Inhalt des Diagramms (Elemente im SVG-Element) */
                frequency_overlay.stop().fadeOut(function() { $(frequencyvizsvg).empty(); });
                
                /* Starte die Positionsberechnung des Graphen, der nun wieder den Fokus besitzt */
                if(renderer)
                    renderer.resume();
                    
                /* Nano-Scrollbar zerstören */
                $(".nano").nanoScroller({ stop: true });
            }
        }
        
        
        /*
         *  Export-Button, um das Diagramm innerhalb des Popups als Grafik zu exportieren
         */
        $("#frequency_export_button").on("click", function(e) {
            
            var svg_title = "Zeitliche Entwicklung der Topics";
            
            var svg_elem = $("#frequency_viz")
                .attr({
                    "version": "1.1",
                    "xmlns": "http://www.w3.org/2000/svg"
                }).prepend("<title>" + svg_title + "</title>" +
                            "<defs>\n" +
                            "<style type=\"text/css\" >\n" +
                                "<![CDATA[\n" +
                                    "@font-face {" +
                                        "font-family: 'Lato';\n" +
                                        "font-style: normal;\n" +
                                        "font-weight: 400;\n" +
                                        "src: local('Lato Regular'), local('Lato-Regular'), url(./font/lato_regular.woff) format('woff');" + // TODO: Evtl. die Schriftart per base64 einbetten
                                    "}\n" +
                                    
                                    "* {\n" +
                                         "font-family: Lato, Helvetica, Arial, Verdana, sans-serif;\n" +
                                    "}\n" +
                                    
                                    "frequence_path {\n" +
                                         "fill: black;\n" +
                                    "}\n" +
                                    
                                    
                                "]]>\n" + 
                            "</style>\n" +
                            "</defs>");
            
            var svg_html = svg_elem.parent().html();
            
            window.open("data:image/svg+xml;base64,"+ btoa(svg_html), 'Diagramm der Topic-Entwicklung');
        });
        
    })

})(this.jQuery)
